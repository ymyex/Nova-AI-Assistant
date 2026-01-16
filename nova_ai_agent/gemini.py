from __future__ import annotations

import textwrap
import subprocess
import sys
import os
from typing import Optional, Dict, Any, List

from google import genai
from google.genai import types
import requests

from .config import Settings
from .exceptions import ConfigurationError, GeminiError
from .models import NovaPayload
from .search_agent import SearchAgent

# Add WhatsApp MCP server to path for importing whatsapp functions
_whatsapp_mcp_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "whatsapp-mcp", "whatsapp-mcp-server")
if _whatsapp_mcp_path not in sys.path:
    sys.path.insert(0, _whatsapp_mcp_path)

# Import WhatsApp functions from MCP server
try:
    from whatsapp import (
        search_contacts as wa_search_contacts,
        list_messages as wa_list_messages,
        list_chats as wa_list_chats,
        get_chat as wa_get_chat,
        get_direct_chat_by_contact as wa_get_direct_chat_by_contact,
        get_contact_chats as wa_get_contact_chats,
        get_last_interaction as wa_get_last_interaction,
        get_message_context as wa_get_message_context,
        send_message as wa_send_message,
        send_file as wa_send_file,
        send_audio_message as wa_send_audio_message,
        download_media as wa_download_media
    )
    WHATSAPP_AVAILABLE = True
except ImportError as e:
    print(f"[Gemini] Warning: WhatsApp functions not available: {e}")
    WHATSAPP_AVAILABLE = False


