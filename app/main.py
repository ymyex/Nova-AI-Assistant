import time
import subprocess
import os
import sys
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, status, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

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
    EmailListResponse
)
from nova_ai_agent.nova_service import NovaService
from nova_ai_agent.gemini import GeminiClient
from nova_ai_agent.whatsapp import WhatsAppClient
from nova_ai_agent.gmail import GmailClient
from nova_ai_agent.opencode_client import OpenCodeClient

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



def _start_bridge():
    global _bridge_process, _settings
    
    # 1. Check for existing bridge (Zombie protection)
    try:
        # Check if main_v2.exe is already in the process list
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq main_v2.exe'], 
                              capture_output=True, text=True)
        if "main_v2.exe" in result.stdout:
            print("Found existing WhatsApp Bridge (main_v2.exe). Skipping startup to avoid duplicates.")
            print("Note: Bridge logs will not be visible in this window.")
            return
    except Exception as e:
        print(f"Warning: Failed to check for existing bridge: {e}")

    # 2. Cleanup existing processes (if we didn't return above)
    try:
        subprocess.run(["taskkill", "/F", "/IM", "main_v2.exe"], 
                      stdout=subprocess.DEVNULL, 
                      stderr=subprocess.DEVNULL,
                      check=False)
        time.sleep(1) # Wait a bit for release
    except Exception:
        pass

    # 2. Start new process
    try:
        bridge_path = Path(__file__).parents[1] / "whatsapp-mcp" / "whatsapp-bridge" / "main_v2.exe"
        if bridge_path.exists():
            print(f"Starting WhatsApp Bridge at {bridge_path}")
            
            # Prepare bridge environment
            bridge_env = os.environ.copy()
            # Map WHATSAPP_GROUP_NAME from config to NOVA_FORWARD_GROUP for the bridge
            if _settings.whatsapp_group_name:
                bridge_env["NOVA_FORWARD_GROUP"] = _settings.whatsapp_group_name
                print(f"Configured bridge to forward messages from group: '{_settings.whatsapp_group_name}'")
            
            # CRITICAL: Tell bridge where the backend is (Port 80 for nova.ai)
            bridge_env["NOVA_AGENT_URL"] = "http://localhost:80/nova"
            print("Configured bridge to send messages to http://localhost:80/nova")
            
            _bridge_process = subprocess.Popen(
                [str(bridge_path)],
                cwd=str(bridge_path.parent),
                stdout=sys.stdout,
                stderr=sys.stderr,
                env=bridge_env
            )
        else:
            print(f"WhatsApp Bridge not found at {bridge_path}")
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
        whatsapp_group_name=_settings.whatsapp_group_name,
        whatsapp_bridge_url=_settings.whatsapp_bridge_base_url,
        whatsapp_db_path=_settings.whatsapp_db_path,
        whatsapp_group_jid=_settings.whatsapp_group_jid
    )

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
        "whatsapp_group_name": "WHATSAPP_GROUP_NAME",
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
            "whatsapp_group_name": "WHATSAPP_GROUP_NAME",
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
                    _service._gemini.set_gmail_tools(gmail_tools)
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

