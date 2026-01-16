import time
import subprocess
import os
import sys
import urllib.request
import tempfile
import zipfile
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, status, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse

from nova_ai_agent.config import get_settings, Settings
from nova_ai_agent.exceptions import ConfigurationError, GeminiError, WhatsAppError
from nova_ai_agent.models import (
    NovaPayload,
    NovaResponse,
    SystemStatus,
    SessionStatus,
    ActivityLogEntry,
    SystemConfig,
    ConfigUpdate,
    GmailStatus,
    EmailMessage,
    SendEmailRequest,
    CreateDraftRequest,
    EmailListResponse,
    AgentChatRequest,
    # Chat History Models
    ConversationData,
    ConversationListItem,
    MessageData,
    CreateConversationRequest,
    UpdateConversationRequest,
    ChatMessageRequest,
    GenerateTitleRequest,
)
from nova_ai_agent.nova_service import NovaService
from nova_ai_agent.gemini import GeminiClient
from nova_ai_agent.whatsapp import WhatsAppClient
from nova_ai_agent.gmail import GmailClient
from nova_ai_agent.opencode_client import OpenCodeClient
from nova_ai_agent import database as chat_db

app = FastAPI(title="Nova AI Assistant")



# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)

_service: Optional[NovaService] = None
_startup_error: Optional[str] = None
_start_time = time.time()
_settings: Optional[Settings] = None
_bridge_process: Optional[subprocess.Popen] = None
_opencode_process: Optional[subprocess.Popen] = None
_gmail_client: Optional[GmailClient] = None
_opencode_client: Optional[OpenCodeClient] = None

def load_env_vars():
    """Load environment variables from .env file"""
    env_path = Path(".env")
    if not env_path.exists():
        return {}
    
    env_vars = {}
    try:
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    except Exception as e:
        print(f"Error reading .env file: {e}")
    return env_vars

@app.on_event("startup")
def startup_event() -> None:
    global _service, _startup_error, _settings, _bridge_process, _gmail_client, _opencode_client
    
    try:
        # Load .env vars manually and update os.environ
        env_vars = load_env_vars()
        if env_vars:
            os.environ.update(env_vars)
            print(f"Loaded {len(env_vars)} variables from .env")

        _settings = get_settings()

        # Ensure no previous instances are running and start bridge
        _start_bridge()

        gemini_client = GeminiClient(_settings)
        whatsapp_client = WhatsAppClient(_settings)
        _service = NovaService(gemini_client, whatsapp_client)
        _startup_error = None
        
        # Initialize Gmail client
        try:
            _gmail_client = GmailClient(
                credentials_path=_settings.gmail_credentials_path,
                token_path=_settings.gmail_token_path
            )
            if _gmail_client.is_authenticated:
                print(f"Gmail connected: {_gmail_client.user_email}")
            else:
                print("Gmail not authenticated. Use /api/gmail/auth to connect.")
            
            # Connect Gmail to suggestion service and Gemini client for AI commands
            if _service:
                from nova_ai_agent.gmail_tools import GmailAITools
                gmail_tools = GmailAITools(_gmail_client)
                _service.set_gmail_tools(gmail_tools)
                _service._gemini.set_tools(gmail_tools)
                print("Gmail tools connected to AI service (with function calling)")
        except Exception as e:
            print(f"Failed to initialize Gmail client: {e}")
            _gmail_client = None
        
        # Initialize OpenCode client for agentic coding
        try:
            # Start OpenCode server if auto_start is enabled
            if _settings.opencode_auto_start:
                _start_opencode()
            
            _opencode_client = OpenCodeClient(base_url=_settings.opencode_base_url)
            if _service:
                _service._gemini.set_opencode_client(_opencode_client)
                print(f"OpenCode client connected (base URL: {_settings.opencode_base_url})")
        except Exception as e:
            print(f"Failed to initialize OpenCode client: {e}")
            _opencode_client = None

    except Exception as exc:
        _service = None
        _startup_error = f"{type(exc).__name__}: {str(exc)}"
        print(f"Startup failed: {_startup_error}")



