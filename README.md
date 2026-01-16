<p align="center">
  <h1 align="center">🤖 Nova AI Assistant</h1>
  <p align="center"><strong>Intelligent WhatsApp Automation Powered by Google Gemini</strong></p>
  <p align="center">
    A complete AI-powered system with dual WhatsApp sessions that monitors conversations and provides intelligent, contextually-aware automated responses using Google's Gemini AI model.
  </p>
</p>

---

## 📋 Table of Contents

- [System Overview](#-system-overview)
- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Components](#-components)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Dual WhatsApp Sessions](#-dual-whatsapp-sessions)
- [Custom Domain Setup](#-custom-domain-setup)
- [Auto-start on Boot](#-auto-start-on-boot)
- [Web Interface](#-web-interface)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Directory Structure](#-directory-structure)

---

## 🌟 System Overview

Nova AI Assistant is a sophisticated multi-component system designed to create an autonomous AI agent capable of participating in WhatsApp conversations with advanced dual-session architecture.

**Core Workflow:**
1. **Monitors** WhatsApp conversations through a dedicated monitoring session (read-only)
2. **Receives** messages via a separate replying session for AI interactions
3. **Analyzes** conversation context using Google Gemini AI
4. **Generates** intelligent, contextually-appropriate responses
5. **Delivers** responses back to WhatsApp through the replying session
6. **Tracks** all activity through a premium web dashboard

The system supports real-time interaction with sub-second latency and features a beautiful web interface accessible via custom domain `nova.ai`.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NOVA AI ASSISTANT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐              ┌──────────────────┐                     │
│  │   WhatsApp       │              │   WhatsApp       │                     │
│  │   Monitoring     │              │   Replying       │                     │
│  │   Session        │              │   Session        │                     │
│  │   (Read-Only)    │              │   (AI Agent)     │                     │
│  └────────┬─────────┘              └────────┬─────────┘                     │
│           │                                 │                               │
│           └─────────────┬───────────────────┘                               │
│                         │                                                   │
│                         ▼                                                   │
│           ┌──────────────────────────┐                                      │
│           │   WhatsApp Bridge (Go)   │                                      │
│           │   Dual Session Manager   │                                      │
│           │   Port 8080              │                                      │
│           └──────────┬───────────────┘                                      │
│                      │                                                      │
│                      ▼                                                      │
│           ┌──────────────────────────┐         ┌──────────────────┐        │
│           │   FastAPI Backend        │◄────────│   Gemini AI      │        │
│           │   Port 80 (nova.ai)      │         │   (Google)       │        │
│           └──────────┬───────────────┘         └──────────────────┘        │
│                      │                                                      │
│                      ▼                                                      │
│           ┌──────────────────────────┐                                      │
│           │   Web Dashboard          │                                      │
│           │   React + TypeScript     │                                      │
│           │   http://nova.ai         │                                      │
│           └──────────────────────────┘                                      │
│                                                                              │
│  Storage:                                                                    │
│  • store/whatsapp_monitoring.db    (Monitoring session data)                │
│  • store/whatsapp_replying.db      (Replying session data)                  │
│  • store/messages_monitoring.db    (Monitored messages)                     │
│  • store/messages_replying.db      (Agent messages)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🔄 Dual WhatsApp Sessions
- **Monitoring Session**: Connect your personal WhatsApp to read all messages (no auto-replies)
- **Replying Session**: Dedicated bot account that responds with AI-generated messages
- Independent QR code pairing for each session
- Separate connection status and controls for each session

### 🌐 Custom Domain Access
- Access the dashboard at `http://nova.ai` instead of `localhost:80`
- Professional URL for local development
- Automatic port 80 binding (default HTTP port)

### 🚀 Auto-start on Boot
- Windows Scheduled Task automatically starts the backend on system login
- Runs with elevated privileges for port 80 binding
- Silent background operation

### 📊 Premium Web Dashboard
- Real-time system metrics (uptime, AI health, suggestion counts)
- Dual WhatsApp connection status with live indicators
- QR code display for pairing both sessions
- Activity log with message history
- Configuration management panel
- Modern glassmorphism design with smooth animations

---

## 📦 Components

### 1. Core Engine (`nova_ai_agent/`)

Python package containing all business logic.

**Key Files:**
- `config.py` - Configuration management via environment variables
- `gemini.py` - `GeminiClient` for AI response generation
- `whatsapp.py` - `WhatsAppClient` for dual-session WhatsApp interactions
- `nova_service.py` - Orchestrates AI generation and message delivery
- `models.py` - Pydantic models including `SessionStatus` for dual sessions
- `exceptions.py` - Custom error handling

### 2. WhatsApp Bridge (`whatsapp-mcp/whatsapp-bridge/`)

Go-based bridge managing two independent WhatsApp connections.

**Architecture:**
- `main.go` - Initializes and manages both sessions
- `session.go` - Session struct for encapsulating client state
- `handlers.go` - Event handlers for messages, connection events, identity resolution
- `server.go` - REST API with session-aware endpoints
- `db.go` - Message storage logic
- `utils.go` - Helper functions

**API Endpoints:**
- `GET /api/status` - Returns status for both monitoring and replying sessions
- `GET /api/qr?session=<name>` - QR code for specific session
- `POST /api/send` - Send message (defaults to replying session)
- `POST /api/connect?session=<name>` - Trigger reconnection
- `POST /api/logout?session=<name>` - Unpair specific session

### 3. FastAPI Backend (`app/`)

RESTful API server with dual-session support.

**Updated Endpoints:**
- `GET /api/status` - Returns `SystemStatus` with nested `monitoring` and `replying` session states
- `POST /api/whatsapp/reconnect?session=<name>` - Session-specific reconnection
- `POST /api/whatsapp/unpair?session=<name>` - Session-specific unpairing
- `POST /suggestions` - Main AI endpoint (uses replying session)

### 5. OpenCode Agent (`opencode/`)

Bundled coding agent for autonomous file operations and coding tasks.
- **Auto-starts** on backend launch (Port 4096)
- **Bundled Source**: Full TypeScript source included in `opencode/`
- **Zero Config**: No separate installation required
- **First Run**: Automatically builds dependencies (`bun install && bun run build`) on first startup

### 4. Web Frontend (`frontend/src/`)

React + TypeScript dashboard.

**Components:**
- `App.tsx` - Main application with dual-session state management
- `StatusGrid.tsx` - Displays status for both WhatsApp sessions
- `ConfigForm.tsx` - Dual connection cards for pairing and management
- `ConnectionCard` - Reusable component for session control

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+**
- **Go 1.21+** (with CGO enabled for Windows)
- **Node.js 18+** (Required for bundled OpenCode)
- **Google Gemini API Key** - [Get one here](https://makersuite.google.com/app/apikey)

### 1. Clone and Configure
```bash
cd c:\Users\ymyex\Projects\Nova-AI-Assistant

# Edit .env with your API key
notepad .env
```

### 2. Install Dependencies
```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..

# Build Go bridge
cd whatsapp-mcp\whatsapp-bridge
go build -o main.exe
cd ..\..
```

### 3. Setup Custom Domain (Optional but Recommended)
Run as Administrator:
```powershell
powershell -ExecutionPolicy Bypass -File setup_domain.ps1
```
This maps `nova.ai` to `127.0.0.1` in your hosts file.

### 4. Setup Auto-start (Optional)
Run as Administrator:
```powershell
powershell -ExecutionPolicy Bypass -File setup_autostart.ps1
```
Creates a scheduled task to start the backend on login.

### 5. Start the System
**Option A: Manual Start**
```bash
# Right-click start_backend.bat and "Run as Administrator"
# (Administrator required for port 80 binding)
```

**Option B: If Auto-start is Configured**
Simply restart your computer. The system will start automatically.

### 6. Access the Dashboard
Open your browser and navigate to:
- `http://nova.ai` (if custom domain configured)
- `http://localhost` (default)

### 7. Pair WhatsApp Sessions

**Monitoring Session (Your Personal WhatsApp):**
1. Navigate to "Device Setup" tab
2. Find "Monitoring WhatsApp (No Reply)" section
3. Scan the QR code with your personal WhatsApp
4. Go to WhatsApp > Linked Devices > Link a Device

**Replying Session (Bot Account):**
1. In the same "Device Setup" tab
2. Find "Replying WhatsApp (Agent)" section
3. Scan the QR code with your bot WhatsApp account
4. This session will send AI-generated replies

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional with Defaults
GEMINI_MODEL=gemini-3-flash-preview
WHATSAPP_BRIDGE_URL=http://localhost:8080/api
WHATSAPP_GROUP_NAME=Nova
WHATSAPP_GROUP_JID=           # Auto-resolved if not set
WHATSAPP_DB_PATH=             # Auto-detected
NOVA_FORWARD_GROUP=Nova       # Group to monitor for AI replies
```

### Configuration via Web Interface

The web dashboard allows you to update:
- Gemini API key and model
- WhatsApp group name
- Bridge URL settings

Changes are persisted to the `.env` file.

---

## 🔄 Dual WhatsApp Sessions

### Why Dual Sessions?

**Monitoring Session:**
- Connect your personal WhatsApp
- Read all messages across all groups
- No automatic replies sent
- Used for observing conversations

**Replying Session:**
- Dedicated bot account
- Only monitors the configured group (default: "Nova")
- Sends AI-generated responses
- Isolated from personal messages

### Session Management

Each session has independent:
- ✅ Connection status
- ✅ QR code for pairing
- ✅ Reconnect button
- ✅ Unpair device button
- ✅ SQLite database storage

### Session States

Both sessions can be in one of these states:
- **Paired & Connected**: Fully operational
- **Paired but Disconnected**: Authentication valid, connection lost
- **Not Paired**: Needs QR code scanning
- **Connecting**: Attempting to establish connection

### Identity Resolution (JID vs LID)

WhatsApp uses two identifier formats that the system handles automatically:

| Format | Example | Description |
|--------|---------|-------------|
| **Phone-based JID** | `96560979542@s.whatsapp.net` | Traditional format using phone number |
| **LID (Linked ID)** | `216299418435789@lid` | Privacy-preserving opaque identifier |

**How it works:**
- When monitoring session connects via QR code, its identity is auto-detected from `Client.Store.ID`
- Messages may arrive with sender as LID even if monitoring uses phone-based JID
- The system resolves this using `msg.Info.SenderAlt` (contains phone when sender is LID)
- Fallback: `client.Store.LIDs.GetPNForLID()` for LID-to-phone resolution

**No configuration required** - identity detection happens at connection time with no caching from messages.

---

## 🌐 Custom Domain Setup

The system is configured to run on `http://nova.ai` for a professional local URL.

### Automatic Setup

The `setup_domain.ps1` script:
1. Adds `127.0.0.1 nova.ai` to your Windows hosts file
2. Flushes DNS cache
3. Enables access via `http://nova.ai`

### Manual Setup (if needed)

1. Open Notepad as Administrator
2. Edit `C:\Windows\System32\drivers\etc\hosts`
3. Add this line:
   ```
   127.0.0.1 nova.ai
   ```
4. Save and run `ipconfig /flushdns`

### Important Notes

- Always use `http://nova.ai` (not `https`)
- Port 80 is the default HTTP port, so no port number needed
- Backend must run as Administrator to bind to port 80

---

## 🚀 Auto-start on Boot

### Automated Setup

Run `setup_autostart.ps1` as Administrator to create a Windows Scheduled Task that:
- Triggers on user login
- Runs with highest privileges
- Starts the backend silently in the background
- Persists across reboots

### Manual Scheduled Task (Alternative)

1. Open Task Scheduler
2. Create new task with these settings:
   - **Trigger**: At log on
   - **Action**: Start `c:\Users\ymyex\Projects\Nova-AI-Assistant\start_backend.bat`
   - **Security**: Run with highest privileges
   - **Conditions**: Uncheck "Start only on AC power"

### Verification

After setup:
1. Restart your computer
2. Wait 30 seconds
3. Open `http://nova.ai`
4. Dashboard should load automatically

---

## 📊 Web Interface

### Dashboard Tab

**System Metrics:**
- System Uptime
- AI Status (Gemini connection)
- WhatsApp (Monitor) - Monitoring session status
- WhatsApp (Agent) - Replying session status  
- Total Suggestions
- Success Rate

**Activity Log:**
Real-time display of:
- Message timestamp
- Sender information
- Original message text
- AI-generated suggestion
- Delivery status

### Device Setup Tab

**AI Configuration:**
- Gemini API Key
- Target Model selection

**Bridge Configuration:**
- Group Name / JID
- Allow Bridge URL

**WhatsApp Connections:**

Two independent connection cards:

**Monitoring WhatsApp (No Reply):**
- Connection status indicator
- QR code display (when unpaired)
- Reconnect button (when paired but disconnected)
- Unpair device button

**Replying WhatsApp (Agent):**
- Connection status indicator
- QR code display (when unpaired)
- Reconnect button (when paired but disconnected)
- Unpair device button

---

## 📡 API Reference

### GET `/api/status`

Returns system status with dual session information.

**Response:**
```json
{
  "uptime_seconds": 3600.5,
  "gemini_connected": true,
  "monitoring": {
    "connected": true,
    "paired": true,
    "connecting": false,
    "qr": null
  },
  "replying": {
    "connected": true,
    "paired": true,
    "connecting": false,
    "qr": null
  },
  "total_suggestions": 42,
  "failed_suggestions": 2
}
```

### POST `/api/whatsapp/reconnect?session=<name>`

Triggers reconnection for specified session.

**Parameters:**
- `session`: Either `"monitoring"` or `"replying"`

**Response:**
```json
{
  "message": "Reconnection triggered for monitoring"
}
```

### POST `/api/whatsapp/unpair?session=<name>`

Logs out and unpairs the specified session.

**Parameters:**
- `session`: Either `"monitoring"` or `"replying"`

**Response:**
```json
{
  "message": "Unpairing triggered for replying"
}
```

### POST `/suggestions`

Main AI endpoint. Receives message payload and generates response via replying session.

**Request:**
```json
{
  "message": {
    "message_id": "ABC123",
    "chat_name": "Nova",
    "sender_name": "John",
    "text": "What is machine learning?",
    "context": [
      {
        "role": "participant",
        "sender": "Jane",
        "text": "Has anyone tried the new AI model?",
        "timestamp": "2024-01-04T08:00:00Z"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "suggestion": "Machine learning is a subset of AI...",
    "group_jid": "1234567890@g.us",
    "delivered": true,
    "details": "message sent"
  }
}
```

---

## 🔍 Troubleshooting

### "ERR_CONNECTION_REFUSED" when accessing nova.ai

**Cause**: Browser defaulting to HTTPS or backend not running.

**Solution:**
1. Explicitly type `http://nova.ai` (not `https`)
2. Verify backend is running: `netstat -ano | findstr :80`
3. Ensure backend started as Administrator

### QR Codes Not Appearing

**Cause**: Sessions might already be paired or connection issue.

**Solution:**
1. Check session status in dashboard
2. Click "Unpair Device" to generate new QR
3. Restart the backend

### One Session Connected, Other Not

**Cause**: Independent session states - this is normal.

**Solution:**
- Each session needs separate pairing
- Check the specific session's QR code
- Ensure you're using different WhatsApp accounts

### Backend Won't Start on Port 80

**Cause**: Insufficient privileges or port in use.

**Solution:**
1. Right-click `start_backend.bat` > "Run as Administrator"
2. Check for conflicting services: `netstat -ano | findstr :80`
3. Kill conflicting process if needed

### Auto-start Not Working After Reboot

**Cause**: Scheduled task not properly configured.

**Solution:**
1. Open Task Scheduler
2. Look for "StartNovaBackend" task
3. Verify triggers and security options
4. Re-run `setup_autostart.ps1` as Administrator

### Messages Not Delivering

**Cause**: Replying session not connected or wrong group.

**Solution:**
1. Check "Replying WhatsApp (Agent)" status is green/connected
2. Verify `WHATSAPP_GROUP_NAME` matches target group exactly
3. Check backend logs for errors

---

## 📁 Directory Structure

```
Nova-AI-Assistant/
├── .env                          # Configuration
├── README.md                     # This file
├── requirements.txt              # Python dependencies
├── start_backend.bat             # Backend launcher (Port 80)
├── setup_domain.ps1              # Custom domain setup
├── setup_autostart.ps1           # Auto-start configuration
│
├── app/                          # FastAPI backend
│   ├── main.py                   # API with dual-session endpoints
│   └── static/                   # Built frontend
│       ├── index.html            # "Nova AI Assistant" title
│       ├── logo.png              # Nova logo
│       └── assets/               # JS/CSS bundles
│
├── nova_ai_agent/                # Core Python package
│   ├── config.py                 # Settings
│   ├── gemini.py                 # AI client
│   ├── whatsapp.py               # Dual-session WhatsApp client
│   ├── nova_service.py          # Orchestration
│   ├── models.py                 # SessionStatus, SystemStatus
│   └── exceptions.py             # Custom errors
│
├── frontend/                     # React source
│   ├── src/
│   │   ├── App.tsx               # Dual-session state management
│   │   └── components/
│   │       ├── Dashboard/
│   │       │   └── StatusGrid.tsx      # Dual status display
│   │       └── Settings/
│   │           └── ConfigForm.tsx      # Dual connection cards
│   ├── index.html                # Source HTML
│   ├── public/
│   │   └── logo.png              # Nova logo
│   └── vite.config.ts            # Build to ../app/static
│
└── whatsapp-mcp/
    └── whatsapp-bridge/          # Go bridge
        ├── main.go               # Session initialization
        ├── session.go            # Session struct & methods
        ├── handlers.go           # Event handling, JID/LID resolution
        ├── server.go             # REST API
        ├── db.go                 # Message storage
        ├── utils.go              # Helpers
        └── store/                # SQLite databases
            ├── whatsapp_monitoring.db
            ├── whatsapp_replying.db
            ├── messages_monitoring.db
            └── messages_replying.db

├── opencode/                     # Bundled OpenCode Source
│   ├── packages/                 # TypeScript packages
│   ├── package.json              # Build config
│   └── ...                       # Full OpenCode repository
```

---

## 📄 License

This project integrates multiple open-source components:
- **WhatsApp MCP**: ISC License - [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp)
- **Windows MCP**: MIT License - [CursorTouch/Windows-MCP](https://github.com/CursorTouch/Windows-MCP)
- **OpenCode**: MIT License - [anomalyco/opencode](https://github.com/anomalyco/opencode)
- **Core Nova Agent**: Proprietary

---

<p align="center">
  <strong>Built with ❤️ using Google Gemini, WhatsApp Web API, React, and Go</strong>
</p>
