package main

import (
    "database/sql"
    "fmt"
    "os"
    "strings"
    "time"

    _ "github.com/mattn/go-sqlite3"
    "go.mau.fi/whatsmeow"
    waProto "go.mau.fi/whatsmeow/binary/proto"
)

// Database handler for storing message history
type MessageStore struct {
    db *sql.DB
}

// Initialize message store
func NewMessageStore(dbPath string) (*MessageStore, error) {
    // Create directory for database if it doesn't exist
    if err := os.MkdirAll("store", 0755); err != nil {
        return nil, fmt.Errorf("failed to create store directory: %v", err)
    }

    // Open SQLite database for messages
    db, err := sql.Open("sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on", dbPath))
    if err != nil {
        return nil, fmt.Errorf("failed to open message database: %v", err)
    }

    // Create tables if they don't exist
    _, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS chats (
            jid TEXT PRIMARY KEY,
            name TEXT,
            last_message_time TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT,
            chat_jid TEXT,
            sender TEXT,
            content TEXT,
            timestamp TIMESTAMP,
            is_from_me BOOLEAN,
            media_type TEXT,
            filename TEXT,
            url TEXT,
            media_key BLOB,
            file_sha256 BLOB,
            file_enc_sha256 BLOB,
            file_length INTEGER,
            PRIMARY KEY (id, chat_jid),
            FOREIGN KEY (chat_jid) REFERENCES chats(jid)
        );
    `)
    if err != nil {
        db.Close()
        return nil, fmt.Errorf("failed to create tables: %v", err)
    }

    return &MessageStore{db: db}, nil
}

// Close the database connection
func (store *MessageStore) Close() error {
    return store.db.Close()
}

// Store a chat in the database
func (store *MessageStore) StoreChat(jid, name string, lastMessageTime time.Time) error {
    _, err := store.db.Exec(
        "INSERT OR REPLACE INTO chats (jid, name, last_message_time) VALUES (?, ?, ?)",
        jid, name, lastMessageTime,
    )
    return err
}

func (store *MessageStore) GetChatJIDByName(name string) (string, error) {
    if strings.TrimSpace(name) == "" {
        return "", sql.ErrNoRows
    }

    var jid string
    err := store.db.QueryRow(
        "SELECT jid FROM chats WHERE LOWER(name) = ? ORDER BY last_message_time DESC LIMIT 1",
        strings.ToLower(name),
    ).Scan(&jid)
    if err != nil {
        return "", err
    }

    return jid, nil
}

// Store a message in the database
func (store *MessageStore) StoreMessage(id, chatJID, sender, content string, timestamp time.Time, isFromMe bool,
    mediaType, filename, url string, mediaKey, fileSHA256, fileEncSHA256 []byte, fileLength uint64) error {
    // Only store if there's actual content or media
    if content == "" && mediaType == "" {
        return nil
    }

    _, err := store.db.Exec(
        `INSERT OR REPLACE INTO messages 
        (id, chat_jid, sender, content, timestamp, is_from_me, media_type, filename, url, media_key, file_sha256, file_enc_sha256, file_length) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, chatJID, sender, content, timestamp, isFromMe, mediaType, filename, url, mediaKey, fileSHA256, fileEncSHA256, fileLength,
    )
    return err
}

