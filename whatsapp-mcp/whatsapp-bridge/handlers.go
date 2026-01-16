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

var (
	suggestionServiceURL = getEnv("NOVA_AGENT_URL", "http://localhost:8000/suggestions")
	suggestionHTTPClient = &http.Client{
		Timeout: 120 * time.Second, // 2 minutes - Gemini processing can take a while
	}

	// Store reference to monitoring session to get its phone number
	monitoringSession   *Session
	monitoringSessionMu sync.RWMutex

	// Store reference to replying session for cross-verification
	replyingSession   *Session
	replyingSessionMu sync.RWMutex
)

// SetMonitoringSession stores a reference to the monitoring session
func SetMonitoringSession(s *Session) {
	monitoringSessionMu.Lock()
	defer monitoringSessionMu.Unlock()
	monitoringSession = s
}

// SetReplyingSession stores a reference to the replying session
func SetReplyingSession(s *Session) {
	replyingSessionMu.Lock()
	defer replyingSessionMu.Unlock()
	replyingSession = s
}

// GetReplyingPhone returns the phone number of the replying session
// Returns empty string if not available or if using LID format
func GetReplyingPhone() string {
	replyingSessionMu.RLock()
	defer replyingSessionMu.RUnlock()

	if replyingSession == nil || replyingSession.Client == nil || replyingSession.Client.Store == nil {
		return ""
	}

	if replyingSession.Client.Store.ID == nil {
		return ""
	}

	// Only return if it's a phone-based JID (s.whatsapp.net), not a LID
	if replyingSession.Client.Store.ID.Server == "s.whatsapp.net" {
		return replyingSession.Client.Store.ID.User
	}

	return ""
}

// GetReplyingJID returns the full JID string of the replying session
func GetReplyingJID() string {
	replyingSessionMu.RLock()
	defer replyingSessionMu.RUnlock()

	if replyingSession == nil || replyingSession.Client == nil || replyingSession.Client.Store == nil {
		return ""
	}

	if replyingSession.Client.Store.ID == nil {
		return ""
	}

	return replyingSession.Client.Store.ID.String()
}

// GetMonitoringPhone returns the phone number of the monitoring session
// Returns empty string if not available or if using LID format
func GetMonitoringPhone() string {
	monitoringSessionMu.RLock()
	defer monitoringSessionMu.RUnlock()

	if monitoringSession == nil || monitoringSession.Client == nil || monitoringSession.Client.Store == nil {
		return ""
	}

	if monitoringSession.Client.Store.ID == nil {
		return ""
	}

	// Only return if it's a phone-based JID (s.whatsapp.net), not a LID
	if monitoringSession.Client.Store.ID.Server == "s.whatsapp.net" {
		return monitoringSession.Client.Store.ID.User
	}

	return ""
}

// GetMonitoringJID returns the full JID string of the monitoring session
func GetMonitoringJID() string {
	monitoringSessionMu.RLock()
	defer monitoringSessionMu.RUnlock()

	if monitoringSession == nil || monitoringSession.Client == nil || monitoringSession.Client.Store == nil {
		return ""
	}

	if monitoringSession.Client.Store.ID == nil {
		return ""
	}

	return monitoringSession.Client.Store.ID.String()
}

// GetMonitoringUser returns the User field from the monitoring session's JID
// This could be either a phone number OR a LID, depending on the session type
func GetMonitoringUser() string {
	monitoringSessionMu.RLock()
	defer monitoringSessionMu.RUnlock()

	if monitoringSession == nil || monitoringSession.Client == nil || monitoringSession.Client.Store == nil {
		return ""
	}

	if monitoringSession.Client.Store.ID == nil {
		return ""
	}

	return monitoringSession.Client.Store.ID.User
}

// IsMonitoringUsingLID returns true if the monitoring session is using LID format
func IsMonitoringUsingLID() bool {
	monitoringSessionMu.RLock()
	defer monitoringSessionMu.RUnlock()

	if monitoringSession == nil || monitoringSession.Client == nil || monitoringSession.Client.Store == nil {
		return false
	}

	if monitoringSession.Client.Store.ID == nil {
		return false
	}

	return monitoringSession.Client.Store.ID.Server == "lid"
}