def get_builtin_tools(google_search: bool = False, url_context: bool = False):
    """Create built-in Gemini tools for real-time web access.
    
    NOTE: These tools CANNOT be combined with function calling tools.
    When enabled, function calling tools (Gmail, OpenCode, WhatsApp) must be disabled.
    
    Args:
        google_search: Enable Google Search Grounding for real-time web search
        url_context: Enable URL Context for analyzing content from specific URLs
    
    Returns:
        List of tool configurations, or None if no tools enabled
    """
    tools = []
    
    if google_search:
        # Google Search Grounding - provides real-time web search with citations
        tools.append(types.Tool(google_search=types.GoogleSearch()))
    
    if url_context:
        # URL Context - allows model to fetch and analyze content from URLs in the prompt
        tools.append({"url_context": {}})
    
    return tools if tools else None


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
    
    # ==================== WhatsApp Tools ====================
    
    def whatsapp_search_contacts(query: str) -> str:
        """Search WhatsApp contacts by name or phone number.
        
        Args:
            query: Search term to match against contact names or phone numbers
        """
        pass
    
    def whatsapp_list_messages(
        chat_jid: Optional[str] = None,
        query: Optional[str] = None,
        sender_phone_number: Optional[str] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: int = 20,
        page: int = 0,
        include_context: bool = True,
        context_before: int = 1,
        context_after: int = 1
    ) -> str:
        """Get WhatsApp messages matching specified criteria with optional context.
        
        Args:
            chat_jid: Optional chat JID to filter messages by chat
            query: Optional search term to filter messages by content
            sender_phone_number: Optional phone number to filter messages by sender
            after: Optional ISO-8601 formatted string to only return messages after this date
            before: Optional ISO-8601 formatted string to only return messages before this date
            limit: Maximum number of messages to return (default 20)
            page: Page number for pagination (default 0)
            include_context: Whether to include messages before and after matches (default True)
            context_before: Number of messages to include before each match (default 1)
            context_after: Number of messages to include after each match (default 1)
        """
        pass
    
    def whatsapp_list_chats(
        query: Optional[str] = None,
        limit: int = 20,
        page: int = 0,
        include_last_message: bool = True,
        sort_by: str = "last_active"
    ) -> str:
        """Get WhatsApp chats matching specified criteria.
        
        Args:
            query: Optional search term to filter chats by name or JID
            limit: Maximum number of chats to return (default 20)
            page: Page number for pagination (default 0)
            include_last_message: Whether to include the last message in each chat (default True)
            sort_by: Field to sort results by, either "last_active" or "name" (default "last_active")
        """
        pass
    
    def whatsapp_get_chat(chat_jid: str, include_last_message: bool = True) -> str:
        """Get WhatsApp chat metadata by JID.
        
        Args:
            chat_jid: The JID of the chat to retrieve
            include_last_message: Whether to include the last message (default True)
        """
        pass
    
    def whatsapp_get_direct_chat_by_contact(sender_phone_number: str) -> str:
        """Get WhatsApp chat metadata by sender phone number.
        
        Args:
            sender_phone_number: The phone number to search for
        """
        pass
    
    def whatsapp_get_contact_chats(jid: str, limit: int = 20, page: int = 0) -> str:
        """Get all WhatsApp chats involving a specific contact.
        
        Args:
            jid: The contact's JID to search for
            limit: Maximum number of chats to return (default 20)
            page: Page number for pagination (default 0)
        """
        pass
    
    def whatsapp_get_last_interaction(jid: str) -> str:
        """Get the most recent WhatsApp message involving a contact.
        
        Args:
            jid: The JID of the contact to search for
        """
        pass
    
    def whatsapp_get_message_context(
        message_id: str,
        before: int = 5,
        after: int = 5
    ) -> str:
        """Get context around a specific WhatsApp message.
        
        Args:
            message_id: The ID of the message to get context for
            before: Number of messages to include before the target message (default 5)
            after: Number of messages to include after the target message (default 5)
        """
        pass
    
    def whatsapp_send_message(recipient: str, message: str) -> str:
        """Send a WhatsApp message to a person or group.
        
        IMPORTANT: When replying to a conversation, use the Chat JID from the context,
        NOT the Sender JID. The Chat JID identifies the conversation (group or direct chat).
        
        Args:
            recipient: The recipient JID - use Chat JID for replies (e.g., "120363420709831061@g.us" for groups,
                      "123456789@s.whatsapp.net" for direct chats)
            message: The message text to send
        """
        pass
    
    def whatsapp_send_file(recipient: str, media_path: str) -> str:
        """Send a file (image, video, document) via WhatsApp.
        
        IMPORTANT: When replying to a conversation, use the Chat JID from the context,
        NOT the Sender JID. The Chat JID identifies the conversation (group or direct chat).
        
        Args:
            recipient: The recipient JID - use Chat JID for replies (e.g., "120363420709831061@g.us" for groups,
                      "123456789@s.whatsapp.net" for direct chats)
            media_path: The absolute path to the media file to send
        """
        pass
    
    def whatsapp_send_audio_message(recipient: str, media_path: str) -> str:
        """Send an audio file as a WhatsApp voice message.
        
        IMPORTANT: When replying to a conversation, use the Chat JID from the context,
        NOT the Sender JID. The Chat JID identifies the conversation (group or direct chat).
        
        Args:
            recipient: The recipient JID - use Chat JID for replies (e.g., "120363420709831061@g.us" for groups,
                      "123456789@s.whatsapp.net" for direct chats)
            media_path: The absolute path to the audio file to send (will be converted to Opus .ogg if needed)
        """
        pass
    
    def whatsapp_download_media(message_id: str, chat_jid: str) -> str:
        """Download media from a WhatsApp message and get the local file path.
        
        Args:
            message_id: The ID of the message containing the media
            chat_jid: The JID of the chat containing the message
        """
        pass
    
    # =========================================================================
    # Web Search Tools - These delegate to SearchAgent for real-time web access
    # =========================================================================
    
    def web_search(query: str) -> str:
        """Search the web for real-time, current information using Google Search.
        
        Use this tool when you need:
        - Current news, events, or information
        - Facts that may have changed recently
        - Information you're not certain about
        - Real-time data (stock prices, weather, sports scores, etc.)
        
        Args:
            query: The search query to find current information about
        
        Returns:
            Search results with relevant information and sources
        """
        pass
    
    def analyze_url_content(url: str, question: str = None) -> str:
        """Fetch and analyze the content of a specific webpage.
        
        Use this tool when:
        - The user provides a URL they want analyzed
        - You need to read the content of a specific webpage
        - You need to summarize or extract information from a link
        
        Args:
            url: The URL of the webpage to analyze
            question: Optional specific question about the content
        
        Returns:
            Analysis or summary of the webpage content
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
        # WhatsApp tools
        whatsapp_search_contacts,
        whatsapp_list_messages,
        whatsapp_list_chats,
        whatsapp_get_chat,
        whatsapp_get_direct_chat_by_contact,
        whatsapp_get_contact_chats,
        whatsapp_get_last_interaction,
        whatsapp_get_message_context,
        whatsapp_send_message,
        whatsapp_send_file,
        whatsapp_send_audio_message,
        whatsapp_download_media,
        # Web Search tools (delegates to SearchAgent)
        web_search,
        analyze_url_content,
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
        
        # Create SearchAgent for web search/URL analysis tools
        # Settings control whether these tools are available
        self._search_agent = SearchAgent(api_key=self._api_key, model_name="gemini-3-pro-preview")
        self._google_search_enabled = settings.google_search_enabled
        self._url_context_enabled = settings.url_context_enabled
        
        # Log initialization
        search_tools = []
        if self._google_search_enabled:
            search_tools.append("web_search")
        if self._url_context_enabled:
            search_tools.append("analyze_url")
        search_tools_str = f" | Search tools: {', '.join(search_tools)}" if search_tools else ""
        
        print(f"[Gemini] Initialized with model: {self._model_name}{search_tools_str}")
    
    def set_research_mode(self, google_search: bool, url_context: bool) -> None:
        """Update research mode settings dynamically.
        
        Args:
            google_search: Enable Google Search Grounding
            url_context: Enable URL Context
        """
        self._google_search_enabled = google_search
        self._url_context_enabled = url_context
        print(f"[Gemini] Research mode updated: Google Search={google_search}, URL Context={url_context}")
    
    def get_research_mode(self) -> Dict[str, bool]:
        """Get current research mode settings."""
        return {
            "google_search_enabled": self._google_search_enabled,
            "url_context_enabled": self._url_context_enabled
        }
    
    def is_research_mode_enabled(self) -> bool:
        """Check if any research mode tool is enabled."""
        return self._google_search_enabled or self._url_context_enabled
    
    def set_tools(self, tools) -> None:
        """Set the tools instance for function execution."""
        self._tools = tools
    
    def set_opencode_client(self, opencode_client) -> None:
        """Set the OpenCode client for agentic coding operations."""
        self._opencode_client = opencode_client
        print("[Gemini] OpenCode client connected")

    def generate_chat_title(self, user_message: str, assistant_response: str = "") -> str:
        """Generate a short 2-3 word title for a chat conversation.
        
        Args:
            user_message: The user's first message
            assistant_response: Optional assistant response (not required)
            
        Returns:
            A short title (2-3 words max)
        """
        try:
            prompt = f"""Generate a very short title (2-3 words maximum) for this conversation based on the user's message.