def _ensure_go_installed() -> Optional[str]:
    """
    Check if Go is installed. If not, download and install it.
    Returns the path to the go executable, or None if installation failed.
    """
    # Check if go is already available
    try:
        result = subprocess.run(["go", "version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"Go is installed: {result.stdout.strip()}")
            return "go"
    except FileNotFoundError:
        pass

    # Check common installation path on Windows
    go_default_path = Path("C:/Program Files/Go/bin/go.exe")
    if go_default_path.exists():
        print(f"Found Go at {go_default_path}")
        return str(go_default_path)

    print("Go is not installed. Attempting to install...")

    # Download Go installer
    go_version = "1.23.4"
    go_installer_url = f"https://go.dev/dl/go{go_version}.windows-amd64.msi"

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            installer_path = Path(tmpdir) / "go_installer.msi"
            print(f"Downloading Go {go_version} from {go_installer_url}...")

            urllib.request.urlretrieve(go_installer_url, installer_path)
            print("Download complete. Installing Go (this may take a minute)...")

            # Run MSI installer silently
            result = subprocess.run(
                ["msiexec", "/i", str(installer_path), "/quiet", "/norestart"],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print("Go installed successfully.")
                # Return the path since it won't be in PATH for current process
                if go_default_path.exists():
                    return str(go_default_path)
            else:
                print(f"Go installation failed (exit code {result.returncode})")
                print("Please install Go manually from https://go.dev/dl/")
                return None

    except Exception as e:
        print(f"Failed to download/install Go: {e}")
        print("Please install Go manually from https://go.dev/dl/")
        return None

    return None


def _ensure_gcc_installed() -> Optional[str]:
    """
    Check if GCC is installed. If not, download and install MinGW-w64.
    Returns the path to the mingw64 bin directory, or None if installation failed.
    """
    mingw_path = Path("C:/mingw64/bin")
    gcc_path = mingw_path / "gcc.exe"

    # Check if gcc is already available in PATH
    try:
        result = subprocess.run(["gcc", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print("GCC is installed (found in PATH)")
            return None  # No need to add to PATH
    except FileNotFoundError:
        pass

    # Check common installation path
    if gcc_path.exists():
        print(f"Found GCC at {gcc_path}")
        return str(mingw_path)

    print("GCC is not installed. Attempting to install MinGW-w64...")

    # Download MinGW-w64 from winlibs (portable, no installer needed)
    # Using GCC 15.2.0 MSVCRT release (stable, widely compatible)
    mingw_url = "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.2.0posix-13.0.0-msvcrt-r5/winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64msvcrt-13.0.0-r5.zip"

    try:
        # Download to a temp file
        print("Downloading MinGW-w64 (~400MB, this may take a few minutes)...")
        zip_path = Path(tempfile.gettempdir()) / "mingw64.zip"

        urllib.request.urlretrieve(mingw_url, zip_path)
        print("Download complete. Extracting to C:\\mingw64...")

        # Extract to C:\mingw64
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall("C:/")

        # Clean up zip
        zip_path.unlink()

        if gcc_path.exists():
            print("MinGW-w64 installed successfully.")
            return str(mingw_path)
        else:
            print("Installation completed but gcc.exe not found.")
            return None

    except Exception as e:
        print(f"Failed to download/install MinGW-w64: {e}")
        print("Please install MinGW-w64 manually from https://winlibs.com/")
        return None


def _start_bridge():
    global _bridge_process, _settings

    # 1. Check for existing bridge (Zombie protection)
    try:
        # Check if main.exe is already in the process list
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq main.exe'],
                              capture_output=True, text=True)
        if "main.exe" in result.stdout:
            print("Found existing WhatsApp Bridge (main.exe). Skipping startup to avoid duplicates.")
            print("Note: Bridge logs will not be visible in this window.")
            return
    except Exception as e:
        print(f"Warning: Failed to check for existing bridge: {e}")

    # 2. Cleanup existing processes (if we didn't return above)
    try:
        subprocess.run(["taskkill", "/F", "/IM", "main.exe"], 
                      stdout=subprocess.DEVNULL, 
                      stderr=subprocess.DEVNULL,
                      check=False)
        time.sleep(1) # Wait a bit for release
    except Exception:
        pass

    # 3. Start new process (auto-build if missing)
    try:
        bridge_dir = Path(__file__).parents[1] / "whatsapp-mcp" / "whatsapp-bridge"
        bridge_path = bridge_dir / "main.exe"

        # Auto-build if executable doesn't exist
        if not bridge_path.exists():
            print("WhatsApp Bridge executable not found. Building from source...")
            main_go = bridge_dir / "main.go"
            if not main_go.exists():
                print(f"Cannot build: main.go not found at {main_go}")
                return

            # Ensure Go is installed (auto-install if needed)
            go_cmd = _ensure_go_installed()
            if not go_cmd:
                print("Cannot build WhatsApp Bridge: Go is not available.")
                return

            # Ensure GCC is installed for CGO (required by go-sqlite3)
            gcc_bin_path = _ensure_gcc_installed()

            # Prepare build environment with CGO enabled
            build_env = os.environ.copy()
            build_env["CGO_ENABLED"] = "1"

            # Add GCC to PATH if we installed it
            if gcc_bin_path:
                build_env["PATH"] = gcc_bin_path + os.pathsep + build_env.get("PATH", "")
                print(f"Added {gcc_bin_path} to PATH for CGO build")

            print("Building WhatsApp Bridge (this may take a minute on first run)...")
            result = subprocess.run(
                [go_cmd, "build", "-o", "main.exe"],
                cwd=str(bridge_dir),
                capture_output=True,
                text=True,
                env=build_env
            )
            if result.returncode == 0:
                print("WhatsApp Bridge built successfully.")
            else:
                print(f"Failed to build WhatsApp Bridge: {result.stderr}")
                return

        print(f"Starting WhatsApp Bridge at {bridge_path}")

        # Prepare bridge environment
        bridge_env = os.environ.copy()

        # CRITICAL: Tell bridge where the backend is (Port 80 for nova.ai)
        bridge_env["NOVA_AGENT_URL"] = "http://localhost:80/nova"
        print("Configured bridge to send messages to http://localhost:80/nova")

        _bridge_process = subprocess.Popen(
            [str(bridge_path)],
            cwd=str(bridge_dir),
            stdout=sys.stdout,
            stderr=sys.stderr,
            env=bridge_env
        )
    except Exception as e:
        print(f"Failed to start WhatsApp Bridge: {e}")


def _start_opencode():
    """Start the bundled OpenCode server as a subprocess."""
    global _opencode_process, _settings
    
    if not _settings:
        print("[OpenCode] Settings not loaded, cannot start OpenCode")
        return
    
    opencode_path = Path(_settings.opencode_path)
    
    if not opencode_path.exists():
        print(f"[OpenCode] OpenCode directory not found at {opencode_path}")
        return
    
    # 1. Check if OpenCode server is already running (via HTTP health check)
    try:
        import requests
        response = requests.get(f"{_settings.opencode_base_url}/app", timeout=2)
        if response.status_code == 200:
            print("[OpenCode] Server already running, skipping startup.")
            return
    except Exception:
        pass  # Server not running, will start it
    
    # 2. Check if we need to build (node_modules doesn't exist)
    node_modules = opencode_path / "node_modules"
    if not node_modules.exists():
        print("[OpenCode] Building OpenCode (first time setup)...")
        try:
            # Run npm install
            result = subprocess.run(
                "npm install" if os.name == 'nt' else ["npm", "install"],
                cwd=str(opencode_path),
                shell=(os.name == 'nt'),
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout for npm install
            )
            if result.returncode != 0:
                print(f"[OpenCode] npm install failed: {result.stderr[:500]}")
                return
            print("[OpenCode] npm install completed successfully")
            
            # Run npm run build
            result = subprocess.run(
                "npm run build" if os.name == 'nt' else ["npm", "run", "build"],
                cwd=str(opencode_path),
                shell=(os.name == 'nt'),
                capture_output=True,
                text=True,
                timeout=300
            )
            if result.returncode != 0:
                print(f"[OpenCode] npm run build failed: {result.stderr[:500]}")
                return
            print("[OpenCode] Build completed successfully")
        except subprocess.TimeoutExpired:
            print("[OpenCode] Build timed out (5 minutes)")
            return
        except Exception as e:
            print(f"[OpenCode] Build failed: {e}")
            return
    
    # 3. Start the OpenCode server
    try:
        print(f"[OpenCode] Starting server from {opencode_path}...")
        
        # Use CREATE_NO_WINDOW on Windows to avoid console popup
        creation_flags = 0
        if os.name == 'nt':
            creation_flags = subprocess.CREATE_NO_WINDOW
        
        _opencode_process = subprocess.Popen(
            "npx opencode serve" if os.name == 'nt' else ["npx", "opencode", "serve"],
            cwd=str(opencode_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=(os.name == 'nt'),
            creationflags=creation_flags if os.name == 'nt' else 0
        )
        
        # Wait a moment for server to start
        time.sleep(3)
        
        # Check if process is still running
        if _opencode_process.poll() is not None:
            _, stderr = _opencode_process.communicate()
            print(f"[OpenCode] Server failed to start: {stderr.decode()[:500]}")
            _opencode_process = None
            return
        
        print(f"[OpenCode] Server started successfully (PID: {_opencode_process.pid})")
        
    except FileNotFoundError:
        print("[OpenCode] npx not found. Ensure Node.js is installed.")
    except Exception as e:
        print(f"[OpenCode] Failed to start server: {e}")


@app.post("/api/bridge/restart")
async def restart_bridge():
    """Restart the WhatsApp Bridge process."""
    try:
        if _bridge_process:
            _bridge_process.terminate()
            try:
                _bridge_process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                _bridge_process.kill()
        
        _start_bridge()
        return {"success": True, "message": "Bridge restarted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
def shutdown_event() -> None:
    global _bridge_process, _opencode_process
    if _bridge_process:
        print("Stopping WhatsApp Bridge...")
        _bridge_process.terminate()
        try:
            _bridge_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _bridge_process.kill()
    
    if _opencode_process:
        print("Stopping OpenCode server...")
        _opencode_process.terminate()
        try:
            _opencode_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _opencode_process.kill()

@app.get("/api/status", response_model=SystemStatus)
async def get_status():
    uptime = time.time() - _start_time
    gemini_ok = False
    
    monitoring_status = {"paired": False, "connected": False, "connecting": False}
    replying_status = {"paired": False, "connected": False, "connecting": False}
    
    monitoring_qr = None
    replying_qr = None
    
    if _service:
        gemini_ok = _service._gemini is not None
        if _service._whatsapp:
            ws_status = _service._whatsapp.get_status()
            monitoring_status = ws_status.get("monitoring", monitoring_status)
            replying_status = ws_status.get("replying", replying_status)
            
            if not monitoring_status.get("paired"):
                monitoring_qr = _service._whatsapp.get_qr("monitoring")
                
            if not replying_status.get("paired"):
                replying_qr = _service._whatsapp.get_qr("replying")

    return SystemStatus(
        uptime_seconds=uptime,
        gemini_connected=gemini_ok,
        monitoring=SessionStatus(
            connected=monitoring_status.get("connected", False),
            paired=monitoring_status.get("paired", False),
            connecting=monitoring_status.get("connecting", False),
            qr=monitoring_qr
        ),
        replying=SessionStatus(
            connected=replying_status.get("connected", False),
            paired=replying_status.get("paired", False),
            connecting=replying_status.get("connecting", False),
            qr=replying_qr
        ),
        total_suggestions=_service.total_count if _service else 0,
        failed_suggestions=_service.failure_count if _service else 0
    )

@app.get("/api/logs", response_model=List[ActivityLogEntry])
async def get_logs():
    if not _service:
        return []
    # Return last 50 logs, reversed
    return _service.logs[-50:][::-1]

@app.get("/api/config", response_model=SystemConfig)
async def get_config():
    if not _settings:
        raise HTTPException(status_code=500, detail="Settings not loaded")

    return SystemConfig(
        gemini_model=_settings.gemini_model,
        whatsapp_bridge_url=_settings.whatsapp_bridge_base_url,
        whatsapp_db_path=_settings.whatsapp_db_path,
        whatsapp_group_jid=_settings.whatsapp_group_jid
    )


# =============================================================================
# Research Mode API Endpoints (Google Search & URL Context)
# =============================================================================

@app.get("/api/research-mode")
async def get_research_mode():
    """Get current research mode settings (Google Search Grounding & URL Context).
    
    Research Mode enables real-time web search and URL content analysis,
    but disables function calling tools (Gmail, OpenCode, WhatsApp) when active.
    """
    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")
    
    return {
        "google_search_enabled": _service._gemini._google_search_enabled,
        "url_context_enabled": _service._gemini._url_context_enabled,
        "is_active": _service._gemini.is_research_mode_enabled(),
        "description": "When Research Mode is active, function calling tools are disabled."
    }


@app.patch("/api/research-mode")
async def update_research_mode(google_search_enabled: bool = None, url_context_enabled: bool = None):
    """Update research mode settings.
    
    NOTE: Research Mode and function calling tools cannot be used together.
    Enabling Research Mode will disable Gmail, OpenCode, and WhatsApp tools.
    """
    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")
    
    # Get current values if not provided
    current = _service._gemini.get_research_mode()
    new_google_search = google_search_enabled if google_search_enabled is not None else current["google_search_enabled"]
    new_url_context = url_context_enabled if url_context_enabled is not None else current["url_context_enabled"]
    
    # Update the Gemini client
    _service._gemini.set_research_mode(new_google_search, new_url_context)
    
    # Also update environment variables for persistence
    try:
        env_updates = {}
        if google_search_enabled is not None:
            env_updates["GOOGLE_SEARCH_ENABLED"] = str(google_search_enabled).lower()
        if url_context_enabled is not None:
            env_updates["URL_CONTEXT_ENABLED"] = str(url_context_enabled).lower()
        
        if env_updates:
            _update_research_mode_env(env_updates)
    except Exception as e:
        print(f"Warning: Failed to persist research mode settings: {e}")
    
    return {
        "google_search_enabled": new_google_search,
        "url_context_enabled": new_url_context,
        "is_active": new_google_search or new_url_context,
        "message": "Research mode settings updated successfully"
    }


def _update_research_mode_env(updates: dict):
    """Update research mode environment variables in .env file."""
    env_path = Path(".env")
    if not env_path.exists():
        # Create .env with the new settings
        with open(env_path, "w") as f:
            for key, value in updates.items():
                f.write(f"{key}={value}\n")
        return
    
    with open(env_path, "r") as f:
        lines = f.readlines()
    
    new_lines = []
    keys_updated = set()
    
    for line in lines:
        matched = False
        for key, value in updates.items():
            if line.startswith(f"{key}="):
                new_lines.append(f"{key}={value}\n")
                keys_updated.add(key)
                matched = True
                break
        if not matched:
            new_lines.append(line)
    
    # Add new keys if not present
    for key, value in updates.items():
        if key not in keys_updated:
            new_lines.append(f"{key}={value}\n")
    
    with open(env_path, "w") as f:
        f.writelines(new_lines)

def update_env_file(updates: dict):
    env_path = Path(".env")
    if not env_path.exists():
        return
    
    with open(env_path, "r") as f:
        lines = f.readlines()
    
    new_lines = []
    keys_updated = set()

    mapping = {
        "gemini_api_key": "GEMINI_API_KEY",
        "gemini_model": "GEMINI_MODEL",
        "whatsapp_bridge_url": "WHATSAPP_BRIDGE_URL"
    }
    
    for line in lines:
        matched = False
        for key, env_key in mapping.items():
            if line.startswith(f"{env_key}=") and updates.get(key) is not None:
                new_lines.append(f"{env_key}={updates[key]}\n")
                keys_updated.add(key)
                matched = True
                break
        if not matched:
            new_lines.append(line)
            
    # Add new keys if not present
    for key, env_key in mapping.items():
        if key not in keys_updated and updates.get(key) is not None:
            new_lines.append(f"{env_key}={updates[key]}\n")
            
    with open(env_path, "w") as f:
        f.writelines(new_lines)

@app.patch("/api/config")
async def update_config(payload: ConfigUpdate):
    global _settings, _service
    try:
        updates = payload.dict(exclude_unset=True)
        update_env_file(updates)
        
        # Also update os.environ so get_settings() picks up the changes
        env_mapping = {
            "gemini_api_key": "GEMINI_API_KEY",
            "gemini_model": "GEMINI_MODEL",
            "whatsapp_bridge_url": "WHATSAPP_BRIDGE_URL"
        }
        for key, env_key in env_mapping.items():
            if key in updates and updates[key] is not None:
                os.environ[env_key] = updates[key]
        
        # Clear the lru_cache on get_settings to force reload
        from nova_ai_agent.config import get_settings as gs
        gs.cache_clear()
        
        # Reload settings
        _settings = get_settings()
        
        # Reinitialize Gemini client if API key or model changed
        if "gemini_api_key" in updates or "gemini_model" in updates:
            try:
                gemini_client = GeminiClient(_settings)
                whatsapp_client = WhatsAppClient(_settings)
                _service = NovaService(gemini_client, whatsapp_client)
                
                # Reconnect Gmail tools if available
                if _gmail_client:
                    from nova_ai_agent.gmail_tools import GmailAITools
                    gmail_tools = GmailAITools(_gmail_client)
                    _service.set_gmail_tools(gmail_tools)
                    _service._gemini.set_tools(gmail_tools)

                # Reconnect OpenCode client if available
                if _opencode_client:
                    _service._gemini.set_opencode_client(_opencode_client)
            except Exception as e:
                print(f"Warning: Failed to reinitialize service: {e}")
        
        return {"message": "Configuration updated successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {exc}")

@app.post("/api/whatsapp/reconnect")
async def whatsapp_reconnect(session: str):
    if not _service or not _service._whatsapp:
        raise HTTPException(status_code=503, detail="WhatsApp client not initialized")
    
    if session not in ["monitoring", "replying"]:
        raise HTTPException(status_code=400, detail="Invalid session name")

    success = _service._whatsapp.reconnect(session)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to trigger WhatsApp reconnection")
    return {"message": f"Reconnection triggered for {session}"}

@app.post("/api/whatsapp/unpair")
async def whatsapp_unpair(session: str):
    if not _service or not _service._whatsapp:
        raise HTTPException(status_code=503, detail="WhatsApp client not initialized")
    
    if session not in ["monitoring", "replying"]:
        raise HTTPException(status_code=400, detail="Invalid session name")
    
    success = _service._whatsapp.unpair(session)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to trigger WhatsApp unpairing")
    return {"message": f"Unpairing triggered for {session}"}

@app.post("/nova", response_model=NovaResponse, status_code=status.HTTP_201_CREATED)
async def create_response(payload: NovaPayload) -> NovaResponse:
    if _startup_error:
        raise HTTPException(status_code=500, detail=f"Service misconfigured: {_startup_error}")

    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")

    try:
        result = await run_in_threadpool(_service.generate_and_send, payload)
        return NovaResponse(success=True, result=result)
    except ConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except GeminiError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except WhatsAppError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:  # pragma: no cover - safeguard
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}") from exc


# =============================================================================
# Agent Chat API (Dashboard Chat UI with SSE streaming)
# =============================================================================

import json
import asyncio
from queue import Queue
from threading import Thread


@app.post("/api/agent/chat")
async def agent_chat_stream(request: AgentChatRequest):
    """Stream agent responses via Server-Sent Events (SSE).
    
    This endpoint is used by the dashboard chat UI to communicate with the AI agent
    and see tool calls, thinking, and responses in real-time.
    """
    if _startup_error:
        raise HTTPException(status_code=500, detail=f"Service misconfigured: {_startup_error}")
    
    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")
    
    # Use a queue for true real-time streaming
    event_queue: Queue = Queue()
    
    def run_generator():
        """Run the generator in a background thread and put events in queue."""
        try:
            for event in _service._gemini.generate_suggestion_stream(request.message):
                event_queue.put(event)
        except Exception as exc:
            event_queue.put({"type": "error", "content": str(exc)[:200]})
        finally:
            event_queue.put({"type": "done"})
            event_queue.put(None)  # Sentinel to signal completion
    
    # Start the generator in a background thread
    thread = Thread(target=run_generator, daemon=True)
    thread.start()
    
    async def event_generator():
        """Async generator that yields events from the queue as they arrive."""
        while True:
            # Check queue periodically
            while event_queue.empty():
                await asyncio.sleep(0.05)  # 50ms polling
            
            event = event_queue.get()
            
            if event is None:  # Sentinel - we're done
                break
            
            # Format as SSE: data: {json}\n\n
            event_json = json.dumps(event)
            yield f"data: {event_json}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# =============================================================================
# Chat History API Endpoints
# =============================================================================

@app.get("/api/chats", response_model=List[ConversationListItem])
async def list_conversations(page: int = 0, limit: int = 50):
    """List all conversations, paginated, sorted by updated_at desc."""
    try:
        conversations = chat_db.get_conversations(page=page, limit=limit)
        return conversations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {str(e)}")


@app.post("/api/chats", response_model=ConversationData)
async def create_conversation(request: CreateConversationRequest = None):
    """Create a new conversation."""
    try:
        title = request.title if request else None
        conversation = chat_db.create_conversation(title=title)
        conversation["messages"] = []
        return conversation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {str(e)}")


@app.get("/api/chats/{conversation_id}", response_model=ConversationData)
async def get_conversation(conversation_id: str):
    """Get a conversation with all its messages."""
    try:
        conversation = chat_db.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")


@app.delete("/api/chats/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation and all its messages."""
    try:
        deleted = chat_db.delete_conversation(conversation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True, "message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {str(e)}")


@app.patch("/api/chats/{conversation_id}", response_model=ConversationData)
async def update_conversation(conversation_id: str, request: UpdateConversationRequest):
    """Rename a conversation."""
    try:
        updated = chat_db.update_conversation(conversation_id, request.title)
        if not updated:
            raise HTTPException(status_code=404, detail="Conversation not found")
        # Return the updated conversation
        conversation = chat_db.get_conversation(conversation_id)
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update conversation: {str(e)}")


@app.delete("/api/chats")
async def delete_all_chats():
    """Delete all conversations."""
    count = chat_db.delete_all_conversations()
    return {"message": f"Deleted {count} conversations"}


@app.post("/api/chats/{conversation_id}/generate-title")
async def generate_conversation_title(conversation_id: str, request: GenerateTitleRequest):
    """Generate a short AI-powered title for a conversation.

    Uses the provided user message to generate a 2-3 word title.
    Runs in parallel with the AI response generation.
    """
    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")

    # Verify conversation exists
    conversation = chat_db.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Use the message from the request body (no race condition)
    user_message = request.message
    if not user_message:
        return {"title": None, "message": "No message provided"}

    try:
        # Generate title using Gemini
        title = await run_in_threadpool(
            _service._gemini.generate_chat_title,
            user_message
        )

        if title:
            # Update the conversation title
            chat_db.update_conversation(conversation_id, title)
            return {"title": title, "success": True}
        else:
            return {"title": None, "message": "Failed to generate title"}
    except Exception as e:
        return {"title": None, "message": f"Error generating title: {str(e)}"}


@app.post("/api/chats/{conversation_id}/messages")
async def send_chat_message(conversation_id: str, request: ChatMessageRequest):
    """Send a message to an existing conversation with SSE streaming.
    
    This endpoint stores the user message, generates an AI response with full
    conversation context, streams events via SSE, and stores the assistant response.
    """
    if _startup_error:
        raise HTTPException(status_code=500, detail=f"Service misconfigured: {_startup_error}")
    
    if _service is None:
        raise HTTPException(status_code=503, detail="Nova service not ready")
    
    # Verify conversation exists
    conversation = chat_db.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Store user message
    user_message = chat_db.add_message(
        conversation_id=conversation_id,
        role="user",
        content=request.message
    )
    
    # Auto-generate title from first message if this is the first user message
    user_messages = [m for m in conversation.get("messages", []) if m["role"] == "user"]
    if len(user_messages) == 0:
        chat_db.update_conversation_title_from_message(conversation_id, request.message)
    
    # Build chat history for LLM context
    chat_history = []
    for msg in conversation.get("messages", []):
        chat_history.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    
    # Use a queue for true real-time streaming
    event_queue: Queue = Queue()

    # Generate message ID upfront for tracking
    import uuid as uuid_module
    assistant_message_id = str(uuid_module.uuid4())

    # Create the assistant message immediately with status='streaming'
    chat_db.add_message(
        conversation_id=conversation_id,
        role="assistant",
        content="",
        status="streaming",
        message_id=assistant_message_id
    )

    # Collect assistant response data for storage
    response_data = {
        "content_parts": [],
        "tool_calls": [],
        "thinking": [],
        "trace_log": []
    }

    # Track last save time for periodic updates
    last_save_time = [time.time()]
    SAVE_INTERVAL = 1.0  # Save every 1 second during streaming

    def save_progress():
        """Save current streaming progress to database."""
        final_content = "\n".join(response_data["content_parts"]).strip()
        chat_db.update_message(
            message_id=assistant_message_id,
            content=final_content,
            tool_calls=response_data["tool_calls"] if response_data["tool_calls"] else None,
            thinking=response_data["thinking"] if response_data["thinking"] else None,
            trace_log=response_data["trace_log"] if response_data["trace_log"] else None
        )
        last_save_time[0] = time.time()

    def run_generator():
        """Run the generator in a background thread and put events in queue."""
        try:
            for event in _service._gemini.generate_suggestion_stream(
                message=request.message,
                chat_history=chat_history,
                model_override=request.model_override
            ):
                event_queue.put(event)

                # Logic to maintain high-fidelity trace log (compressed)
                event_type = event.get("type")
                if event_type == "text":
                    content = event.get("content", "")
                    last_trace = response_data["trace_log"][-1] if response_data["trace_log"] else None
                    if last_trace and last_trace["type"] == "text":
                        last_trace["content"] += content
                    else:
                        response_data["trace_log"].append({"type": "text", "content": content})

                elif event_type == "thinking":
                    content = event.get("content", "")
                    last_trace = response_data["trace_log"][-1] if response_data["trace_log"] else None
                    if last_trace and last_trace["type"] == "thinking":
                        last_trace["content"] += content
                    else:
                        response_data["trace_log"].append({"type": "thinking", "content": content})

                elif event_type in ["tool_call_start", "tool_call_result"]:
                    # Store discrete tool events
                    response_data["trace_log"].append(dict(event))

                # Collect legacy data fields for backward compatibility
                if event_type == "text":
                    response_data["content_parts"].append(event.get("content", ""))
                elif event_type == "tool_call_start":
                    response_data["tool_calls"].append({
                        "name": event.get("name"),
                        "args": event.get("args", {}),
                        "result": None
                    })
                elif event_type == "tool_call_result":
                    # Update the last tool call with its result
                    if response_data["tool_calls"]:
                        response_data["tool_calls"][-1]["result"] = event.get("result")
                elif event_type == "thinking":
                    thinking_content = event.get("content", "")
                    if thinking_content:
                        if response_data["thinking"]:
                            response_data["thinking"][-1] += thinking_content
                        else:
                            response_data["thinking"].append(thinking_content)

                # Periodically save progress to database
                if time.time() - last_save_time[0] >= SAVE_INTERVAL:
                    save_progress()

        except Exception as exc:
            event_queue.put({"type": "error", "content": str(exc)[:200]})
        finally:
            # Save final state and mark as complete
            final_content = "\n".join(response_data["content_parts"]).strip()
            if final_content or response_data["tool_calls"]:
                chat_db.update_message(
                    message_id=assistant_message_id,
                    content=final_content,
                    tool_calls=response_data["tool_calls"] if response_data["tool_calls"] else None,
                    thinking=response_data["thinking"] if response_data["thinking"] else None,
                    trace_log=response_data["trace_log"] if response_data["trace_log"] else None,
                    status="complete"
                )
            else:
                # No content generated - mark as complete anyway
                chat_db.update_message(
                    message_id=assistant_message_id,
                    status="complete"
                )

            event_queue.put({"type": "done"})
            event_queue.put(None)  # Sentinel to signal completion
    
    # Start the generator in a background thread
    thread = Thread(target=run_generator, daemon=True)
    thread.start()
    
    async def event_generator():
        """Async generator that yields events from the queue as they arrive."""
        while True:
            # Check queue periodically
            while event_queue.empty():
                await asyncio.sleep(0.05)  # 50ms polling
            
            event = event_queue.get()
            
            if event is None:  # Sentinel - we're done
                break
            
            # Format as SSE: data: {json}\n\n
            event_json = json.dumps(event)
            yield f"data: {event_json}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# =============================================================================
# Gmail API Endpoints
# =============================================================================

@app.get("/api/gmail/status", response_model=GmailStatus)
async def gmail_status():
    """Get Gmail connection status."""
    if not _gmail_client:
        return GmailStatus(
            connected=False,
            email=None,
            needs_auth=True,
            credentials_found=False
        )
    
    # Proactively refresh token if expired to prevent false "disconnected" status
    _gmail_client.refresh_if_needed()
    
    return GmailStatus(
        connected=_gmail_client.is_authenticated,
        email=_gmail_client.user_email,
        needs_auth=_gmail_client.needs_auth,
        credentials_found=Path(_gmail_client.credentials_path).exists()
    )


@app.post("/api/gmail/upload-credentials")
async def gmail_upload_credentials(file: UploadFile = File(...)):
    """Upload Gmail OAuth2 credentials JSON file."""
    global _gmail_client, _settings
    
    if not file.filename or not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")
    
    try:
        # Read the uploaded file content
        content = await file.read()
        
        # Validate it's valid JSON
        import json
        try:
            json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON file")
        
        # Save to project root
        creds_path = Path(_settings.gmail_credentials_path) if _settings else Path("gmail_credentials.json")
        if not creds_path.is_absolute():
            creds_path = Path(__file__).parents[1] / creds_path
        
        with open(creds_path, 'wb') as f:
            f.write(content)
        
        # Reinitialize Gmail client
        if _settings:
            _gmail_client = GmailClient(
                credentials_path=str(creds_path),
                token_path=_settings.gmail_token_path
            )
        
        return {
            "success": True, 
            "message": "Credentials uploaded successfully",
            "path": str(creds_path)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save credentials: {str(e)}")


@app.get("/api/gmail/setup-guide")
async def gmail_setup_guide():
    """Get Gmail setup instructions."""
    return {
        "steps": [
            {
                "step": 1,
                "title": "Go to Google Cloud Console",
                "description": "Visit console.cloud.google.com and create a new project or select an existing one.",
                "link": "https://console.cloud.google.com/"
            },
            {
                "step": 2,
                "title": "Enable Gmail API",
                "description": "Go to APIs & Services > Library, search for 'Gmail API' and click Enable.",
                "link": "https://console.cloud.google.com/apis/library/gmail.googleapis.com"
            },
            {
                "step": 3,
                "title": "Configure OAuth Consent Screen",
                "description": "Go to APIs & Services > OAuth consent screen. Select 'External', set app name to 'Nova', fill in your email, then add your email as a test user."
            },
            {
                "step": 4,
                "title": "Create OAuth Credentials",
                "description": "Go to APIs & Services > Credentials, click 'Create Credentials' > 'OAuth client ID', select 'Desktop app', then download the JSON file."
            },
            {
                "step": 5,
                "title": "Upload Credentials",
                "description": "Use the upload button below to upload the downloaded JSON file."
            },
            {
                "step": 6,
                "title": "Connect Gmail",
                "description": "Click 'Connect Gmail' to authorize access to your Gmail account."
            }
        ]
    }


@app.get("/api/gmail/auth")
async def gmail_auth():
    """Get OAuth2 authorization URL for Gmail."""
    if not _gmail_client:
        raise HTTPException(status_code=503, detail="Gmail client not initialized")
    
    # Use the configured redirect URI
    redirect_uri = "http://localhost/api/gmail/callback"
    auth_url = _gmail_client.get_auth_url(redirect_uri)
    
    if not auth_url:
        raise HTTPException(
            status_code=400, 
            detail="Cannot generate auth URL. Ensure gmail_credentials.json exists in project root."
        )
    
    return {"auth_url": auth_url}


@app.get("/api/gmail/callback")
async def gmail_callback(code: str, state: Optional[str] = None):
    """Handle OAuth2 callback from Google."""
    if not _gmail_client:
        raise HTTPException(status_code=503, detail="Gmail client not initialized")
    
    redirect_uri = "http://localhost/api/gmail/callback"
    success = _gmail_client.authenticate_with_code(code, redirect_uri)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Gmail")
    
    # Redirect to frontend with success message
    return RedirectResponse(url="/?gmail=connected")


@app.get("/api/gmail/messages")
async def gmail_list_messages(
    q: str = "",
    max_results: int = 10,
    page_token: Optional[str] = None
):
    """List Gmail messages with optional search query."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    result = await run_in_threadpool(
        _gmail_client.list_messages,
        query=q,
        max_results=max_results,
        page_token=page_token
    )
    
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    
    return result


@app.get("/api/gmail/messages/{message_id}")
async def gmail_get_message(message_id: str):
    """Get a specific Gmail message by ID."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    message = await run_in_threadpool(_gmail_client.get_message, message_id)
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@app.get("/api/gmail/threads/{thread_id}")
async def gmail_get_thread(thread_id: str):
    """Get all messages in a Gmail thread."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    thread = await run_in_threadpool(_gmail_client.get_thread, thread_id)
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    return thread


@app.post("/api/gmail/send")
async def gmail_send_email(request: SendEmailRequest):
    """Send an email via Gmail."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    if request.html:
        result = await run_in_threadpool(
            _gmail_client.send_html_email,
            to=request.to,
            subject=request.subject,
            html_body=request.body,
            cc=request.cc,
            bcc=request.bcc
        )
    else:
        result = await run_in_threadpool(
            _gmail_client.send_email,
            to=request.to,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
            bcc=request.bcc
        )
    
    if not result:
        raise HTTPException(status_code=502, detail="Failed to send email")
    
    return {"success": True, "message": result}


@app.post("/api/gmail/drafts")
async def gmail_create_draft(request: CreateDraftRequest):
    """Create an email draft."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    result = await run_in_threadpool(
        _gmail_client.create_draft,
        to=request.to,
        subject=request.subject,
        body=request.body,
        html=request.html
    )
    
    if not result:
        raise HTTPException(status_code=502, detail="Failed to create draft")
    
    return {"success": True, "draft": result}


@app.get("/api/gmail/labels")
async def gmail_list_labels():
    """List all Gmail labels."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    labels = await run_in_threadpool(_gmail_client.list_labels)
    return {"labels": labels}


@app.post("/api/gmail/messages/{message_id}/read")
async def gmail_mark_read(message_id: str):
    """Mark a message as read."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    success = await run_in_threadpool(_gmail_client.mark_as_read, message_id)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to mark message as read")
    
    return {"success": True}


@app.post("/api/gmail/messages/{message_id}/unread")
async def gmail_mark_unread(message_id: str):
    """Mark a message as unread."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    success = await run_in_threadpool(_gmail_client.mark_as_unread, message_id)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to mark message as unread")
    
    return {"success": True}


@app.post("/api/gmail/messages/{message_id}/trash")
async def gmail_trash_message(message_id: str):
    """Move a message to trash."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    success = await run_in_threadpool(_gmail_client.trash_message, message_id)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to trash message")
    
    return {"success": True}


@app.delete("/api/gmail/messages/{message_id}")
async def gmail_delete_message(message_id: str):
    """Permanently delete a message."""
    if not _gmail_client or not _gmail_client.is_authenticated:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    
    success = await run_in_threadpool(_gmail_client.delete_message, message_id)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to delete message")
    
    return {"success": True}


@app.post("/api/gmail/logout")
async def gmail_logout():
    """Disconnect Gmail and remove stored credentials."""
    if not _gmail_client:
        raise HTTPException(status_code=503, detail="Gmail client not initialized")
    
    success = _gmail_client.logout()
    if not success:
        raise HTTPException(status_code=502, detail="Failed to logout from Gmail")
    
    return {"success": True, "message": "Gmail disconnected"}


# Mount static files at root (SPA support)
# Must be added after API routes to avoid shadowing them
app.mount("/", StaticFiles(directory=str(static_path), html=True), name="site")