// IsFromMonitoringUser checks if the sender of a message is the monitoring user.
// The monitoring user's identity is auto-detected from the connected session.
// It handles both phone-based JIDs and LID-based JIDs using proper resolution.
func IsFromMonitoringUser(client *whatsmeow.Client, senderJID types.JID, senderAltJID types.JID, chatJID types.JID, logger waLog.Logger) bool {
	monitoringUser := GetMonitoringUser()
	monitoringPhone := GetMonitoringPhone()

	if monitoringUser == "" {
		logger.Warnf("Monitoring user not available (session not connected?)")
		return false
	}

	senderUser := senderJID.User
	senderServer := senderJID.Server

	// Log both sender JIDs for debugging
	logger.Infof("IsFromMonitoringUser: sender=%s@%s, senderAlt=%s, monitoringPhone=%s",
		senderUser, senderServer, senderAltJID.String(), monitoringPhone)

	// =========================================================================
	// CHECK 1: Direct match with monitoring user's ID
	// =========================================================================
	if senderUser == monitoringUser {
		logger.Infof("✓ Sender %s matches monitoring user directly", senderUser)
		return true
	}

	// =========================================================================
	// CHECK 2: Match with monitoring phone number
	// =========================================================================
	if monitoringPhone != "" && senderUser == monitoringPhone {
		logger.Infof("✓ Sender %s matches monitoring phone", senderUser)
		return true
	}

	// =========================================================================
	// CHECK 3: Use SenderAlt JID (the alternative address from the message)
	// When sender is LID-based, SenderAlt contains the phone number JID
	// This is the PROPER way to get the phone number from a LID sender
	// =========================================================================
	if !senderAltJID.IsEmpty() {
		altUser := senderAltJID.User
		logger.Infof("Checking SenderAlt: %s", senderAltJID.String())

		if altUser == monitoringUser || altUser == monitoringPhone {
			logger.Infof("✓ SenderAlt %s matches monitoring user/phone", altUser)
			return true
		}
	}

	// =========================================================================
	// CHECK 4: Use LID store to resolve LID to phone number
	// =========================================================================
	if senderServer == "lid" && monitoringPhone != "" {
		// Try to resolve the LID to a phone number using the store
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		resolvedPN, err := client.Store.LIDs.GetPNForLID(ctx, senderJID.ToNonAD())
		if err == nil && !resolvedPN.IsEmpty() {
			logger.Infof("LID store resolved %s to phone %s", senderUser, resolvedPN.User)
			if resolvedPN.User == monitoringPhone {
				logger.Infof("✓ Resolved LID %s matches monitoring phone %s", senderUser, monitoringPhone)
				return true
			}
		} else if err != nil {
			logger.Debugf("LID store lookup failed: %v", err)
		}
	}

	// =========================================================================
	// No match found
	// =========================================================================
	logger.Infof("✗ Sender %s@%s is NOT monitoring user (monitoringPhone=%s)",
		senderUser, senderServer, monitoringPhone)
	return false
}

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

			// Auto-discover identity at connection time
			go func() {
				// Log the session's identity information
				if s.Client != nil && s.Client.Store != nil && s.Client.Store.ID != nil {
					deviceID := s.Client.Store.ID

					// Print prominent banner for session identity
					fmt.Println("")
					fmt.Println("╔══════════════════════════════════════════════════════════════╗")
					fmt.Printf("║  SESSION CONNECTED: %-40s  ║\n", s.Name)
					fmt.Println("╠══════════════════════════════════════════════════════════════╣")
					fmt.Printf("║  JID:    %-52s  ║\n", deviceID.String())
					fmt.Printf("║  User:   %-52s  ║\n", deviceID.User)
					fmt.Printf("║  Server: %-52s  ║\n", deviceID.Server)

					if deviceID.Server == "lid" {
						fmt.Printf("║  Format: %-52s  ║\n", "LID-based (opaque identifier)")
					} else {
						fmt.Printf("║  Format: %-52s  ║\n", "Phone-based (traditional)")
					}
					fmt.Println("╚══════════════════════════════════════════════════════════════╝")
					fmt.Println("")
				}

				// If this is the monitoring session, log its identity
				if s.Name == "monitoring" {
					monitoringPhone := GetMonitoringPhone()
					isUsingLID := IsMonitoringUsingLID()

					// Print monitoring-specific details
					fmt.Println("┌──────────────────────────────────────────────────────────────┐")
					fmt.Println("│  MONITORING WHATSAPP IDENTITY (Auto-Detected)                │")
					fmt.Println("├──────────────────────────────────────────────────────────────┤")
					if isUsingLID {
						fmt.Printf("│  Identifier: %-48s  │\n", GetMonitoringUser())
						fmt.Printf("│  Type:       %-48s  │\n", "LID-based")
					} else {
						fmt.Printf("│  Phone:      %-48s  │\n", monitoringPhone)
						fmt.Printf("│  Type:       %-48s  │\n", "Phone-based")
					}
					fmt.Printf("│  Resolution: %-48s  │\n", "Via SenderAlt + LID Store")
					fmt.Println("└──────────────────────────────────────────────────────────────┘")
					fmt.Println("")
				}
			}()
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
		case *events.OfflineSyncPreview:
			fmt.Printf("[%s] Offline sync starting: %d messages, %d receipts, %d notifications, %d app data changes pending\n",
				s.Name, v.Messages, v.Receipts, v.Notifications, v.AppDataChanges)
		case *events.OfflineSyncCompleted:
			fmt.Printf("[%s] Offline sync completed: %d events processed\n", s.Name, v.Count)
		}
	})
}

