package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type forwardGroupCache struct {
	groupName          string
	mu                 sync.RWMutex
	cachedJID          *types.JID
	lastNotFoundLogged time.Time
}

var (
	defaultForwardGroupName = getEnv("NOVA_FORWARD_GROUP", "Nova")
	novaForwarder           = forwardGroupCache{
		groupName: defaultForwardGroupName,
	}
	suggestionServiceURL = getEnv("NOVA_AGENT_URL", "http://localhost:8000/suggestions")
	suggestionHTTPClient = &http.Client{
		Timeout: 15 * time.Second,
	}
)

func RegisterHandlers(s *Session) {
	s.Client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			handleMessage(s, v)
		case *events.HistorySync:
			handleHistorySync(s, v)
		case *events.Connected:
			s.Logger.Infof("Connected to WhatsApp")
			s.reconnectMu.Lock()
			if s.stopReconnect != nil {
				select {
				case <-s.stopReconnect:
				default:
					close(s.stopReconnect)
				}
			}
			s.reconnectAttempts = 0
			s.reconnectMu.Unlock()
		case *events.Disconnected:
			s.Logger.Warnf("Disconnected from WhatsApp, attempting auto-reconnect...")
			s.mu.RLock()
			paired := s.IsPaired
			s.mu.RUnlock()
			if paired {
				go s.AutoReconnect()
			}
		case *events.StreamError:
			s.Logger.Errorf("Stream error: %v, reconnecting...", v.Code)
			s.mu.RLock()
			paired := s.IsPaired
			s.mu.RUnlock()
			if paired {
				go s.AutoReconnect()
			}
		case *events.StreamReplaced:
			s.Logger.Warnf("Stream replaced (session opened elsewhere)")
			s.mu.RLock()
			paired := s.IsPaired
			s.mu.RUnlock()
			if paired {
				go func() {
					time.Sleep(5 * time.Second)
					s.AutoReconnect()
				}()
			}
		case *events.LoggedOut:
			s.Logger.Warnf("Logged out")
			s.mu.Lock()
			s.IsPaired = false
			s.CurrentQR = ""
			s.mu.Unlock()
			// Cancel reconnect
			s.reconnectMu.Lock()
			if s.stopReconnect != nil {
				close(s.stopReconnect)
			}
			s.reconnectMu.Unlock()
		}
	})
}

func handleMessage(s *Session, msg *events.Message) {
	// Save to DB
	chatJID := msg.Info.Chat.String()
	sender := msg.Info.Sender.User
	
	// Determine chat name
	name := GetChatName(s.Client, s.Store, msg.Info.Chat, chatJID, nil, sender, s.Logger)
	
	// Store chat
	err := s.Store.StoreChat(chatJID, name, msg.Info.Timestamp)
	if err != nil {
		s.Logger.Warnf("Failed to store chat: %v", err)
	}

	content := extractTextContent(msg.Message)
	mediaType, filename, url, mediaKey, fileSHA256, fileEncSHA256, fileLength := extractMediaInfo(msg.Message)

	if content == "" && mediaType == "" {
		return
	}

	err = s.Store.StoreMessage(
		msg.Info.ID, chatJID, sender, content, msg.Info.Timestamp, msg.Info.IsFromMe,
		mediaType, filename, url, mediaKey, fileSHA256, fileEncSHA256, fileLength,
	)
	
	if err != nil {
		s.Logger.Warnf("Failed to store message: %v", err)
	} else {
		// Log
		direction := "←"
		if msg.Info.IsFromMe {
			direction = "→"
		}
		if mediaType != "" {
			fmt.Printf("[%s] [%s] %s %s: [%s: %s] %s\n", s.Name, msg.Info.Timestamp.Format("15:04:05"), direction, sender, mediaType, filename, content)
		} else {
			fmt.Printf("[%s] [%s] %s %s: %s\n", s.Name, msg.Info.Timestamp.Format("15:04:05"), direction, sender, content)
		}
	}

	// ONLY FORWARD IF REPLYING SESSION
	if s.Name == "replying" {
		go forwardIncomingMessage(s, msg, name, content, mediaType)
	}
}

