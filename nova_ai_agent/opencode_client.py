"""OpenCode Python SDK wrapper for Nova AI Agent.

This module provides a client for interacting with the OpenCode agentic coding tool.
OpenCode must be running in server mode (`opencode serve`) for these operations to work.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import json
import subprocess
import time
import os
import logging
import traceback
from datetime import datetime

# Configure OpenCode logger
logger = logging.getLogger("OpenCode")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(name)s %(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    ))
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)  # Set to DEBUG for detailed diagnostics

try:
    from opencode_ai import Opencode
    import opencode_ai
    OPENCODE_AVAILABLE = True
except ImportError:
    OPENCODE_AVAILABLE = False
    Opencode = None


class OpenCodeClient:
    """Client wrapper for the OpenCode Python SDK.
    
    Provides methods for session management, coding tasks, file operations,
    and status checks through the OpenCode agentic coding tool.
    """

    def __init__(self, base_url: str = "http://localhost:4096") -> None:
        """Initialize the OpenCode client.
        
        Args:
            base_url: The base URL of the OpenCode server (default: http://localhost:4096)
        """
        self._base_url = base_url
        self._client: Optional[Opencode] = None
        self._is_connected = False
        self._server_process: Optional[subprocess.Popen] = None
        self._current_project_path: Optional[str] = None
        self._init_time = datetime.now()
        self._last_request_time: Optional[datetime] = None
        self._request_count = 0
        
        logger.info(f"Initializing OpenCode client (base_url={base_url})")
        
        if not OPENCODE_AVAILABLE:
            logger.error("SDK not installed. Install with: pip install --pre opencode-ai")
            return
            
        try:
            self._client = Opencode(base_url=base_url)
            self._is_connected = True
            logger.info(f"Client initialized successfully (base_url={base_url})")
        except Exception as e:
            logger.error(f"Failed to initialize client: {e}")
            logger.debug(f"Initialization traceback:\n{traceback.format_exc()}")
            self._is_connected = False

    # ==================== Server Management ====================

    def start_server(self, project_path: str, wait_seconds: int = 5) -> str:
        """Start the OpenCode server on a specific project directory.
        
        Args:
            project_path: Absolute path to the project directory
            wait_seconds: Seconds to wait for server to start (default: 5)
            
        Returns:
            JSON string with status or error message
        """
        start_time = datetime.now()
        logger.info(f"=== START SERVER REQUEST ===")
        logger.info(f"Project path: {project_path}")
        logger.info(f"Wait seconds: {wait_seconds}")
        logger.debug(f"Current state: is_connected={self._is_connected}, "
                    f"has_process={self._server_process is not None}, "
                    f"current_path={self._current_project_path}")
        
        # Validate path exists
        if not os.path.isdir(project_path):
            logger.error(f"Directory does not exist: {project_path}")
            return json.dumps({
                "success": False,
                "error": f"Directory does not exist: {project_path}"
            })
        
        # Stop any existing server first
        if self._server_process:
            logger.info("Stopping existing server before starting new one")
            self.stop_server()
            time.sleep(1)
        
        try:
            logger.info(f"Starting OpenCode server on: {project_path}")
            
            # Use CREATE_NO_WINDOW on Windows to avoid console popup
            creation_flags = 0
            if os.name == 'nt':
                creation_flags = subprocess.CREATE_NO_WINDOW
            
            # Determine path to local OpenCode source
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            opencode_package_dir = os.path.join(project_root, "opencode", "packages", "opencode")
            opencode_src_path = os.path.join(opencode_package_dir, "src", "index.ts")

            # Default to global opencode command
            command = ["opencode", "serve"]
            # Directory to run the command from (where bunfig.toml is located)
            run_cwd = project_path
            
            if os.path.exists(opencode_src_path):
                logger.info(f"Using local source: {opencode_src_path}")
                logger.debug(f"OpenCode package dir: {opencode_package_dir}")
                # Must run from the opencode package directory for bunfig.toml to be read
                # (required for @opentui/solid preload which sets up JSX runtime)
                command = ["bun", "run", "--conditions=browser", opencode_src_path, "serve"]
                run_cwd = opencode_package_dir
            else:
                logger.info("Local source not found, falling back to global command")

            logger.debug(f"Command: {command}")
            logger.debug(f"Working directory: {run_cwd}")

            # Prepare command for subprocess
            if os.name == 'nt':
                # On Windows with shell=True, passing a string is often more reliable
                cmd_arg = subprocess.list2cmdline(command)
            else:
                cmd_arg = command

            self._server_process = subprocess.Popen(
                cmd_arg,
                cwd=run_cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=(os.name == 'nt'),
                creationflags=creation_flags
            )
            
            self._current_project_path = project_path
            logger.info(f"Server process started (PID: {self._server_process.pid})")
            
            # Poll for server readiness with retries instead of fixed wait
            max_wait_seconds = 30
            poll_interval = 1.0
            logger.info(f"Waiting up to {max_wait_seconds}s for server to become ready...")
            
            server_ready = False
            health_msg = "Unknown"
            for attempt in range(int(max_wait_seconds / poll_interval)):
                time.sleep(poll_interval)
                
                # Check if process is still running
                poll_result = self._server_process.poll()
                if poll_result is not None:
                    # Process ended, get error
                    _, stderr = self._server_process.communicate()
                    error_msg = stderr.decode()[:500]
                    logger.error(f"Server process exited with code {poll_result}")
                    logger.error(f"Server stderr: {error_msg}")
                    return json.dumps({
                        "success": False,
                        "error": f"Server failed to start: {error_msg}"
                    })
                
                # Try health check
                health_ok, health_msg = self._check_server_health(timeout=2)
                if health_ok:
                    logger.info(f"Server ready after {(attempt + 1) * poll_interval:.1f}s: {health_msg}")
                    server_ready = True
                    break
                else:
                    logger.debug(f"Attempt {attempt + 1}: Server not ready - {health_msg}")
            
            if not server_ready:
                logger.warning(f"Server may still be initializing after {max_wait_seconds}s")
                health_msg = f"Server started but health check not passing after {max_wait_seconds}s"
            
            logger.debug("Reinitializing client with project directory header...")
            
            # Reinitialize the client to connect to the new server
            # CRITICAL: Pass the target project directory via x-opencode-directory header
            # This ensures OpenCode analyzes the correct project regardless of where the
            # server process is running (which may be in opencode package dir for local source)
            try:
                logger.debug(f"Creating new Opencode client with directory header: {project_path}")
                self._client = Opencode(
                    base_url=self._base_url,
                    default_headers={"x-opencode-directory": project_path}
                )
                self._is_connected = True
                logger.info("Client reinitialized with project directory header")
            except Exception as e:
                logger.error(f"Client reinitialization failed: {e}")
                logger.debug(f"Traceback:\n{traceback.format_exc()}")
                return json.dumps({
                    "success": False,
                    "error": f"Server started but client failed to connect: {str(e)}"
                })
            
            # Verify server is actually responding with health check
            health_ok, health_msg = self._check_server_health()
            if not health_ok:
                logger.warning(f"Server health check failed: {health_msg}")
                # Don't fail, but log the warning - server might still be initializing
            else:
                logger.info(f"Server health check passed: {health_msg}")
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"=== SERVER STARTED SUCCESSFULLY (took {elapsed:.2f}s) ===")
            
            return json.dumps({
                "success": True,
                "message": f"OpenCode server started on {project_path}",
                "project_path": project_path,
                "base_url": self._base_url,
                "pid": self._server_process.pid,
                "health_check": health_msg
            }, indent=2)
            
        except FileNotFoundError:
            return json.dumps({
                "success": False,
                "error": "OpenCode CLI not found. Install with: npm install -g opencode-ai"
            })
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"Failed to start server: {str(e)}"
            })

    def stop_server(self) -> str:
        """Stop the currently running OpenCode server.
        
        Returns:
            JSON string with status
        """
        logger.info("=== STOP SERVER REQUEST ===")
        
        if not self._server_process:
            logger.info("No server process to stop")
            return json.dumps({
                "success": True,
                "message": "No server is currently running."
            })
        
        try:
            project_path = self._current_project_path
            pid = self._server_process.pid
            
            logger.info(f"Stopping server (PID: {pid}, project: {project_path})")
            
            # Terminate the process
            self._server_process.terminate()
            try:
                self._server_process.wait(timeout=5)
                logger.debug("Server process terminated gracefully")
            except subprocess.TimeoutExpired:
                logger.warning("Server did not terminate gracefully, killing...")
                self._server_process.kill()
            
            self._server_process = None
            self._current_project_path = None
            self._is_connected = False
            
            logger.info(f"Server stopped successfully (was on: {project_path})")
            
            return json.dumps({
                "success": True,
                "message": f"OpenCode server stopped (PID: {pid})",
                "previous_project": project_path
            })
        except Exception as e:
            logger.error(f"Error stopping server: {e}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            return json.dumps({
                "success": False,
                "error": f"Error stopping server: {str(e)}"
            })

    def get_server_status(self) -> str:
        """Get the current server running status.
        
        Returns:
            JSON string with server status
        """
        if not self._server_process:
            return json.dumps({
                "running": False,
                "message": "No OpenCode server is currently managed by Nova."
            })
        
        # Check if still running
        if self._server_process.poll() is not None:
            self._server_process = None
            self._current_project_path = None
            return json.dumps({
                "running": False,
                "message": "Server was running but has stopped."
            })
        
        return json.dumps({
            "running": True,
            "project_path": self._current_project_path,
            "pid": self._server_process.pid,
            "base_url": self._base_url
        })

    def _ensure_connected(self) -> str:
        """Check if client is connected, return error message if not."""
        if not OPENCODE_AVAILABLE:
            logger.error("SDK not available")
            return "OpenCode SDK is not installed. Please run: pip install --pre opencode-ai"
        if not self._client:
            logger.error("Client not initialized")
            return "OpenCode client not initialized. Please check configuration."
        return ""
    
    def _check_server_health(self, timeout: int = 5) -> tuple[bool, str]:
        """Check if the OpenCode server is responding to health checks.
        
        Args:
            timeout: Request timeout in seconds
            
        Returns:
            Tuple of (is_healthy, message)
        """
        import requests
        
        health_url = f"{self._base_url}/global/health"
        logger.debug(f"Checking server health at: {health_url}")
        
        try:
            start_time = datetime.now()
            headers = {}
            if self._current_project_path:
                headers["x-opencode-directory"] = self._current_project_path
            
            response = requests.get(health_url, headers=headers, timeout=timeout)
            elapsed = (datetime.now() - start_time).total_seconds()
            
            logger.debug(f"Health check response: status={response.status_code}, time={elapsed:.3f}s")
            
            if response.status_code == 200:
                data = response.json()
                version = data.get("version", "unknown")
                return True, f"OK (version={version}, latency={elapsed:.3f}s)"
            else:
                return False, f"HTTP {response.status_code}: {response.text[:100]}"
                
        except requests.exceptions.ConnectionError as e:
            logger.debug(f"Health check connection error: {e}")
            return False, f"Connection refused - server may not be ready"
        except requests.exceptions.Timeout:
            logger.debug(f"Health check timed out after {timeout}s")
            return False, f"Timeout after {timeout}s"
        except Exception as e:
            logger.debug(f"Health check error: {e}")
            return False, f"Error: {str(e)}"
    
    def _log_request(self, method: str, details: str = ""):
        """Log an API request with timing info."""
        self._request_count += 1
        self._last_request_time = datetime.now()
        logger.debug(f"API Request #{self._request_count}: {method} {details}")
    
    def _dump_diagnostic_state(self, context: str = ""):
        """Dump full diagnostic state for debugging connection issues."""
        import requests
        
        logger.warning(f"=== DIAGNOSTIC STATE DUMP ({context}) ===")
        logger.warning(f"Time: {datetime.now().isoformat()}")
        logger.warning(f"Client initialized at: {self._init_time.isoformat() if self._init_time else 'N/A'}")
        logger.warning(f"Request count: {self._request_count}")
        logger.warning(f"Last request at: {self._last_request_time.isoformat() if self._last_request_time else 'N/A'}")
        logger.warning(f"Base URL: {self._base_url}")
        logger.warning(f"Is connected: {self._is_connected}")
        logger.warning(f"Current project path: {self._current_project_path}")
        logger.warning(f"Has client object: {self._client is not None}")
        
        # Check server process
        if self._server_process:
            poll = self._server_process.poll()
            logger.warning(f"Server process PID: {self._server_process.pid}")
            logger.warning(f"Server process poll() result: {poll} (None=running)")
        else:
            logger.warning("Server process: None (not managed by this client)")
        
        # Try a direct health check
        try:
            response = requests.get(f"{self._base_url}/global/health", timeout=3)
            logger.warning(f"Direct health check: status={response.status_code}")
        except requests.exceptions.ConnectionError:
            logger.warning("Direct health check: CONNECTION REFUSED")
        except requests.exceptions.Timeout:
            logger.warning("Direct health check: TIMEOUT")
        except Exception as e:
            logger.warning(f"Direct health check: ERROR - {e}")
        
        logger.warning("=== END DIAGNOSTIC STATE DUMP ===")

    # ==================== Session Management ====================

    def create_session(self) -> str:
        """Create a new OpenCode session.
        
        Returns:
            JSON string with session details or error message
        """
        self._log_request("create_session")
        logger.info("=== CREATE SESSION REQUEST ===")
        logger.debug(f"State: is_connected={self._is_connected}, project={self._current_project_path}")
        
        error = self._ensure_connected()
        if error:
            logger.error(f"Connection check failed: {error}")
            return error
            
        try:
            # Workaround: SDK sends empty JSON {} which causes "Malformed JSON" error
            # The server expects NO body, so use raw HTTP POST instead
            import requests
            
            headers = {}
            if self._current_project_path:
                headers["x-opencode-directory"] = self._current_project_path
            
            url = f"{self._base_url}/session"
            logger.debug(f"POST {url}")
            logger.debug(f"Headers: {headers}")
            
            start_time = datetime.now()
            response = requests.post(url, headers=headers, timeout=10)
            elapsed = (datetime.now() - start_time).total_seconds()
            
            logger.debug(f"Response: status={response.status_code}, time={elapsed:.3f}s")
            
            response.raise_for_status()
            session_data = response.json()
            
            session_id = session_data.get("id")
            logger.info(f"Session created: {session_id}")
            
            return json.dumps({
                "success": True,
                "session_id": session_id,
                "title": session_data.get("title"),
                "created_at": str(session_data.get("time", {}).get("created")),
                "message": "Session created successfully. Use this session_id for subsequent tasks."
            }, indent=2)
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error during create_session: {e}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            # Dump diagnostic state
            self._dump_diagnostic_state("create_session ConnectionError")
            return f"Cannot connect to OpenCode server at {self._base_url}. Is 'opencode serve' running?"
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error during create_session: {e}")
            logger.debug(f"Response text: {e.response.text[:500] if e.response else 'N/A'}")
            return f"HTTP error creating session: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error during create_session: {e}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            self._dump_diagnostic_state("create_session Exception")
            return f"Error creating session: {str(e)}"

    def list_sessions(self) -> str:
        """List all OpenCode sessions.
        
        Returns:
            JSON string with list of sessions or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            sessions = self._client.session.list()
            session_list = []
            for s in sessions:
                session_list.append({
                    "id": s.id,
                    "title": getattr(s, 'title', None),
                    "created_at": str(getattr(s, 'created_at', None))
                })
            return json.dumps({
                "success": True,
                "count": len(session_list),
                "sessions": session_list
            }, indent=2)
        except opencode_ai.APIConnectionError as e:
            return f"Cannot connect to OpenCode server. Is 'opencode serve' running? Error: {e}"
        except Exception as e:
            return f"Error listing sessions: {str(e)}"

    def send_task(self, session_id: str, task: str, model_provider: str = "google", 
                  model_id: str = "gemini-3-pro-preview") -> str:
        """Send a coding task to OpenCode and wait for the result.
        
        Args:
            session_id: The session ID to use
            task: The coding task to execute (e.g., "Add error handling to main.py")
            model_provider: LLM provider (default: anthropic)
            model_id: Model ID (default: claude-sonnet-4-20250514)
            
        Returns:
            JSON string with task result or error message
        """
        self._log_request("send_task", f"session={session_id[:20]}...")
        logger.info("=== SEND TASK REQUEST ===")
        logger.info(f"Session ID: {session_id}")
        logger.info(f"Task: {task[:100]}{'...' if len(task) > 100 else ''}")
        logger.debug(f"Model: {model_provider}/{model_id}")
        logger.debug(f"State: is_connected={self._is_connected}, project={self._current_project_path}")
        
        error = self._ensure_connected()
        if error:
            logger.error(f"Connection check failed: {error}")
            return error
        
        # Pre-flight health check
        health_ok, health_msg = self._check_server_health(timeout=3)
        if not health_ok:
            logger.warning(f"Pre-flight health check failed: {health_msg}")
            self._dump_diagnostic_state("send_task pre-flight health check failed")
        else:
            logger.debug(f"Pre-flight health check: {health_msg}")
            
        try:
            logger.debug("Calling session.chat via SDK...")
            start_time = datetime.now()
            
            result = self._client.session.chat(
                session_id,
                parts=[{"type": "text", "text": task}],
                model_id=model_id,
                provider_id=model_provider
            )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"Task completed in {elapsed:.2f}s")
            
            # Extract relevant information from the AssistantMessage result
            # Note: AssistantMessage contains metadata, not the actual response content
            # Use get_messages() to retrieve the full assistant response with parts
            response_data = {
                "success": True,
                "session_id": session_id,
                "task": task,
                "message_id": getattr(result, 'id', None),
                "cost": getattr(result, 'cost', None),
                "elapsed_seconds": elapsed,
            }
            
            # Extract token usage if available
            if hasattr(result, 'tokens') and result.tokens:
                response_data['tokens'] = {
                    "input": getattr(result.tokens, 'input', None),
                    "output": getattr(result.tokens, 'output', None),
                    "reasoning": getattr(result.tokens, 'reasoning', None),
                }
                if hasattr(result.tokens, 'cache') and result.tokens.cache:
                    response_data['tokens']['cache'] = {
                        "read": getattr(result.tokens.cache, 'read', None),
                        "write": getattr(result.tokens.cache, 'write', None),
                    }
            
            # Note for the agent/user
            response_data['note'] = "Task submitted and completed. Call opencode_get_messages to retrieve the assistant's response content."
            
            logger.debug(f"Response message_id: {response_data.get('message_id')}")
            logger.info("=== SEND TASK COMPLETED SUCCESSFULLY ===")
            return json.dumps(response_data, indent=2, default=str)
            
        except opencode_ai.APIConnectionError as e:
            logger.error(f"APIConnectionError during send_task: {e}")
            logger.debug(f"Exception type: {type(e).__name__}")
            logger.debug(f"Exception details: {repr(e)}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            self._dump_diagnostic_state("send_task APIConnectionError")
            return f"Cannot connect to OpenCode server. Is 'opencode serve' running? Error: {e}"
        except opencode_ai.BadRequestError as e:
            logger.error(f"BadRequestError during send_task: {e}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            return f"Bad request to OpenCode: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error during send_task: {type(e).__name__}: {e}")
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            self._dump_diagnostic_state("send_task Exception")
            return f"Error executing task: {str(e)}"

    def get_messages(self, session_id: str) -> str:
        """Get all messages in a session.
        
        Args:
            session_id: The session ID to get messages from
            
        Returns:
            JSON string with message history or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            messages = self._client.session.messages(session_id)
            message_list = []
            for msg in messages:
                msg_data = {
                    "id": getattr(msg.info, 'id', None) if hasattr(msg, 'info') else None,
                    "role": getattr(msg.info, 'role', None) if hasattr(msg, 'info') else None,
                }
                if hasattr(msg, 'parts'):
                    parts = []
                    for part in msg.parts:
                        if hasattr(part, 'text'):
                            # Return full text - no truncation
                            parts.append({"type": "text", "text": part.text})
                        elif hasattr(part, 'type'):
                            parts.append({"type": part.type})
                    msg_data['parts'] = parts
                message_list.append(msg_data)
            return json.dumps({
                "success": True,
                "session_id": session_id,
                "count": len(message_list),
                "messages": message_list
            }, indent=2)
        except opencode_ai.APIConnectionError as e:
            return f"Cannot connect to OpenCode server. Error: {e}"
        except Exception as e:
            return f"Error getting messages: {str(e)}"

    def abort_task(self, session_id: str) -> str:
        """Abort a running task in a session.
        
        Args:
            session_id: The session ID to abort
            
        Returns:
            Result message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            self._client.session.abort(session_id)
            return json.dumps({
                "success": True,
                "message": f"Task in session {session_id} has been aborted."
            })
        except Exception as e:
            return f"Error aborting task: {str(e)}"

    def revert_changes(self, session_id: str, message_id: str) -> str:
        """Revert changes made in a session to a specific message.
        
        Args:
            session_id: The session ID
            message_id: The message ID to revert to
            
        Returns:
            Result message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            session = self._client.session.revert(session_id, message_id=message_id)
            return json.dumps({
                "success": True,
                "message": f"Changes reverted to message {message_id}",
                "session_id": session.id
            })
        except Exception as e:
            return f"Error reverting changes: {str(e)}"

    def summarize_session(self, session_id: str, model_provider: str = "google",
                          model_id: str = "gemini-3-pro-preview") -> str:
        """Get a summary of a session.
        
        Args:
            session_id: The session ID to summarize
            model_provider: LLM provider (default: anthropic)
            model_id: Model ID (default: claude-sonnet-4-20250514)
            
        Returns:
            Session summary
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            result = self._client.session.summarize(
                session_id,
                model_id=model_id,
                provider_id=model_provider
            )
            return json.dumps({
                "success": True,
                "session_id": session_id,
                "summary": str(result)
            }, indent=2)
        except Exception as e:
            return f"Error summarizing session: {str(e)}"

    def delete_session(self, session_id: str) -> str:
        """Delete a session.
        
        Args:
            session_id: The session ID to delete
            
        Returns:
            Result message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            self._client.session.delete(session_id)
            return json.dumps({
                "success": True,
                "message": f"Session {session_id} deleted successfully."
            })
        except Exception as e:
            return f"Error deleting session: {str(e)}"

    # ==================== File Operations ====================

    def find_files(self, pattern: str) -> str:
        """Search for files matching a pattern.
        
        Args:
            pattern: File pattern to search for (e.g., "*.py", "test_*")
            
        Returns:
            JSON string with matching files or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            result = self._client.find.files(query=pattern)
            files = []
            if hasattr(result, '__iter__'):
                for f in result:
                    if hasattr(f, 'path'):
                        files.append(f.path)
                    else:
                        files.append(str(f))
            return json.dumps({
                "success": True,
                "pattern": pattern,
                "count": len(files),
                "files": files  # No limit
            }, indent=2)
        except Exception as e:
            return f"Error finding files: {str(e)}"

    def find_text(self, query: str) -> str:
        """Search for text content in files.
        
        Args:
            query: Text to search for
            
        Returns:
            JSON string with search results or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            result = self._client.find.text(pattern=query)
            matches = []
            if hasattr(result, '__iter__'):
                for match in result:
                    match_data = {}
                    if hasattr(match, 'path'):
                        match_data['path'] = match.path
                    if hasattr(match, 'line'):
                        match_data['line'] = match.line
                    if hasattr(match, 'content'):
                        match_data['content'] = match.content  # No truncation
                    matches.append(match_data)
            return json.dumps({
                "success": True,
                "query": query,
                "count": len(matches),
                "matches": matches  # No limit
            }, indent=2)
        except Exception as e:
            return f"Error searching text: {str(e)}"

    def read_file(self, path: str) -> str:
        """Read contents of a file.
        
        Args:
            path: Path to the file to read (relative or absolute)
            
        Returns:
            File contents or error message
        """
        error = self._ensure_connected()
        if error:
            return error
        
        # Resolve path - if relative, prepend project path
        resolved_path = path
        if not os.path.isabs(path) and self._current_project_path:
            resolved_path = os.path.join(self._current_project_path, path)
            logger.debug(f"Resolved relative path '{path}' to '{resolved_path}'")
        
        # Try SDK first
        try:
            result = self._client.file.read(path=path)
            
            # Handle different response types from the server
            if isinstance(result, list):
                # Server returned a list (possibly empty or with file chunks)
                if len(result) == 0:
                    # SDK returned empty - try filesystem fallback
                    logger.debug(f"SDK returned empty list for '{path}', trying filesystem fallback")
                    return self._read_file_fallback(resolved_path, path)
                # If list has content, try to extract it
                content = str(result)
            elif hasattr(result, 'content'):
                # FileReadResponse object with content field
                content = result.content
            else:
                content = str(result)
            
            # Return full content - no truncation
            return json.dumps({
                "success": True,
                "path": path,
                "content": content,
                "type": getattr(result, 'type', 'raw') if hasattr(result, 'type') else 'raw'
            }, indent=2)
        except Exception as e:
            logger.warning(f"SDK file.read failed: {e}, trying filesystem fallback")
            return self._read_file_fallback(resolved_path, path)
    
    def _read_file_fallback(self, resolved_path: str, original_path: str) -> str:
        """Fallback to direct filesystem read when SDK fails.
        
        Args:
            resolved_path: The absolute path to try reading
            original_path: The original path requested (for error messages)
            
        Returns:
            JSON string with file contents or error
        """
        if os.path.exists(resolved_path):
            try:
                with open(resolved_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                
                # Return full content - no truncation
                logger.info(f"Successfully read file via filesystem fallback: {resolved_path}")
                return json.dumps({
                    "success": True,
                    "path": resolved_path,
                    "content": content,
                    "source": "filesystem_fallback",
                    "note": "Read directly from filesystem (SDK returned empty)"
                }, indent=2)
            except Exception as e:
                logger.error(f"Filesystem fallback failed: {e}")
                return json.dumps({
                    "success": False,
                    "path": original_path,
                    "error": f"Both SDK and filesystem read failed: {str(e)}"
                }, indent=2)
        else:
            return json.dumps({
                "success": False,
                "path": original_path,
                "resolved_path": resolved_path,
                "error": f"File not found. The resolved path '{resolved_path}' does not exist."
            }, indent=2)

    # ==================== Status & Info ====================

    def check_status(self) -> str:
        """Check the status of the OpenCode connection and server.
        
        Returns:
            JSON string with status information
        """
        if not OPENCODE_AVAILABLE:
            return json.dumps({
                "connected": False,
                "error": "OpenCode SDK not installed. Run: pip install --pre opencode-ai"
            })
            
        if not self._client:
            return json.dumps({
                "connected": False,
                "error": "OpenCode client not initialized"
            })
            
        try:
            # Try to get app info to verify connection
            app_info = self._client.app.get()
            providers = self._client.app.providers()
            
            return json.dumps({
                "connected": True,
                "base_url": self._base_url,
                "app_info": {
                    "version": getattr(app_info, 'version', 'unknown'),
                },
                "providers_available": len(providers) if hasattr(providers, '__len__') else 'unknown',
                "message": "OpenCode server is running and connected."
            }, indent=2)
        except opencode_ai.APIConnectionError:
            return json.dumps({
                "connected": False,
                "base_url": self._base_url,
                "error": "Cannot connect to OpenCode server. Please run 'opencode serve' in your project directory."
            })
        except Exception as e:
            return json.dumps({
                "connected": False,
                "base_url": self._base_url,
                "error": str(e)
            })

    def get_providers(self) -> str:
        """Get available LLM providers.
        
        Returns:
            JSON string with provider information
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            providers = self._client.app.providers()
            provider_list = []
            if hasattr(providers, '__iter__'):
                for p in providers:
                    provider_list.append(str(p))
            return json.dumps({
                "success": True,
                "providers": provider_list
            }, indent=2)
        except Exception as e:
            return f"Error getting providers: {str(e)}"

    def get_config(self) -> str:
        """Get the current OpenCode configuration.
        
        Returns:
            JSON string with configuration
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            config = self._client.config.get()
            return json.dumps({
                "success": True,
                "config": config.to_dict() if hasattr(config, 'to_dict') else str(config)
            }, indent=2)
        except Exception as e:
            return f"Error getting config: {str(e)}"
