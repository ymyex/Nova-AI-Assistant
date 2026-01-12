from __future__ import annotations

import textwrap
import subprocess
from typing import Optional, Dict, Any

from google import genai
from google.genai import types
import requests

from .config import Settings
from .exceptions import ConfigurationError, GeminiError
from .models import NovaPayload


def get_tools():
    """Define available tools as callable functions for the new SDK."""

    def run_system_command(command: str) -> str:
        """Execute a system command on the host machine.
        
        Args:
            command: The command line to execute (e.g., 'dir', 'ipconfig', 'powershell Get-Process')
        """
        pass
    
    def gmail_read_inbox(count: int = 5) -> str:
        """Read recent emails from the user's Gmail inbox.
        
        Args:
            count: Number of emails to retrieve (default 5, max 20)
        """
        pass  # Placeholder - will be executed by _execute_function
    
    def gmail_search(query: str, count: int = 5) -> str:
        """Search emails using Gmail search query syntax.
        
        Args:
            query: Gmail search query (e.g., 'from:john@example.com', 'subject:meeting', 'is:unread')
            count: Number of results to return (default 5)
        """
        pass
    
    def gmail_send_email(to: str, subject: str, body: str) -> str:
        """Send an email on behalf of the user.
        
        Args:
            to: Recipient email address
            subject: Email subject line
            body: Email body text
        """
        pass
    
    def gmail_get_unread_count() -> str:
        """Get the count of unread emails in inbox."""
        pass
    
    def gmail_read_email(message_id: str) -> str:
        """Read a specific email by its ID.
        
        Args:
            message_id: The Gmail message ID
        """
        pass
    
    def gmail_get_labels() -> str:
        """Get all Gmail labels/folders."""
        pass
    
    def gmail_check_status() -> str:
        """Check if Gmail is connected and get the connected email address."""
        pass
    
    # ==================== OpenCode Agentic Coding Tools ====================
    
    def opencode_create_session() -> str:
        """Create a new OpenCode coding session.
        
        Use this to start a new agentic coding session. You'll receive a session_id 
        that should be used for subsequent coding tasks. OpenCode server must be running.
        """
        pass
    
    def opencode_send_task(session_id: str, task: str) -> str:
        """Send a coding task to OpenCode and wait for the result.
        
        This is the main tool for executing code changes. OpenCode will analyze the 
        codebase, make changes, and return the results.
        
        Args:
            session_id: The session ID from opencode_create_session
            task: The coding task to perform (e.g., "Add error handling to main.py", 
                  "Fix the bug in the login function", "Add unit tests for the API")
        """
        pass
    
    def opencode_list_sessions() -> str:
        """List all OpenCode sessions.
        
        Returns a list of all active and past coding sessions.
        """
        pass
    
    def opencode_get_messages(session_id: str) -> str:
        """Get the full conversation history from an OpenCode session.
        
        Args:
            session_id: The session ID to get messages from
        """
        pass
    
    def opencode_abort_task(session_id: str) -> str:
        """Abort/cancel a running task in an OpenCode session.
        
        Use this if a coding task is taking too long or if the user wants to stop it.
        
        Args:
            session_id: The session ID to abort
        """
        pass
    
    def opencode_revert_changes(session_id: str, message_id: str) -> str:
        """Revert/undo changes made in an OpenCode session.
        
        This will undo all changes made after the specified message.
        
        Args:
            session_id: The session ID
            message_id: The message ID to revert to (changes after this will be undone)
        """
        pass
    
    def opencode_summarize(session_id: str) -> str:
        """Get a summary of what was done in an OpenCode session.
        
        Args:
            session_id: The session ID to summarize
        """
        pass
    
    def opencode_find_files(pattern: str) -> str:
        """Search for files in the project by pattern.
        
        Args:
            pattern: File pattern to search for (e.g., "*.py", "test_*.js", "README*")
        """
        pass
    
    def opencode_find_text(query: str) -> str:
        """Search for text content across files in the project.
        
        Args:
            query: Text to search for in files
        """
        pass
    
    def opencode_read_file(path: str) -> str:
        """Read the contents of a file via OpenCode.
        
        Args:
            path: Path to the file to read
        """
        pass
    
    def opencode_check_status() -> str:
        """Check if OpenCode server is running and connected.
        
        Use this to verify OpenCode is available before attempting coding tasks.
        Returns connection status and available providers.
        """
        pass
    
    def opencode_start_server(project_path: str) -> str:
        """Start the OpenCode server on a specific project directory.
        
        IMPORTANT: Use this first before any other OpenCode operations to work on a specific project.
        This allows you to work on any project the user specifies.
        
        Args:
            project_path: Absolute path to the project directory (e.g., "C:\\Projects\\my-app")
        
        Example flow:
        1. User says "Fix the bug in C:\\Projects\\scraper"
        2. Call opencode_start_server("C:\\Projects\\scraper")
        3. Call opencode_create_session()
        4. Call opencode_send_task(session_id, "Fix the bug")
        5. Report results to user
        """
        pass
    
    def opencode_stop_server() -> str:
        """Stop the currently running OpenCode server.
        
        Use this when done with coding tasks to free up resources.
        The server will also be stopped if a new project is started with opencode_start_server.
        """
        pass
    
    def opencode_get_server_status() -> str:
        """Check if an OpenCode server is currently running and which project it's on.
        
        Use this to see if you need to start a server for a different project.
        """
        pass
    
    return [
        run_system_command,
        gmail_read_inbox,
        gmail_search,
        gmail_send_email,
        gmail_get_unread_count,
        gmail_read_email,
        gmail_get_labels,
        gmail_check_status,
        # OpenCode agentic coding tools - Server Management
        opencode_start_server,
        opencode_stop_server,
        opencode_get_server_status,
        # OpenCode agentic coding tools - Session & Tasks
        opencode_create_session,
        opencode_send_task,
        opencode_list_sessions,
        opencode_get_messages,
        opencode_abort_task,
        opencode_revert_changes,
        opencode_summarize,
        # OpenCode agentic coding tools - File Operations
        opencode_find_files,
        opencode_find_text,
        opencode_read_file,
        opencode_check_status,
    ]


