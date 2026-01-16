# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nova AI Assistant is a WhatsApp automation system powered by Google Gemini. It uses dual WhatsApp sessions (monitoring + replying) to observe conversations and generate AI responses. The system includes a web dashboard, Gmail integration, and an embedded OpenCode coding agent.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Port 80)                                       │
│  app/main.py - API endpoints, subprocess management              │
│  └── Starts WhatsApp Bridge & OpenCode on startup               │
├─────────────────────────────────────────────────────────────────┤
│  WhatsApp Bridge (Port 8080)    │  OpenCode Agent (Port 4096)   │
│  Go binary: whatsapp-bridge/    │  TypeScript: opencode/        │
│  Dual session management        │  Agentic coding assistant     │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (built → app/static/)                            │
│  TypeScript + Vite, served by FastAPI                           │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow**: WhatsApp messages → Go Bridge → FastAPI → Gemini AI → Response sent via replying session

## Common Commands

### Running the Full System
```bash
# Start everything (requires Administrator for port 80)
start_backend.bat

# Or manually:
python -m uvicorn app.main:app --host 0.0.0.0 --port 80
```

### Frontend Development
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Dev server with HMR
npm run build        # Build to ../app/static/
npm run lint         # ESLint
```

### WhatsApp Bridge (Go)
```bash
cd whatsapp-mcp/whatsapp-bridge
# IMPORTANT: CGO must be enabled (go-sqlite3 requires it)
set CGO_ENABLED=1 && go build -o main.exe
# Binary auto-started by FastAPI backend
```

### Python Dependencies
```bash
pip install -r requirements.txt
```

## Key Components

### nova_ai_agent/ - Core Python Package
- `config.py` - Settings via environment variables (Settings dataclass, uses `@lru_cache`)
- `gemini.py` - GeminiClient for AI generation with streaming support
- `whatsapp.py` - WhatsAppClient for dual-session interactions
- `gmail.py` - Gmail API integration with OAuth2
- `gmail_tools.py` - Gmail tool definitions for Gemini function calling
- `nova_service.py` - Orchestrates AI generation and delivery
- `database.py` - SQLite chat history management (conversations, messages with trace logs)
- `search_agent.py` - Google Search agent for research mode
- `opencode_client.py` - OpenCode agent HTTP client
- `models.py` - Pydantic data models

### app/main.py - FastAPI Backend
- Mounts static files from `app/static/`
- Starts WhatsApp bridge and OpenCode as subprocesses on startup
- Auto-installs Go and MinGW-w64 if not present (Windows)
- Endpoints: `/api/status`, `/api/whatsapp/reconnect`, `/suggestions`, etc.
- SSE streaming for `/api/agent/chat` and `/api/chats/{id}/messages`
- Chat history CRUD: `/api/chats` endpoints

### frontend/ - React Dashboard
- `App.tsx` - Main component with dual-session state
- `components/Dashboard/` - StatusGrid, ActivityLog
- `components/Settings/ConfigForm.tsx` - Connection cards for both sessions
- Built output goes to `app/static/`

### whatsapp-mcp/whatsapp-bridge/ - Go Bridge
- `main.go` - Initializes monitoring + replying sessions
- `session.go` - Session struct encapsulating WhatsApp client state
- `handlers.go` - Message event handlers, identity resolution (JID/LID)
- `server.go` - REST API (status, send, connect, logout)
- `store/` - SQLite databases per session

## Environment Variables

Required in `.env`:
```
GEMINI_API_KEY=your_key_here
```

Optional with defaults:
```
GEMINI_MODEL=gemini-3-flash-preview
WHATSAPP_BRIDGE_URL=http://localhost:8080/api
OPENCODE_BASE_URL=http://localhost:4096
OPENCODE_AUTO_START=true

# Research Mode (disables function calling tools when enabled)
GOOGLE_SEARCH_ENABLED=false
URL_CONTEXT_ENABLED=false

# Gmail OAuth paths (auto-resolved to project root)
GMAIL_CREDENTIALS_PATH=gmail_credentials.json
GMAIL_TOKEN_PATH=gmail_token.json
```

## Message Filtering

The system automatically detects the monitoring WhatsApp's identity when the session connects via QR code. Messages are only processed if:
1. They come from a **private chat** (not a group)
2. They are sent by the **monitoring WhatsApp** (auto-detected from `Client.Store.ID`)

### WhatsApp Identity Resolution (JID vs LID)

WhatsApp uses two identifier formats that the system handles transparently:

- **Phone-based JID**: Traditional format using phone number (e.g., `96560979542@s.whatsapp.net`)
- **LID (Linked ID)**: Opaque privacy-preserving identifier (e.g., `216299418435789@lid`)

When a message is received, the sender may appear as a LID even if the monitoring session uses phone-based JID. The system resolves this using:

1. **Direct match** with the monitoring session's `Store.ID.User`
2. **`msg.Info.SenderAlt`** - Contains the phone number when sender is LID-based
3. **LID Store lookup** - Uses `client.Store.LIDs.GetPNForLID()` for resolution

This approach is purely read-based with **no caching from messages** - identity detection happens at QR connection time only.

## API Patterns

- WhatsApp sessions: `?session=monitoring` or `?session=replying`
- Status endpoint returns `SystemStatus` with nested `SessionStatus` for each session
- Suggestions flow: POST `/suggestions` → Gemini generates → WhatsApp bridge delivers
- Chat endpoints use SSE for streaming responses (`text/event-stream`)
- Research Mode toggle: PATCH `/api/research-mode` (disables function calling when active)

## Important Code Patterns

- `get_settings()` is cached with `@lru_cache` - must call `.cache_clear()` before reload
- Subprocess management: Bridge and OpenCode processes stored in global `_bridge_process`, `_opencode_process`
- Go bridge auto-detects existing `main.exe` process to avoid duplicates
- Gmail OAuth flow: credentials upload → `/api/gmail/auth` → callback → token stored

## Build Notes

- Frontend uses Vite 7.x with React 19
- Go bridge requires CGO enabled on Windows (auto-installs MinGW-w64 if missing)
- OpenCode uses Bun package manager (`bun.lock`) - auto-builds on first run
- Backend must run as Administrator for port 80 binding
- Settings use `@lru_cache` - call `get_settings.cache_clear()` after env changes
- No test suite currently configured
