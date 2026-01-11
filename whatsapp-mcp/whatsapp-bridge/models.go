package main

import (
    "time"
)

// Message represents a chat message for our client
type Message struct {
    Time      time.Time
    Sender    string
    Content   string
    IsFromMe  bool
    MediaType string
    Filename  string
}

// REST API Models

type SendMessageResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"`
}

type SendMessageRequest struct {
    Recipient string `json:"recipient"`
    Message   string `json:"message"`
    MediaPath string `json:"media_path,omitempty"`
    Session   string `json:"session,omitempty"` // "monitoring" or "replying"
}

type DownloadMediaRequest struct {
    MessageID string `json:"message_id"`
    ChatJID   string `json:"chat_jid"`
    Session   string `json:"session,omitempty"`
}

type DownloadMediaResponse struct {
    Success  bool   `json:"success"`
    Message  string `json:"message"`
    Filename string `json:"filename,omitempty"`
    Path     string `json:"path,omitempty"`
}

type SessionStatus struct {
    Paired     bool   `json:"paired"`
    Connected  bool   `json:"connected"`
    Connecting bool   `json:"connecting"`
}

// Suggestion Models

type suggestionContextMessage struct {
    Role      string `json:"role"`
    Sender    string `json:"sender,omitempty"`
    Text      string `json:"text"`
    Timestamp string `json:"timestamp,omitempty"`
}

type suggestionMessage struct {
    MessageID   string                     `json:"message_id,omitempty"`
    ChatName    string                     `json:"chat_name,omitempty"`
    ChatJID     string                     `json:"chat_jid,omitempty"`
    SenderName  string                     `json:"sender_name,omitempty"`
    SenderJID   string                     `json:"sender_jid,omitempty"`
    SenderPhone string                     `json:"sender_phone,omitempty"`
    Text        string                     `json:"text"`
    MediaType   string                     `json:"media_type,omitempty"`
    Context     []suggestionContextMessage `json:"context,omitempty"`
}

type suggestionRequest struct {
    Message        suggestionMessage `json:"message"`
    ForceGroupName string            `json:"force_group_name,omitempty"`
}