class GeminiClient:
    """Wrapper around the Google GenAI SDK with thinking and function calling support."""

    def __init__(self, settings: Settings, session: Optional[requests.Session] = None) -> None:
        if not settings.gemini_api_key:
            raise ConfigurationError("GEMINI_API_KEY must be configured before using the Gemini client")

        self._api_key = settings.gemini_api_key
        self._model_name = settings.gemini_model
        self._tools = None  # Will be set externally (Gmail tools)
        self._opencode_client = None  # Will be set externally (OpenCode client)
        
        # Create the new SDK client
        self._client = genai.Client(api_key=self._api_key)
        
        print(f"[Gemini] Initialized with model: {self._model_name} (new SDK with thinking support)")
    
    def set_tools(self, tools) -> None:
        """Set the tools instance for function execution."""
        self._tools = tools
    
    def set_opencode_client(self, opencode_client) -> None:
        """Set the OpenCode client for agentic coding operations."""
        self._opencode_client = opencode_client
        print("[Gemini] OpenCode client connected")

    def _build_prompt(self, payload: NovaPayload, gmail_context: str = "") -> str:
        """Build a professional, structured system prompt for Nova AI."""
        message = payload.message
        context_lines = []

        for ctx in message.context:
            timestamp = ctx.timestamp.isoformat() if ctx.timestamp else "unknown time"
            speaker = ctx.sender or ctx.role or "unknown"
            context_lines.append(f"- [{timestamp}] {speaker}: {ctx.text.strip()}")

        context_block = "\n".join(context_lines) if context_lines else "- No additional context provided."

        sender = message.sender_name or message.sender_phone or message.sender_jid or "Unknown sender"
        chat = message.chat_name or payload.force_group_name or "Unknown chat"

        media_context = ""
        if message.media_type:
            media_context = f"\n[User sent a {message.media_type} file]"

        # ==============================================================================
        # NOVA AI PROFESSIONAL SYSTEM PROMPT
        # ==============================================================================
        
        system_instructions = """
================================================================================
                            NOVA AI - SYSTEM INSTRUCTIONS
================================================================================

## IDENTITY

You are **Nova**, a friendly and capable AI assistant. You are smart, helpful, and
warm in your interactions. You provide excellent assistance while being approachable
and easy to talk to. You operate via WhatsApp and have extensive capabilities to
assist users with various tasks.

--------------------------------------------------------------------------------

## LANGUAGE POLICY (ABSOLUTE RULE)

- **DEFAULT**: You MUST respond in **English** at all times.
- **EXCEPTION**: Only switch languages if the user **EXPLICITLY** requests it.
  Examples of explicit requests:
  - "Respond in French"
  - "Türkçe konuş"
  - "用中文回复"
  - "Please speak Arabic"
- If the user writes in a non-English language but does NOT explicitly request
  a response in that language, you MUST still respond in English.
- This rule is **ABSOLUTE** and overrides all other behavioral guidelines.

--------------------------------------------------------------------------------

## CODING TASKS - MANDATORY OPENCODE USAGE

For **ANY** coding-related request, you **MUST** use OpenCode tools. This includes:
- Analyzing code or projects
- Reading/viewing files
- Making code changes (regardless of size)
- Debugging or troubleshooting code
- Reviewing code structure or architecture
- Searching codebases
- Any other task involving source code

### Required Workflow:
1. `opencode_start_server(project_path)` - Initialize on target project directory
2. `opencode_create_session()` - Create a new coding session
3. `opencode_send_task(session_id, task)` - Execute the coding task
4. Report results professionally to the user
5. `opencode_stop_server()` - (Optional) Clean up when done

### Available OpenCode Tools:
| Tool | Purpose |
|------|---------|
| `opencode_start_server` | Start server on a project directory |
| `opencode_stop_server` | Stop the running server |
| `opencode_get_server_status` | Check server status and current project |
| `opencode_create_session` | Create a new coding session |
| `opencode_send_task` | Send a coding task for execution |
| `opencode_list_sessions` | List all coding sessions |
| `opencode_get_messages` | Get session conversation history |
| `opencode_abort_task` | Cancel a running task |
| `opencode_revert_changes` | Undo changes made in a session |
| `opencode_summarize` | Get summary of session work |
| `opencode_find_files` | Search for files by pattern |
| `opencode_find_text` | Search for text in codebase |
| `opencode_read_file` | Read file contents |
| `opencode_check_status` | Verify OpenCode connectivity |

**CRITICAL**: Do NOT attempt to describe code changes without using OpenCode.
Do NOT refuse coding tasks claiming lack of access - you HAVE full access.

--------------------------------------------------------------------------------

## SYSTEM COMMAND CAPABILITIES

You have the power to execute **ANY** system command on the host Windows machine
using the `run_system_command` tool.

**When to use:**
- User asks to "run", "execute", "check", or "list" something on the system
- Checking system status, processes, or configuration
- File system operations
- Any Windows PowerShell or CMD commands

**Environment:** Windows with PowerShell available.

--------------------------------------------------------------------------------

## GMAIL INTEGRATION

You have **FULL** access to the user's Gmail via the following tools:
- `gmail_read_inbox` - Read recent emails
- `gmail_search` - Search emails with Gmail query syntax
- `gmail_send_email` - Send emails on behalf of the user
- `gmail_get_unread_count` - Check unread count
- `gmail_read_email` - Read specific email by ID
- `gmail_get_labels` - Get all labels/folders
- `gmail_check_status` - Verify Gmail connection

**CRITICAL**: Do NOT say you don't have Gmail access - you DO.

--------------------------------------------------------------------------------

## MEDIA PROCESSING CAPABILITIES

You have **FULL** capability to process:
- Audio messages (voice notes, recordings)
- Images (photos, screenshots, diagrams)
- Documents (PDFs, files)

**CRITICAL**: 
- Do NOT say "I cannot listen to audio" - you CAN.
- Do NOT say "I cannot see images" - you CAN.
- Process and respond to media content **IMMEDIATELY** in your response.
- Do NOT defer with phrases like "I will review this" or "Summary coming shortly."

--------------------------------------------------------------------------------

## AGENTIC BEHAVIOR

You are an **autonomous agent** capable of multi-step task execution:
- Perform multiple sequential operations to solve complex problems
- Observe output from each step before deciding the next action
- Continue until the task is **fully complete**
- Verify results when appropriate
- Do not stop prematurely

--------------------------------------------------------------------------------

## COMMUNICATION STANDARDS

**DO:**
- Be friendly and warm in your responses
- Keep a conversational, approachable tone
- Be helpful and supportive
- Use proper formatting for technical content when needed
- Provide clear, useful responses

**DO NOT:**
- Use excessive emojis (a few are fine when appropriate)
- Include formal greetings like "Dear user" or "Greetings"
- Include formal sign-offs like "Best regards" 
- Wrap responses in quotes
- Mention that you are an AI
- Be cold or robotic

================================================================================
"""

        prompt = textwrap.dedent(
            f"""
            {system_instructions}

            ## CURRENT CONTEXT

            **Chat:** {chat}
            **Sender:** {sender}

            ### Conversation History:
            {context_block}

            ### Incoming Message from {sender}:{media_context}
            {message.text.strip()}

            ---

            **Your Response:**
            """
        ).strip()

        return prompt
    
    def _execute_function(self, function_name: str, args: Dict[str, Any]) -> str:
        """Execute a function and return the result."""
        if not self._tools:
            return "Tools are not connected."
        
        try:
            if function_name == "run_system_command":
                command = args.get("command", "")
                try:
                    result = subprocess.run(
                        command, 
                        shell=True, 
                        capture_output=True, 
                        text=True, 
                        timeout=30
                    )
                    output = f"Stdout:\n{result.stdout}\nStderr:\n{result.stderr}"
                    return output.strip() or "Command executed successfully with no output."
                except Exception as e:
                    return f"Error executing command: {str(e)}"

            elif function_name == "gmail_read_inbox":
                count = args.get("count", 5)
                return self._tools.read_inbox(count)
            
            elif function_name == "gmail_search":
                query = args.get("query", "")
                count = args.get("count", 5)
                return self._tools.search_emails(query, count)
            
            elif function_name == "gmail_send_email":
                to = args.get("to", "")
                subject = args.get("subject", "")
                body = args.get("body", "")
                return self._tools.send_email(to, subject, body)
            
            elif function_name == "gmail_get_unread_count":
                return self._tools.get_unread_count()
            
            elif function_name == "gmail_read_email":
                message_id = args.get("message_id", "")
                return self._tools.read_email(message_id)
            
            elif function_name == "gmail_get_labels":
                return self._tools.get_labels()
            
            elif function_name == "gmail_check_status":
                status = self._tools.get_status()
                if status["connected"]:
                    return f"Gmail is connected as {status['email']}"
                return "Gmail is not connected"
            
            # ==================== OpenCode Handlers ====================
            
            # Server Management
            elif function_name == "opencode_start_server":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                project_path = args.get("project_path", "")
                if not project_path:
                    return "project_path is required for opencode_start_server"
                return self._opencode_client.start_server(project_path)
            
            elif function_name == "opencode_stop_server":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                return self._opencode_client.stop_server()
            
            elif function_name == "opencode_get_server_status":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                return self._opencode_client.get_server_status()
            
            # Session Management
            elif function_name == "opencode_create_session":
                if not self._opencode_client:
                    return "OpenCode client is not configured. Please set up OpenCode first."
                return self._opencode_client.create_session()
            
            elif function_name == "opencode_send_task":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                session_id = args.get("session_id", "")
                task = args.get("task", "")
                if not session_id or not task:
                    return "Both session_id and task are required for opencode_send_task"
                return self._opencode_client.send_task(session_id, task)
            
            elif function_name == "opencode_list_sessions":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                return self._opencode_client.list_sessions()
            
            elif function_name == "opencode_get_messages":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                session_id = args.get("session_id", "")
                if not session_id:
                    return "session_id is required for opencode_get_messages"
                return self._opencode_client.get_messages(session_id)
            
            elif function_name == "opencode_abort_task":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                session_id = args.get("session_id", "")
                if not session_id:
                    return "session_id is required for opencode_abort_task"
                return self._opencode_client.abort_task(session_id)
            
            elif function_name == "opencode_revert_changes":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                session_id = args.get("session_id", "")
                message_id = args.get("message_id", "")
                if not session_id or not message_id:
                    return "Both session_id and message_id are required for opencode_revert_changes"
                return self._opencode_client.revert_changes(session_id, message_id)
            
            elif function_name == "opencode_summarize":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                session_id = args.get("session_id", "")
                if not session_id:
                    return "session_id is required for opencode_summarize"
                return self._opencode_client.summarize_session(session_id)
            
            elif function_name == "opencode_find_files":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                pattern = args.get("pattern", "")
                if not pattern:
                    return "pattern is required for opencode_find_files"
                return self._opencode_client.find_files(pattern)
            
            elif function_name == "opencode_find_text":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                query = args.get("query", "")
                if not query:
                    return "query is required for opencode_find_text"
                return self._opencode_client.find_text(query)
            
            elif function_name == "opencode_read_file":
                if not self._opencode_client:
                    return "OpenCode client is not configured."
                path = args.get("path", "")
                if not path:
                    return "path is required for opencode_read_file"
                return self._opencode_client.read_file(path)
            
            elif function_name == "opencode_check_status":
                if not self._opencode_client:
                    return "OpenCode client is not configured. Please set up OpenCode first."
                return self._opencode_client.check_status()
            
            else:
                return f"Unknown function: {function_name}"
                
        except Exception as e:
            return f"Error executing {function_name}: {str(e)}"

    def generate_suggestion(self, payload: NovaPayload, media_data: Optional[bytes] = None, media_mime_type: Optional[str] = None) -> str:
        prompt = self._build_prompt(payload)
        
        # Build content parts - media first, then text
        # Agentic Loop
        MAX_STEPS = 100  # Effectively unlimited agentic processing
        current_step = 0
        
        # Initial contents list
        chat_history = []
        
        # Add media and prompt to history
        if media_data and media_mime_type:
           chat_history.append(types.Content(
               parts=[types.Part.from_bytes(data=media_data, mime_type=media_mime_type)]
           ))
           prompt += "\n\n[SYSTEM: The user has attached the media file above. The text below is a CAPTION for this media. Analyze the media to answer the user's request.]"

        chat_history.append(types.Content(parts=[types.Part.from_text(text=prompt)]))

        try:
            while current_step < MAX_STEPS:
                current_step += 1
                
                print(f"[Gemini] Step {current_step}/{MAX_STEPS}")

                # Determine thinking level based on model
                thinking_level = "high"
                if "flash" in self._model_name.lower():
                    thinking_level = "high"  # Can also use "medium" for balanced
                
                # Generate content
                response = self._client.models.generate_content(
                    model=self._model_name,
                    contents=chat_history,
                    config=types.GenerateContentConfig(
                        temperature=1.0,
                        top_p=0.95,
                        tools=get_tools(),
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                        thinking_config=types.ThinkingConfig(
                            thinking_level=thinking_level
                        )
                    )
                )

                # Append model response to history
                # We need to reconstruct the content object carefully for the history
                model_parts = []
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        # Log thought
                        if hasattr(part, 'thought') and part.thought:
                            print(f"[Gemini] Model thought: {str(part.thought)[:300]}...")
                        
                        # Add to model parts for history (excluding thought if SDK handles it differently, usually we just keep it or the API returns it)
                        # For now, let's just append the whole content response to history
                        pass

                chat_history.append(response.candidates[0].content)

                # Check for Function Calls
                function_calls = []
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            function_calls.append(part.function_call)
                
                if function_calls:
                    # Handle tool calls
                    for call in function_calls:
                        function_name = call.name
                        function_args = dict(call.args) if call.args else {}
                        
                        print(f"[Gemini] Calling function: {function_name} with args: {function_args}")
                        
                        # Execute
                        function_result = self._execute_function(function_name, function_args)
                        print(f"[Gemini] Function result: {function_result[:200]}...")

                        # Add function response to history
                        # The SDK expects a specific format for function responses
                        # It is typically a Content object with role="tool" and parts=[FunctionResponse]
                        
                        tool_response_part = types.Part.from_function_response(
                            name=function_name,
                            response={"result": function_result}
                        )
                        
                        chat_history.append(types.Content(
                            role="tool",
                            parts=[tool_response_part]
                        ))
                    
                    # Continue loop to let model see result and decide next step
                    continue
                
                # If no function calls, check for text response (Final Answer)
                if response.text:
                    print(f"[Gemini] Final Answer Generated")
                    return response.text.strip()
                
                # If we get here (no text, no function call), something is odd
                print("[Gemini] ⚠️ No text or function call in response.")
                break
            
            return "⚠️ I reached my maximum step limit processing your request."

        except Exception as exc:
            error_str = str(exc).lower()
            
            # Check for rate limit / quota errors
            if "429" in str(exc) or "resource exhausted" in error_str or "quota" in error_str or "rate limit" in error_str:
                print(f"[Gemini] Rate limit hit: {exc}")
                return "⚠️ I've reached my message limit for now. Please try again in a minute or two."
            
            # Check for content blocked / safety errors
            if "blocked" in error_str or "safety" in error_str or "harm" in error_str:
                print(f"[Gemini] Content blocked: {exc}")
                return "I wasn't able to process that message. Could you rephrase it?"
            
            # Check for model not available
            if "model" in error_str and ("not found" in error_str or "unavailable" in error_str):
                print(f"[Gemini] Model error: {exc}")
                return "⚠️ AI service is temporarily unavailable. Please try again shortly."
            
            # Check for audio/media processing errors
            if "audio" in error_str or "media" in error_str or "unsupported" in error_str:
                print(f"[Gemini] Media error: {exc}")
                return "I had trouble processing that media file. Could you try again or send as text?"
            
            # Generic error - log and return friendly message
            print(f"[Gemini] Error: {exc}")
            raise GeminiError(f"Failed to generate suggestion: {exc}") from exc

