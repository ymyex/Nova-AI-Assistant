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
        
        if not OPENCODE_AVAILABLE:
            print("[OpenCode] SDK not installed. Install with: pip install --pre opencode-ai")
            return
            
        try:
            self._client = Opencode(base_url=base_url)
            self._is_connected = True
            print(f"[OpenCode] Client initialized with base URL: {base_url}")
        except Exception as e:
            print(f"[OpenCode] Failed to initialize client: {e}")
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
        # Validate path exists
        if not os.path.isdir(project_path):
            return json.dumps({
                "success": False,
                "error": f"Directory does not exist: {project_path}"
            })
        
        # Stop any existing server first
        if self._server_process:
            self.stop_server()
            time.sleep(1)
        
        try:
            # Start opencode serve in the project directory
            print(f"[OpenCode] Starting server on: {project_path}")
            
            # Use CREATE_NO_WINDOW on Windows to avoid console popup
            creation_flags = 0
            if os.name == 'nt':
                creation_flags = subprocess.CREATE_NO_WINDOW
            
            # Use shell=True on Windows to find opencode.cmd via PATH
            self._server_process = subprocess.Popen(
                "opencode serve" if os.name == 'nt' else ["opencode", "serve"],
                cwd=project_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=(os.name == 'nt'),
                creationflags=creation_flags
            )
            
            self._current_project_path = project_path
            
            # Wait for server to start
            print(f"[OpenCode] Waiting {wait_seconds} seconds for server to start...")
            time.sleep(wait_seconds)
            
            # Check if process is still running
            if self._server_process.poll() is not None:
                # Process ended, get error
                _, stderr = self._server_process.communicate()
                return json.dumps({
                    "success": False,
                    "error": f"Server failed to start: {stderr.decode()[:500]}"
                })
            
            # Reinitialize the client to connect to the new server
            try:
                self._client = Opencode(base_url=self._base_url)
                self._is_connected = True
            except Exception as e:
                return json.dumps({
                    "success": False,
                    "error": f"Server started but client failed to connect: {str(e)}"
                })
            
            return json.dumps({
                "success": True,
                "message": f"OpenCode server started on {project_path}",
                "project_path": project_path,
                "base_url": self._base_url,
                "pid": self._server_process.pid
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
        if not self._server_process:
            return json.dumps({
                "success": True,
                "message": "No server is currently running."
            })
        
        try:
            project_path = self._current_project_path
            pid = self._server_process.pid
            
            # Terminate the process
            self._server_process.terminate()
            try:
                self._server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._server_process.kill()
            
            self._server_process = None
            self._current_project_path = None
            self._is_connected = False
            
            print(f"[OpenCode] Server stopped (was on: {project_path})")
            
            return json.dumps({
                "success": True,
                "message": f"OpenCode server stopped (PID: {pid})",
                "previous_project": project_path
            })
        except Exception as e:
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
            return "OpenCode SDK is not installed. Please run: pip install --pre opencode-ai"
        if not self._client:
            return "OpenCode client not initialized. Please check configuration."
        return ""

    # ==================== Session Management ====================

    def create_session(self) -> str:
        """Create a new OpenCode session.
        
        Returns:
            JSON string with session details or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            # Workaround: SDK sends empty JSON {} which causes "Malformed JSON" error
            # The server expects NO body, so use raw HTTP POST instead
            import requests
            response = requests.post(f"{self._base_url}/session", timeout=10)
            response.raise_for_status()
            session_data = response.json()
            
            return json.dumps({
                "success": True,
                "session_id": session_data.get("id"),
                "title": session_data.get("title"),
                "created_at": str(session_data.get("time", {}).get("created")),
                "message": "Session created successfully. Use this session_id for subsequent tasks."
            }, indent=2)
        except requests.exceptions.ConnectionError:
            return f"Cannot connect to OpenCode server at {self._base_url}. Is 'opencode serve' running?"
        except Exception as e:
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

    def send_task(self, session_id: str, task: str, model_provider: str = "anthropic", 
                  model_id: str = "claude-sonnet-4-20250514") -> str:
        """Send a coding task to OpenCode and wait for the result.
        
        Args:
            session_id: The session ID to use
            task: The coding task to execute (e.g., "Add error handling to main.py")
            model_provider: LLM provider (default: anthropic)
            model_id: Model ID (default: claude-sonnet-4-20250514)
            
        Returns:
            JSON string with task result or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            result = self._client.session.chat(
                session_id,
                parts=[{"type": "text", "text": task}],
                model_id=model_id,
                provider_id=model_provider
            )
            
            # Extract relevant information from the result
            response_data = {
                "success": True,
                "session_id": session_id,
                "task": task,
            }
            
            # Try to extract parts/content from the response
            if hasattr(result, 'parts'):
                parts = []
                for part in result.parts:
                    part_data = {}
                    if hasattr(part, 'type'):
                        part_data['type'] = part.type
                    if hasattr(part, 'text'):
                        part_data['text'] = part.text
                    if hasattr(part, 'tool_use'):
                        part_data['tool_use'] = str(part.tool_use)
                    parts.append(part_data)
                response_data['parts'] = parts
            
            if hasattr(result, 'id'):
                response_data['message_id'] = result.id
                
            return json.dumps(response_data, indent=2, default=str)
            
        except opencode_ai.APIConnectionError as e:
            return f"Cannot connect to OpenCode server. Is 'opencode serve' running? Error: {e}"
        except opencode_ai.BadRequestError as e:
            return f"Bad request to OpenCode: {str(e)}"
        except Exception as e:
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
                            parts.append({"type": "text", "text": part.text[:500]})  # Truncate long texts
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

    def summarize_session(self, session_id: str, model_provider: str = "anthropic",
                          model_id: str = "claude-sonnet-4-20250514") -> str:
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
                "files": files[:50]  # Limit to 50 files
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
                        match_data['content'] = match.content[:200]  # Truncate
                    matches.append(match_data)
            return json.dumps({
                "success": True,
                "query": query,
                "count": len(matches),
                "matches": matches[:30]  # Limit results
            }, indent=2)
        except Exception as e:
            return f"Error searching text: {str(e)}"

    def read_file(self, path: str) -> str:
        """Read contents of a file.
        
        Args:
            path: Path to the file to read
            
        Returns:
            File contents or error message
        """
        error = self._ensure_connected()
        if error:
            return error
            
        try:
            result = self._client.file.read(path=path)
            
            # Handle different response types from the server
            if isinstance(result, list):
                # Server returned a list (possibly empty or with file chunks)
                if len(result) == 0:
                    return json.dumps({
                        "success": False,
                        "path": path,
                        "error": "File not found or server returned empty response. Try using run_system_command with 'type' command instead."
                    }, indent=2)
                # If list has content, try to extract it
                content = str(result)
            elif hasattr(result, 'content'):
                # FileReadResponse object with content field
                content = result.content
            else:
                content = str(result)
            
            # Truncate very long files
            if len(content) > 10000:
                content = content[:10000] + "\n... [truncated, file too large]"
                
            return json.dumps({
                "success": True,
                "path": path,
                "content": content,
                "type": getattr(result, 'type', 'raw') if hasattr(result, 'type') else 'raw'
            }, indent=2)
        except Exception as e:
            return f"Error reading file: {str(e)}"

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
