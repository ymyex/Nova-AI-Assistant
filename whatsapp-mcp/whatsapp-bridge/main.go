package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	// Initialize Sessions
	sessions := map[string]*Session{
		"monitoring": NewSession("monitoring"),
		"replying":   NewSession("replying"),
	}

	// Store references to sessions for cross-verification
	SetMonitoringSession(sessions["monitoring"])
	SetReplyingSession(sessions["replying"])

	// Initialize each session
	for name, s := range sessions {
		if err := s.Initialize(); err != nil {
			fmt.Printf("Failed to initialize session %s: %v\n", name, err)
			return
		}

		// Register handlers
		RegisterHandlers(s)
	}

	// Start REST API
	startRESTServer(sessions, 8080)
	fmt.Println("REST server is running on port 8080")

	// Start Connections
	for _, s := range sessions {
		go func(sess *Session) {
			if err := sess.Connect(); err != nil {
				sess.Logger.Errorf("Initial connection failed: %v", err)
				sess.AutoReconnect()
			}
		}(s)
	}

	// Wait for exit
	exitChan := make(chan os.Signal, 1)
	signal.Notify(exitChan, syscall.SIGINT, syscall.SIGTERM)
	<-exitChan

	fmt.Println("Shutting down...")
	for _, s := range sessions {
		s.Client.Disconnect()
	}
}