func forwardIncomingMessage(s *Session, msg *events.Message, chatName, content, mediaType string) {
	if msg == nil || msg.Info.IsFromMe {
		return
	}

	originalChatJID := msg.Info.Chat.String()
	targetJID, resolved := novaForwarder.resolve(s.Store, s.Logger)
	isNovaGroup := false

	if resolved {
		if originalChatJID == targetJID.String() {
			isNovaGroup = true
		}
	} else {
		if strings.EqualFold(chatName, novaForwarder.groupName) {
			isNovaGroup = true
		}
	}

	if !isNovaGroup {
		return
	}

	trimmedContent := strings.TrimSpace(content)
	if trimmedContent == "" && mediaType != "" {
		trimmedContent = fmt.Sprintf("[media: %s]", mediaType)
	}
	if trimmedContent == "" {
		return
	}

	senderUser := msg.Info.Sender.User
	senderName := strings.TrimSpace(msg.Info.PushName)
	if senderName == "" {
		senderName = senderUser
	}

	contextMessages := buildSuggestionContext(s.Store, msg, originalChatJID)

	payload := suggestionRequest{
		Message: suggestionMessage{
			MessageID:   msg.Info.ID,
			ChatName:    chatName,
			ChatJID:     originalChatJID,
			SenderName:  senderName,
			SenderJID:   msg.Info.Sender.String(),
			SenderPhone: senderUser,
			Text:        trimmedContent,
			MediaType:   mediaType,
			Context:     contextMessages,
		},
	}
	
	if groupName := strings.TrimSpace(novaForwarder.groupName); groupName != "" {
		payload.ForceGroupName = groupName
	}
	
	body, err := json.Marshal(payload)
	if err != nil {
		s.Logger.Warnf("Failed to marshal payload: %v", err)
		return
	}
	
	req, err := http.NewRequest(http.MethodPost, suggestionServiceURL, bytes.NewReader(body))
	if err != nil { return }
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := suggestionHTTPClient.Do(req)
	if err != nil {
		s.Logger.Warnf("Failed to call Nova agent: %v", err)
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 300 {
		s.Logger.Warnf("Nova agent returned %d", resp.StatusCode)
	} else {
		s.Logger.Infof("Submitted to agent")
	}
}

// Helper methods from old main.go
func (f *forwardGroupCache) resolve(store *MessageStore, logger waLog.Logger) (types.JID, bool) {
	if strings.TrimSpace(f.groupName) == "" {
		return types.JID{}, false
	}
	f.mu.RLock()
	if f.cachedJID != nil {
		jid := *f.cachedJID
		f.mu.RUnlock()
		return jid, true
	}
	f.mu.RUnlock()
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.cachedJID != nil {
		return *f.cachedJID, true
	}
	jidStr, err := store.GetChatJIDByName(f.groupName)
	if err != nil {
		return types.JID{}, false
	}
	parsed, err := types.ParseJID(jidStr)
	if err != nil {
		return types.JID{}, false
	}
	f.cachedJID = &parsed
	return parsed, true
}

func buildSuggestionContext(messageStore *MessageStore, msg *events.Message, chatJID string) []suggestionContextMessage {
	const contextLimit = 5
	history, err := messageStore.GetMessages(chatJID, contextLimit+1)
	if err != nil || len(history) == 0 {
		return nil
	}
	
	if len(history) > 0 {
		first := history[0]
		if first.Time.Equal(msg.Info.Timestamp) && first.Sender == msg.Info.Sender.User {
			history = history[1:]
		}
	}
	
	context := make([]suggestionContextMessage, 0, contextLimit)
	for i := len(history) - 1; i >= 0; i-- {
		record := history[i]
		text := strings.TrimSpace(record.Content)
		if text == "" && record.MediaType != "" {
			text = fmt.Sprintf("[media: %s]", record.MediaType)
		}
		if text == "" {
			continue
		}
		role := "participant"
		if record.IsFromMe {
			role = "me"
		}
		context = append(context, suggestionContextMessage{
			Role:      role,
			Sender:    record.Sender,
			Text:      text,
			Timestamp: record.Time.Format(time.RFC3339),
		})
		if len(context) >= contextLimit {
			break
		}
	}
	return context
}

func GetChatName(client *whatsmeow.Client, messageStore *MessageStore, jid types.JID, chatJID string, conversation interface{}, sender string, logger waLog.Logger) string {
	// Reused logic
	// Check DB
	var existingName string
	err := messageStore.db.QueryRow("SELECT name FROM chats WHERE jid = ?", chatJID).Scan(&existingName)
	if err == nil && existingName != "" {
		return existingName
	}
	
	var name string
	if jid.Server == "g.us" {
		if conversation != nil {
			// simplified reflection logic
			v := reflect.ValueOf(conversation)
			if v.Kind() == reflect.Ptr && !v.IsNil() {
				v = v.Elem()
				if f := v.FieldByName("DisplayName"); f.IsValid() && f.Kind() == reflect.Ptr && !f.IsNil() {
					name = f.Elem().String()
				} else if f := v.FieldByName("Name"); f.IsValid() && f.Kind() == reflect.Ptr && !f.IsNil() {
					name = f.Elem().String()
				}
			}
		}
		if name == "" {
			info, err := client.GetGroupInfo(context.Background(), jid)
			if err == nil {
				name = info.Name
			} else {
				name = fmt.Sprintf("Group %s", jid.User)
			}
		}
	} else {
		contact, err := client.Store.Contacts.GetContact(context.Background(), jid)
		if err == nil && contact.FullName != "" {
			name = contact.FullName
		} else if sender != "" {
			name = sender
		} else {
			name = jid.User
		}
	}
	return name
}

func handleHistorySync(s *Session, evt *events.HistorySync) {
	for _, conv := range evt.Data.Conversations {
		if conv.ID == nil { continue }
		chatJID := *conv.ID
		jid, _ := types.ParseJID(chatJID)
		GetChatName(s.Client, s.Store, jid, chatJID, conv, "", s.Logger)
		// Process messages if needed
	}
}
