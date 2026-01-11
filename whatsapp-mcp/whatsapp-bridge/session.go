package main

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type Session struct {
	Name          string
	Client        *whatsmeow.Client
	Store         *MessageStore
	Container     *sqlstore.Container
	Logger        waLog.Logger
	
	// Status
	mu            sync.RWMutex
	IsPaired      bool
	IsConnecting  bool
	CurrentQR     string
	
	// Reconnect
	reconnectMu          sync.Mutex
	reconnectAttempts    int
	maxReconnectAttempts int
	baseReconnectDelay   time.Duration
	maxReconnectDelay    time.Duration
	isReconnecting       bool
	stopReconnect        chan struct{}
}

func NewSession(name string) *Session {
	return &Session{
		Name:                 name,
		maxReconnectAttempts: 10,
		baseReconnectDelay:   2 * time.Second,
		maxReconnectDelay:    120 * time.Second,
	}
}

func (s *Session) Initialize() error {
	s.Logger = waLog.Stdout(fmt.Sprintf("%s-Client", s.Name), "INFO", true)
	dbLog := waLog.Stdout(fmt.Sprintf("%s-Database", s.Name), "INFO", true)

	// Create directory including store/
	if err := os.MkdirAll("store", 0755); err != nil {
		return fmt.Errorf("failed to create store directory: %v", err)
	}

	// Connect to device DB
	// We use different DB files for different sessions
	dbPath := fmt.Sprintf("file:store/whatsapp_%s.db?_foreign_keys=on", s.Name)
	// For backward compatibility: if this is "monitoring" session, use original file?
	// The user approved plan says:
	// monitoring: store/whatsapp_monitoring.db
	// replying: store/whatsapp_replying.db
	// But we need to think about migration. If we change the filename, the user will be logged out.
	// We should probably check if whatsapp.db exists, and if so, rename it or use it for one of them.
	// Plan said: monitoring uses monitoring DB.
	// But to avoid logging the user out of their existing session (which arguably should be the monitoring one),
	// maybe we should assume 'whatsapp.db' maps to 'monitoring' for now?
	// However, the cleanest way is new files. User might need to rescan which is fine as per Plan Manual Verification.
	
	container, err := sqlstore.New(context.Background(), "sqlite3", dbPath, dbLog)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %v", err)
	}
	s.Container = container

	// Get device
	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		if err == sql.ErrNoRows {
			deviceStore = container.NewDevice()
			s.Logger.Infof("Created new device")
		} else {
			return fmt.Errorf("failed to get device: %v", err)
		}
	}
	
	// Initialize Client (but delay connection)
	s.Client = whatsmeow.NewClient(deviceStore, s.Logger)
	if s.Client == nil {
		return fmt.Errorf("failed to create WhatsApp client")
	}

	// Initialize Message Store
	msgDbPath := fmt.Sprintf("store/messages_%s.db", s.Name)
	s.Store, err = NewMessageStore(msgDbPath)
	if err != nil {
		return fmt.Errorf("failed to initialize message store: %v", err)
	}

	// Load pairing status
	if s.Client.Store.ID != nil {
		s.IsPaired = true
	}

	return nil
}

func (s *Session) Close() {
	if s.Store != nil {
		s.Store.Close()
	}
	if s.Client != nil {
		s.Client.Disconnect()
	}
}

// AutoReconnect implementation specific to this session
func (s *Session) AutoReconnect() {
	s.reconnectMu.Lock()
	if s.isReconnecting {
		s.reconnectMu.Unlock()
		return
	}
	s.isReconnecting = true
	s.reconnectAttempts = 0
	s.stopReconnect = make(chan struct{})
	s.reconnectMu.Unlock()

	go func() {
		defer func() {
			s.reconnectMu.Lock()
			s.isReconnecting = false
			s.reconnectMu.Unlock()
		}()

		for {
			s.reconnectMu.Lock()
			if s.reconnectAttempts >= s.maxReconnectAttempts {
				s.Logger.Errorf("Max reconnection attempts (%d) reached, giving up", s.maxReconnectAttempts)
				s.reconnectMu.Unlock()
				return
			}
			s.reconnectAttempts++
			attempt := s.reconnectAttempts
			s.reconnectMu.Unlock()

			// exponential backoff
			delay := time.Duration(float64(s.baseReconnectDelay) * math.Pow(1.5, float64(attempt-1)))
			if delay > s.maxReconnectDelay {
				delay = s.maxReconnectDelay
			}

			s.Logger.Infof("Auto-reconnect attempt %d/%d in %v...", attempt, s.maxReconnectAttempts, delay)

			select {
			case <-s.stopReconnect:
				s.Logger.Infof("Auto-reconnect cancelled")
				return
			case <-time.After(delay):
			}

			if s.Client.IsConnected() {
				s.Logger.Infof("Already connected, stopping auto-reconnect")
				s.reconnectMu.Lock()
				s.reconnectAttempts = 0
				s.reconnectMu.Unlock()
				return
			}

			err := s.Connect() // Use Connect() wrapper to handle QR codes

			if err != nil {
				s.Logger.Warnf("Auto-reconnect attempt %d failed: %v", attempt, err)
				continue
			}

			time.Sleep(2 * time.Second)

			if s.Client.IsConnected() {
				s.Logger.Infof("Auto-reconnect successful after %d attempts", attempt)
				s.reconnectMu.Lock()
				s.reconnectAttempts = 0
				s.reconnectMu.Unlock()
				return
			}
		}
	}()
}

// ConnectWrapper handles first time connection logic or simple connect
func (s *Session) Connect() error {
	s.mu.Lock()
	s.IsConnecting = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.IsConnecting = false
		s.mu.Unlock()
	}()

	if s.Client.Store.ID == nil {
		// New login
		qrChan, _ := s.Client.GetQRChannel(context.Background())
		err := s.Client.Connect()
		if err != nil {
			return err
		}

		// Handle QR code updates in background
		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					s.mu.Lock()
					s.CurrentQR = evt.Code
					s.mu.Unlock()
					s.Logger.Infof("QR Code received")
				} else if evt.Event == "success" {
					s.mu.Lock()
					s.IsPaired = true
					s.CurrentQR = ""
					s.mu.Unlock()
					s.Logger.Infof("Session %s paired successfully", s.Name)
				}
			}
		}()
		return nil
	} else {
		// Existing login
		s.mu.Lock()
		s.IsPaired = true
		s.mu.Unlock()
		return s.Client.Connect()
	}
}

func (s *Session) Disconnect() {
	s.Client.Disconnect()
}

func (s *Session) Logout() error {
	err := s.Client.Logout(context.Background())
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.IsPaired = false
	s.CurrentQR = ""
	s.IsConnecting = false
	s.mu.Unlock()
	
	// Cancel reconnect
	s.reconnectMu.Lock()
	if s.stopReconnect != nil {
		close(s.stopReconnect)
		s.stopReconnect = nil
	}
	s.reconnectMu.Unlock()
	
	return nil
}

func (s *Session) TriggerReconnect() {
	// Cancel ongoing
	s.reconnectMu.Lock()
	if s.stopReconnect != nil {
		close(s.stopReconnect)
		s.stopReconnect = nil
	}
	s.reconnectAttempts = 0
	s.reconnectMu.Unlock()

	go func() {
		s.Disconnect()
		time.Sleep(500 * time.Millisecond)
		err := s.Connect()

		if err != nil {
			s.Logger.Errorf("Forced reconnect failed: %v", err)
		}
	}()
}