The title should capture the main topic or intent.
Return ONLY the title, nothing else. No quotes, no punctuation at the end.

User message: {user_message[:300]}

Title:"""
            
            # Use a simpler, faster model call without tools
            response = self._client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=20,
                )
            )
            
            if response.text:
                # Clean up the title - remove quotes, extra whitespace, limit to 3 words
                title = response.text.strip().strip('"\'').strip()
                words = title.split()[:3]  # Max 3 words
                return " ".join(words)
            
            return ""
        except Exception as e:
            print(f"[Gemini] Error generating chat title: {e}")
            return ""

    def _get_tool_description(self, tool_name: str, args: dict) -> str:
        """Generate a human-readable description of what a tool will do."""
        descriptions = {
            # Gmail tools
            "gmail_read_inbox": "Let me check your Gmail inbox...",
            "gmail_search": f"Searching your emails for '{args.get('query', 'messages')}'...",
            "gmail_send_email": f"Sending an email to {args.get('to', 'recipient')}...",
            "gmail_get_unread_count": "Checking your unread email count...",
            "gmail_read_email": "Reading that email for you...",
            "gmail_get_labels": "Getting your Gmail labels...",
            "gmail_check_status": "Checking Gmail connection status...",
            
            # System commands
            "run_system_command": f"Running command: `{args.get('command', 'command')[:50]}`...",
            
            # OpenCode tools
            "opencode_start_server": f"Starting OpenCode server for {args.get('project_path', 'project')}...",
            "opencode_stop_server": "Stopping the OpenCode server...",
            "opencode_get_server_status": "Checking OpenCode server status...",
            "opencode_create_session": "Creating a new coding session...",
            "opencode_send_task": "Sending a task to the coding agent...",
            "opencode_list_sessions": "Listing active coding sessions...",
            "opencode_get_messages": "Getting messages from the coding session...",
            "opencode_abort_task": "Aborting the current task...",
            "opencode_revert_changes": "Reverting recent changes...",
            "opencode_summarize": "Summarizing the session...",
            "opencode_find_files": f"Searching for files matching '{args.get('pattern', 'pattern')}'...",
            "opencode_find_text": f"Searching for '{args.get('text', 'text')[:30]}' in files...",
            "opencode_read_file": f"Reading file: {args.get('path', 'file')[:50]}...",
            "opencode_check_status": "Checking OpenCode connection...",
            
            # WhatsApp tools
            "whatsapp_search_contacts": f"Searching WhatsApp contacts for '{args.get('query', 'contacts')}'...",
            "whatsapp_list_messages": "Retrieving WhatsApp messages...",
            "whatsapp_list_chats": "Listing WhatsApp chats...",
            "whatsapp_get_chat": "Getting chat information...",
            "whatsapp_get_direct_chat_by_contact": f"Finding chat with {args.get('sender_phone_number', 'contact')}...",
            "whatsapp_get_contact_chats": "Getting all chats with contact...",
            "whatsapp_get_last_interaction": "Getting last interaction...",
            "whatsapp_get_message_context": "Getting message context...",
            "whatsapp_send_message": f"Sending WhatsApp message to {args.get('recipient', 'recipient')[:20]}...",
            "whatsapp_send_file": f"Sending file via WhatsApp...",
            "whatsapp_send_audio_message": "Sending voice message...",
            "whatsapp_download_media": "Downloading media from message...",
        }
        
        return descriptions.get(tool_name, f"Using {tool_name}...")

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

## WHATSAPP INTEGRATION

You have **FULL** access to WhatsApp messaging capabilities via these tools:

### Contact & Chat Discovery
| Tool | Purpose |
|------|---------|
| `whatsapp_search_contacts` | Search contacts by name or phone number |
| `whatsapp_list_chats` | List available chats with metadata |
| `whatsapp_get_chat` | Get information about a specific chat by JID |
| `whatsapp_get_direct_chat_by_contact` | Find a direct chat with a contact |
| `whatsapp_get_contact_chats` | List all chats involving a specific contact |

### Message Retrieval
| Tool | Purpose |
|------|---------|
| `whatsapp_list_messages` | Retrieve messages with filters and context |
| `whatsapp_get_last_interaction` | Get the most recent message with a contact |
| `whatsapp_get_message_context` | Retrieve context around a specific message |

### Sending
| Tool | Purpose |
|------|---------|
| `whatsapp_send_message` | Send a message to a phone number or group JID |
| `whatsapp_send_file` | Send a file (image, video, document) |
| `whatsapp_send_audio_message` | Send an audio file as a voice message |

### Media
| Tool | Purpose |
|------|---------|
| `whatsapp_download_media` | Download media from a message |

**CRITICAL**: 
- You CAN read WhatsApp chat history - do NOT say you can't.
- You CAN send messages on WhatsApp - do NOT say you can't.
- For phone numbers, use country code without + or symbols (e.g., "1234567890")
- For groups, use the JID format (e.g., "123456789@g.us")


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

        # Build recipient info - chat_jid is the PRIMARY destination for sending messages/files
        chat_jid = message.chat_jid or ""
        sender_jid = message.sender_jid or message.sender_phone or ""
        
        prompt = textwrap.dedent(
            f"""
            {system_instructions}

            ## CURRENT CONTEXT

            **Chat:** {chat}
            **Chat JID:** {chat_jid}
            **Sender:** {sender}
            **Sender JID:** {sender_jid}

            **IMPORTANT**: When sending WhatsApp messages or files back to this conversation,
            use the **Chat JID** (`{chat_jid}`) as the recipient, NOT the Sender JID.

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
            
            # ==================== WhatsApp Handlers ====================
            
            elif function_name == "whatsapp_search_contacts":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                query = args.get("query", "")
                if not query:
                    return "query is required for whatsapp_search_contacts"
                try:
                    contacts = wa_search_contacts(query)
                    import json
                    return json.dumps(contacts, indent=2, default=str)
                except Exception as e:
                    return f"Error searching contacts: {str(e)}"
            
            elif function_name == "whatsapp_list_messages":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                try:
                    messages = wa_list_messages(
                        after=args.get("after"),
                        before=args.get("before"),
                        sender_phone_number=args.get("sender_phone_number"),
                        chat_jid=args.get("chat_jid"),
                        query=args.get("query"),
                        limit=args.get("limit", 20),
                        page=args.get("page", 0),
                        include_context=args.get("include_context", True),
                        context_before=args.get("context_before", 1),
                        context_after=args.get("context_after", 1)
                    )
                    import json
                    return json.dumps(messages, indent=2, default=str)
                except Exception as e:
                    return f"Error listing messages: {str(e)}"
            
            elif function_name == "whatsapp_list_chats":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                try:
                    chats = wa_list_chats(
                        query=args.get("query"),
                        limit=args.get("limit", 20),
                        page=args.get("page", 0),
                        include_last_message=args.get("include_last_message", True),
                        sort_by=args.get("sort_by", "last_active")
                    )
                    import json
                    return json.dumps(chats, indent=2, default=str)
                except Exception as e:
                    return f"Error listing chats: {str(e)}"
            
            elif function_name == "whatsapp_get_chat":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                chat_jid = args.get("chat_jid", "")
                if not chat_jid:
                    return "chat_jid is required for whatsapp_get_chat"
                try:
                    chat = wa_get_chat(
                        chat_jid,
                        include_last_message=args.get("include_last_message", True)
                    )
                    import json
                    return json.dumps(chat, indent=2, default=str)
                except Exception as e:
                    return f"Error getting chat: {str(e)}"
            
            elif function_name == "whatsapp_get_direct_chat_by_contact":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                sender_phone_number = args.get("sender_phone_number", "")
                if not sender_phone_number:
                    return "sender_phone_number is required for whatsapp_get_direct_chat_by_contact"
                try:
                    chat = wa_get_direct_chat_by_contact(sender_phone_number)
                    import json
                    return json.dumps(chat, indent=2, default=str)
                except Exception as e:
                    return f"Error getting direct chat: {str(e)}"
            
            elif function_name == "whatsapp_get_contact_chats":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                jid = args.get("jid", "")
                if not jid:
                    return "jid is required for whatsapp_get_contact_chats"
                try:
                    chats = wa_get_contact_chats(
                        jid,
                        limit=args.get("limit", 20),
                        page=args.get("page", 0)
                    )
                    import json
                    return json.dumps(chats, indent=2, default=str)
                except Exception as e:
                    return f"Error getting contact chats: {str(e)}"
            
            elif function_name == "whatsapp_get_last_interaction":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                jid = args.get("jid", "")
                if not jid:
                    return "jid is required for whatsapp_get_last_interaction"
                try:
                    message = wa_get_last_interaction(jid)
                    return str(message)
                except Exception as e:
                    return f"Error getting last interaction: {str(e)}"
            
            elif function_name == "whatsapp_get_message_context":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                message_id = args.get("message_id", "")
                if not message_id:
                    return "message_id is required for whatsapp_get_message_context"
                try:
                    context = wa_get_message_context(
                        message_id,
                        before=args.get("before", 5),
                        after=args.get("after", 5)
                    )
                    import json
                    return json.dumps(context, indent=2, default=str)
                except Exception as e:
                    return f"Error getting message context: {str(e)}"
            
            elif function_name == "whatsapp_send_message":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                recipient = args.get("recipient", "")
                message = args.get("message", "")
                if not recipient:
                    return "recipient is required for whatsapp_send_message"
                if not message:
                    return "message is required for whatsapp_send_message"
                try:
                    success, status_message = wa_send_message(recipient, message)
                    return f"Success: {success}, Message: {status_message}"
                except Exception as e:
                    return f"Error sending message: {str(e)}"
            
            elif function_name == "whatsapp_send_file":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                recipient = args.get("recipient", "")
                media_path = args.get("media_path", "")
                if not recipient:
                    return "recipient is required for whatsapp_send_file"
                if not media_path:
                    return "media_path is required for whatsapp_send_file"
                try:
                    success, status_message = wa_send_file(recipient, media_path)
                    return f"Success: {success}, Message: {status_message}"
                except Exception as e:
                    return f"Error sending file: {str(e)}"
            
            elif function_name == "whatsapp_send_audio_message":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                recipient = args.get("recipient", "")
                media_path = args.get("media_path", "")
                if not recipient:
                    return "recipient is required for whatsapp_send_audio_message"
                if not media_path:
                    return "media_path is required for whatsapp_send_audio_message"
                try:
                    success, status_message = wa_send_audio_message(recipient, media_path)
                    return f"Success: {success}, Message: {status_message}"
                except Exception as e:
                    return f"Error sending audio message: {str(e)}"
            
            elif function_name == "whatsapp_download_media":
                if not WHATSAPP_AVAILABLE:
                    return "WhatsApp functions are not available."
                message_id = args.get("message_id", "")
                chat_jid = args.get("chat_jid", "")
                if not message_id:
                    return "message_id is required for whatsapp_download_media"
                if not chat_jid:
                    return "chat_jid is required for whatsapp_download_media"
                try:
                    file_path = wa_download_media(message_id, chat_jid)
                    if file_path:
                        return f"Media downloaded successfully to: {file_path}"
                    else:
                        return "Failed to download media"
                except Exception as e:
                    return f"Error downloading media: {str(e)}"
            
            # ==================== Web Search Handlers ====================
            # These tools delegate to SearchAgent for real-time web access
            
            elif function_name == "web_search":
                query = args.get("query", "")
                if not query:
                    return "query is required for web_search"
                try:
                    result = self._search_agent.search_web(query)
                    if result.get("success"):
                        # Format response for the agent
                        response = f"**Search Results for: {query}**\n\n"
                        response += result.get("answer", "No answer found.")
                        if result.get("sources"):
                            response += "\n\n**Sources:**\n"
                            for source in result["sources"][:5]:  # Limit to 5 sources
                                response += f"- [{source.get('title', 'Source')}]({source.get('url', '')})\n"
                        return response
                    else:
                        return f"Search failed: {result.get('error', 'Unknown error')}"
                except Exception as e:
                    return f"Error performing web search: {str(e)}"
            
            elif function_name == "analyze_url_content":
                url = args.get("url", "")
                question = args.get("question", None)
                if not url:
                    return "url is required for analyze_url_content"
                try:
                    result = self._search_agent.analyze_url(url, question)
                    if result.get("success"):
                        response = f"**Analysis of: {url}**\n\n"
                        response += result.get("answer", "No analysis available.")
                        return response
                    else:
                        return f"URL analysis failed: {result.get('error', 'Unknown error')}"
                except Exception as e:
                    return f"Error analyzing URL: {str(e)}"
            
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
                
                # Generate content - always use function calling tools
                # Web search is now a tool that delegates to SearchAgent
                response = self._client.models.generate_content(
                    model=self._model_name,
                    contents=chat_history,
                    config=types.GenerateContentConfig(
                        temperature=1.0,
                        top_p=0.95,
                        tools=get_tools(),
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                        thinking_config=types.ThinkingConfig(
                            thinking_level=thinking_level,
                            include_thoughts=True
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

    def generate_suggestion_stream(
        self, 
        message: str, 
        chat_history: Optional[List[Dict[str, str]]] = None,
        media_data: Optional[bytes] = None, 
        media_mime_type: Optional[str] = None,
        model_override: Optional[str] = None
    ):
        """Generator that yields AgentEvent objects during processing for SSE streaming.
        
        This method is similar to generate_suggestion but yields events instead of
        returning a final string, enabling the dashboard chat UI to show real-time
        progress including thinking steps and tool calls.
        
        Args:
            message: The user's message text
            chat_history: Optional list of previous messages as dicts with 'role' and 'content'
                         keys. These are prepended to give the model conversation context.
            media_data: Optional binary media data
            media_mime_type: Optional MIME type for media
            
        Yields:
            dict: Event dictionaries with type and content
        """
        from .models import AgentEvent
        
        # Build a simpler prompt for the chat UI (no WhatsApp context)
        system_prompt = """You are Nova, a helpful AI assistant with access to tools.

AVAILABLE TOOLS:
- run_system_command: Execute system commands
- gmail_read_inbox, gmail_search, gmail_send_email, etc.: Gmail operations  
- opencode_* tools: Agentic coding tasks

IMPORTANT BEHAVIOR:
- When you need to use a tool, first briefly explain what you're about to do and why
- After getting tool results, explain what you found or what happened
- Be conversational - the user wants to see your thought process
- Keep explanations concise but informative
- Always communicate in English unless explicitly asked otherwise

Example flow:
User: "Check my emails"
You: "I'll check your Gmail inbox to see your recent messages." [then call gmail_read_inbox]
After result: "You have 5 unread emails. Here are the most recent ones: ..."

Now respond to the user:"""

        # Use override if provided, else default to configured model
        model_to_use = model_override or self._model_name
        
        MAX_STEPS = 100
        current_step = 0
        gemini_history = []
        
        # Build history from previous messages if provided
        if chat_history:
            for msg in chat_history:
                role = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", "")
                if content:
                    gemini_history.append(types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=content)]
                    ))
        
        # Add media if present
        if media_data and media_mime_type:
            gemini_history.append(types.Content(
                parts=[types.Part.from_bytes(data=media_data, mime_type=media_mime_type)]
            ))
            message += "\n\n[SYSTEM: The user has attached media above. Analyze it to answer their request.]"
        
        # Build the current prompt - include system prompt only if no history
        if gemini_history:
            # We have history, just add the new user message
            current_prompt = message
        else:
            # No history, include system prompt
            current_prompt = f"{system_prompt}\n\nUser: {message}\n\nYour Response:"
        
        gemini_history.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=current_prompt)]
        ))
        
        try:
            while current_step < MAX_STEPS:
                current_step += 1
                
                # Yield thinking event
                # yield {"type": "thinking", "content": f"Processing step {current_step}..."}

                
                # Determine thinking level based on model being used
                thinking_level = "high" if "flash" in model_to_use.lower() else "high"
                
                # Generate content with STREAMING for word-by-word output
                # Always use function calling tools - web search now delegates to SearchAgent
                response_stream = self._client.models.generate_content_stream(
                    model=model_to_use,
                    contents=gemini_history,
                    config=types.GenerateContentConfig(
                        temperature=1.0,
                        top_p=0.95,
                        tools=get_tools(),
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                        thinking_config=types.ThinkingConfig(
                            thinking_level=thinking_level,
                            include_thoughts=True
                        )
                    )
                )
                
                # Accumulate parts from streaming chunks for function call detection
                accumulated_parts = []
                text_parts = []
                function_calls = []
                
                # Process streaming chunks - yield text immediately for word-by-word output
                for chunk in response_stream:
                    if chunk.candidates and chunk.candidates[0].content.parts:
                        for part in chunk.candidates[0].content.parts:
                            accumulated_parts.append(part)
                            
                            # Check if this is a thought
                            is_thought = False
                            if hasattr(part, 'thought') and part.thought:
                                is_thought = True
                                # If part.thought is a string, use it. If it's True (bool), use part.text
                                thought_content = part.text if hasattr(part, 'text') and part.text else ""
                                if hasattr(part, 'thought') and isinstance(part.thought, str):
                                    thought_content = part.thought
                                
                                if thought_content:
                                    yield {"type": "thinking", "content": thought_content}
                            
                            # Stream text immediately as it arrives (only if NOT a thought)
                            if not is_thought and hasattr(part, 'text') and part.text:
                                yield {"type": "text", "content": part.text}
                                text_parts.append(part.text)
                            
                            # Collect function calls
                            if hasattr(part, 'function_call') and part.function_call:
                                function_calls.append(part.function_call)
                
                # Build the full content from accumulated parts for history
                full_content = types.Content(
                    role="model",
                    parts=accumulated_parts
                )
                gemini_history.append(full_content)
                
                # Process function calls if present
                if function_calls:
                    for call in function_calls:
                        function_name = call.name
                        function_args = dict(call.args) if call.args else {}
                        
                        # Yield tool call start event
                        yield {
                            "type": "tool_call_start",
                            "name": function_name,
                            "args": function_args
                        }
                        
                        # Execute the function
                        function_result = self._execute_function(function_name, function_args)
                        
                        # Yield tool call result event (full result - frontend handles display truncation)
                        yield {
                            "type": "tool_call_result",
                            "name": function_name,
                            "result": function_result
                        }
                        
                        # Add function response to history
                        tool_response_part = types.Part.from_function_response(
                            name=function_name,
                            response={"result": function_result}
                        )
                        
                        gemini_history.append(types.Content(
                            role="tool",
                            parts=[tool_response_part]
                        ))
                    
                    # Continue loop to let model process results
                    continue
                
                # If we got text but no function calls, that's the final answer
                if text_parts:
                    yield {"type": "done"}
                    return
                
                # No text or function call - unusual
                yield {"type": "error", "content": "Unexpected response from AI model."}
                yield {"type": "done"}
                return
            
            # Max steps reached
            yield {"type": "error", "content": "Maximum processing steps reached."}
            yield {"type": "done"}
            
        except Exception as exc:
            error_str = str(exc).lower()
            
            if "429" in str(exc) or "resource exhausted" in error_str or "quota" in error_str:
                yield {"type": "error", "content": "Rate limit reached. Please try again in a moment."}
            elif "blocked" in error_str or "safety" in error_str:
                yield {"type": "error", "content": "Message was blocked. Please rephrase."}
            elif "model" in error_str and ("not found" in error_str or "unavailable" in error_str):
                yield {"type": "error", "content": "AI service temporarily unavailable."}
            else:
                yield {"type": "error", "content": f"Error: {str(exc)[:200]}"}
            
            yield {"type": "done"}


