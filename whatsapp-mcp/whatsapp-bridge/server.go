package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func getSession(sessions map[string]*Session, name string) *Session {
	if name == "" {
		// Default to replying session for backward compatibility of /api/send
		return sessions["replying"]
	}
	return sessions[name]
}

func startRESTServer(sessions map[string]*Session, port int) {
	// Status Handler
	http.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		status := make(map[string]interface{})
		for name, s := range sessions {
			s.mu.RLock()
			sessionStatus := map[string]interface{}{
				"paired":     s.IsPaired,
				"connected":  s.Client.IsConnected(),
				"connecting": s.IsConnecting,
			}

			// Include identity information if connected
			if s.Client != nil && s.Client.Store != nil && s.Client.Store.ID != nil {
				deviceID := s.Client.Store.ID
				sessionStatus["jid"] = deviceID.String()
				sessionStatus["user"] = deviceID.User
				sessionStatus["server"] = deviceID.Server

				// If the server is "lid", the user field is a LID, not a phone
				// Try to get actual phone number from PNJid if available
				if deviceID.Server == "lid" {
					sessionStatus["is_lid"] = true
					// For LID-based accounts, we need to get the phone from elsewhere
					// The PNJid (phone number JID) may be available in some cases
					sessionStatus["phone"] = "" // Will be populated by identity resolution
				} else {
					sessionStatus["is_lid"] = false
					sessionStatus["phone"] = deviceID.User
				}
			}

			s.mu.RUnlock()
			status[name] = sessionStatus
		}

		json.NewEncoder(w).Encode(status)
	})

	// Session-specific status (optional helper)
	// /api/{session}/status would be cleaner but stdlib mux is simple.
	// We'll use query params or inspect path if we want, but single endpoint is easier.

	// QR Handler
	http.HandleFunc("/api/qr", func(w http.ResponseWriter, r *http.Request) {
		// Expect ?session=name
		sessionName := r.URL.Query().Get("session")
		s := sessions[sessionName]
		if s == nil {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		s.mu.RLock()
		defer s.mu.RUnlock()

		if s.IsPaired {
			http.Error(w, "Already paired", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"qr": s.CurrentQR,
		})
	})

	// Connect/Reconnect Handler
	http.HandleFunc("/api/connect", func(w http.ResponseWriter, r *http.Request) {
		sessionName := r.URL.Query().Get("session")
		s := sessions[sessionName]
		if s == nil {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		s.TriggerReconnect()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Reconnection triggered"})
	})

	// Logout Handler
	http.HandleFunc("/api/logout", func(w http.ResponseWriter, r *http.Request) {
		sessionName := r.URL.Query().Get("session")
		s := sessions[sessionName]
		if s == nil {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		err := s.Logout()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	})

	// Send Handler
	http.HandleFunc("/api/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid json", http.StatusBadRequest)
			return
		}

		s := getSession(sessions, req.Session)
		if s == nil {
			http.Error(w, "Session not found", http.StatusBadRequest)
			return
		}

		success, msg := sendWhatsAppMessage(s.Client, req.Recipient, req.Message, req.MediaPath)
		
		w.Header().Set("Content-Type", "application/json")
		if !success {
			w.WriteHeader(http.StatusInternalServerError)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": success,
			"message": msg,
		})
	})

	// Download Handler
	http.HandleFunc("/api/download", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost { return }
		var req DownloadMediaRequest
		json.NewDecoder(r.Body).Decode(&req)
		
		s := getSession(sessions, req.Session)
		// Default to replying if not set? Or try both?
		// Usually downloads come from the session that received it.
		// If session is empty, we might fail if we don't know who owns the msg.
		if s == nil {
			// Try finding the message in any session?
			// For now require session or default to replying
			s = sessions["replying"]
		}

		success, mType, fname, path, err := downloadMedia(s.Client, s.Store, req.MessageID, req.ChatJID)
		
		w.Header().Set("Content-Type", "application/json")
		if !success {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": fmt.Sprintf("%v", err)})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true, 
				"message": "Downloaded",
				"filename": fname,
				"path": path,
				"type": mType,
			})
		}
	})

	serverAddr := fmt.Sprintf(":%d", port)
	fmt.Printf("Starting REST API server on %s...\n", serverAddr)
	go func() {
		if err := http.ListenAndServe(serverAddr, nil); err != nil {
			fmt.Printf("REST API server error: %v\n", err)
		}
	}()
}