func handleMessage(s *Session, msg *events.Message) {
	// Save to DB
	chatJID := msg.Info.Chat.String()
	// Store full JID string for sender to preserve phone vs LID context
	senderJID := msg.Info.Sender.String()
	senderUser := msg.Info.Sender.User

	// Determine chat name
	name := GetChatName(s.Client, s.Store, msg.Info.Chat, chatJID, nil, senderUser, s.Logger)

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

	// Store sender as full JID string to preserve phone vs LID context
	err = s.Store.StoreMessage(
		msg.Info.ID, chatJID, senderJID, content, msg.Info.Timestamp, msg.Info.IsFromMe,
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
			fmt.Printf("[%s] [%s] %s %s: [%s: %s] %s\n", s.Name, msg.Info.Timestamp.Format("15:04:05"), direction, senderUser, mediaType, filename, content)
		} else {
			fmt.Printf("[%s] [%s] %s %s: %s\n", s.Name, msg.Info.Timestamp.Format("15:04:05"), direction, senderUser, content)
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
	chatServer := msg.Info.Chat.Server
	senderUser := msg.Info.Sender.User

	// WHITELIST APPROACH: Only process messages from TRUE private chats
	// Private chats use server "s.whatsapp.net" (phone-based) or "lid" (LID-based)
	// Reject everything else: groups (g.us), broadcasts (broadcast), newsletters, etc.
	isPrivateChat := chatServer == "s.whatsapp.net" || chatServer == "lid"
	if !isPrivateChat {
		// Not a private chat - ignore silently
		return
	}

	// Check if the sender is the monitoring user
	// This handles both phone-based and LID-based JIDs using SenderAlt for resolution
	if !IsFromMonitoringUser(s.Client, msg.Info.Sender, msg.Info.SenderAlt, msg.Info.Chat, s.Logger) {
		s.Logger.Infof("DEBUG: Sender %s@%s is not monitoring user, skipping",
			senderUser, msg.Info.Sender.Server)
		return
	}

	s.Logger.Infof("Processing private chat message from monitoring user (sender=%s, chat=%s)",
		senderUser, originalChatJID)

	trimmedContent := strings.TrimSpace(content)
	if trimmedContent == "" && mediaType != "" {
		trimmedContent = fmt.Sprintf("[media: %s]", mediaType)
	}
	if trimmedContent == "" {
		return
	}

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
			SenderID:    senderUser, // Could be phone or LID - renamed from SenderPhone
			Text:        trimmedContent,
			MediaType:   mediaType,
			Context:     contextMessages,
		},
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

func buildSuggestionContext(messageStore *MessageStore, msg *events.Message, chatJID string) []suggestionContextMessage {
	const contextLimit = 5
	history, err := messageStore.GetMessages(chatJID, contextLimit+1)
	if err != nil || len(history) == 0 {
		return nil
	}

	// Current message sender JID for comparison
	currentSenderJID := msg.Info.Sender.String()

	if len(history) > 0 {
		first := history[0]
		// Compare full JID strings or just User part for compatibility
		senderMatch := first.Sender == currentSenderJID || first.Sender == msg.Info.Sender.User
		if first.Time.Equal(msg.Info.Timestamp) && senderMatch {
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
	fmt.Printf("[%s] Received history sync event with %d conversations\n", s.Name, len(evt.Data.Conversations))

	syncedCount := 0
	for _, conv := range evt.Data.Conversations {
		if conv.ID == nil {
			continue
		}

		chatJID := *conv.ID

		// Try to parse the JID
		jid, err := types.ParseJID(chatJID)
		if err != nil {
			s.Logger.Warnf("Failed to parse JID %s: %v", chatJID, err)
			continue
		}

		// Get appropriate chat name
		name := GetChatName(s.Client, s.Store, jid, chatJID, conv, "", s.Logger)

		// Process messages
		messages := conv.Messages
		if len(messages) > 0 {
			// Update chat with latest message timestamp
			latestMsg := messages[0]
			if latestMsg == nil || latestMsg.Message == nil {
				continue
			}

			// Get timestamp from message info
			timestamp := time.Time{}
			if ts := latestMsg.Message.GetMessageTimestamp(); ts != 0 {
				timestamp = time.Unix(int64(ts), 0)
			} else {
				continue
			}

			s.Store.StoreChat(chatJID, name, timestamp)

			// Store messages
			for _, msg := range messages {
				if msg == nil || msg.Message == nil {
					continue
				}

				// Extract text content
				var content string
				if msg.Message.Message != nil {
					if conv := msg.Message.Message.GetConversation(); conv != "" {
						content = conv
					} else if ext := msg.Message.Message.GetExtendedTextMessage(); ext != nil {
						content = ext.GetText()
					}
				}

				// Extract media info
				var mediaType, filename, url string
				var mediaKey, fileSHA256, fileEncSHA256 []byte
				var fileLength uint64

				if msg.Message.Message != nil {
					mediaType, filename, url, mediaKey, fileSHA256, fileEncSHA256, fileLength = extractMediaInfo(msg.Message.Message)
				}

				// Skip messages with no content and no media
				if content == "" && mediaType == "" {
					continue
				}

				// Determine sender - store full JID string to preserve phone vs LID context
				var sender string
				isFromMe := false
				if msg.Message.Key != nil {
					if msg.Message.Key.FromMe != nil {
						isFromMe = *msg.Message.Key.FromMe
					}
					if !isFromMe && msg.Message.Key.Participant != nil && *msg.Message.Key.Participant != "" {
						// Participant is already a full JID string
						sender = *msg.Message.Key.Participant
					} else if isFromMe {
						// Use full JID string for self
						sender = s.Client.Store.ID.String()
					} else {
						// Use full JID string for chat partner
						sender = jid.String()
					}
				} else {
					sender = jid.String()
				}

				// Store message
				msgID := ""
				if msg.Message.Key != nil && msg.Message.Key.ID != nil {
					msgID = *msg.Message.Key.ID
				}

				// Get message timestamp
				msgTimestamp := time.Time{}
				if ts := msg.Message.GetMessageTimestamp(); ts != 0 {
					msgTimestamp = time.Unix(int64(ts), 0)
				} else {
					continue
				}

				err = s.Store.StoreMessage(
					msgID,
					chatJID,
					sender,
					content,
					msgTimestamp,
					isFromMe,
					mediaType,
					filename,
					url,
					mediaKey,
					fileSHA256,
					fileEncSHA256,
					fileLength,
				)
				if err != nil {
					s.Logger.Warnf("Failed to store history message: %v", err)
				} else {
					syncedCount++
				}
			}
		}
	}

	fmt.Printf("[%s] History sync complete. Stored %d messages.\n", s.Name, syncedCount)
}