// Get messages from a chat
func (store *MessageStore) GetMessages(chatJID string, limit int) ([]Message, error) {
    rows, err := store.db.Query(
        "SELECT sender, content, timestamp, is_from_me, media_type, filename FROM messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT ?",
        chatJID, limit,
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var messages []Message
    for rows.Next() {
        var msg Message
        var timestamp time.Time
        err := rows.Scan(&msg.Sender, &msg.Content, &timestamp, &msg.IsFromMe, &msg.MediaType, &msg.Filename)
        if err != nil {
            return nil, err
        }
        msg.Time = timestamp
        messages = append(messages, msg)
    }

    return messages, nil
}

// Get all chats
func (store *MessageStore) GetChats() (map[string]time.Time, error) {
    rows, err := store.db.Query("SELECT jid, last_message_time FROM chats ORDER BY last_message_time DESC")
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    chats := make(map[string]time.Time)
    for rows.Next() {
        var jid string
        var lastMessageTime time.Time
        err := rows.Scan(&jid, &lastMessageTime)
        if err != nil {
            return nil, err
        }
        chats[jid] = lastMessageTime
    }

    return chats, nil
}

// Store additional media info in the database
func (store *MessageStore) StoreMediaInfo(id, chatJID, url string, mediaKey, fileSHA256, fileEncSHA256 []byte, fileLength uint64) error {
    _, err := store.db.Exec(
        "UPDATE messages SET url = ?, media_key = ?, file_sha256 = ?, file_enc_sha256 = ?, file_length = ? WHERE id = ? AND chat_jid = ?",
        url, mediaKey, fileSHA256, fileEncSHA256, fileLength, id, chatJID,
    )
    return err
}

// Get media info from the database
func (store *MessageStore) GetMediaInfo(id, chatJID string) (string, string, string, []byte, []byte, []byte, uint64, error) {
    var mediaType, filename, url string
    var mediaKey, fileSHA256, fileEncSHA256 []byte
    var fileLength uint64

    err := store.db.QueryRow(
        "SELECT media_type, filename, url, media_key, file_sha256, file_enc_sha256, file_length FROM messages WHERE id = ? AND chat_jid = ?",
        id, chatJID,
    ).Scan(&mediaType, &filename, &url, &mediaKey, &fileSHA256, &fileEncSHA256, &fileLength)

    return mediaType, filename, url, mediaKey, fileSHA256, fileEncSHA256, fileLength, err
}

// Extract text content from a message
func extractTextContent(msg *waProto.Message) string {
    if msg == nil {
        return ""
    }

    // Try to get text content
    if text := msg.GetConversation(); text != "" {
        return text
    } else if extendedText := msg.GetExtendedTextMessage(); extendedText != nil {
        return extendedText.GetText()
    }

    // For now, we're ignoring non-text messages
    return ""
}

// Extract media info from a message
func extractMediaInfo(msg *waProto.Message) (mediaType string, filename string, url string, mediaKey []byte, fileSHA256 []byte, fileEncSHA256 []byte, fileLength uint64) {
    if msg == nil {
        return "", "", "", nil, nil, nil, 0
    }

    // Check for image message
    if img := msg.GetImageMessage(); img != nil {
        return "image", "image_" + time.Now().Format("20060102_150405") + ".jpg",
            img.GetURL(), img.GetMediaKey(), img.GetFileSHA256(), img.GetFileEncSHA256(), img.GetFileLength()
    }

    // Check for video message
    if vid := msg.GetVideoMessage(); vid != nil {
        return "video", "video_" + time.Now().Format("20060102_150405") + ".mp4",
            vid.GetURL(), vid.GetMediaKey(), vid.GetFileSHA256(), vid.GetFileEncSHA256(), vid.GetFileLength()
    }

    // Check for audio message
    if aud := msg.GetAudioMessage(); aud != nil {
        return "audio", "audio_" + time.Now().Format("20060102_150405") + ".ogg",
            aud.GetURL(), aud.GetMediaKey(), aud.GetFileSHA256(), aud.GetFileEncSHA256(), aud.GetFileLength()
    }

    // Check for document message
    if doc := msg.GetDocumentMessage(); doc != nil {
        filename := doc.GetFileName()
        if filename == "" {
            filename = "document_" + time.Now().Format("20060102_150405")
        }
        return "document", filename,
            doc.GetURL(), doc.GetMediaKey(), doc.GetFileSHA256(), doc.GetFileEncSHA256(), doc.GetFileLength()
    }

    return "", "", "", nil, nil, nil, 0
}

// MediaDownloader implements the whatsmeow.DownloadableMessage interface
type MediaDownloader struct {
    URL           string
    DirectPath    string
    MediaKey      []byte
    FileLength    uint64
    FileSHA256    []byte
    FileEncSHA256 []byte
    MediaType     whatsmeow.MediaType
}

// GetDirectPath implements the DownloadableMessage interface
func (d *MediaDownloader) GetDirectPath() string {
    return d.DirectPath
}

// GetURL implements the DownloadableMessage interface
func (d *MediaDownloader) GetURL() string {
    return d.URL
}

// GetMediaKey implements the DownloadableMessage interface
func (d *MediaDownloader) GetMediaKey() []byte {
    return d.MediaKey
}

// GetFileLength implements the DownloadableMessage interface
func (d *MediaDownloader) GetFileLength() uint64 {
    return d.FileLength
}

// GetFileSHA256 implements the DownloadableMessage interface
func (d *MediaDownloader) GetFileSHA256() []byte {
    return d.FileSHA256
}

// GetFileEncSHA256 implements the DownloadableMessage interface
func (d *MediaDownloader) GetFileEncSHA256() []byte {
    return d.FileEncSHA256
}

// GetMediaType implements the DownloadableMessage interface
func (d *MediaDownloader) GetMediaType() whatsmeow.MediaType {
    return d.MediaType
}
