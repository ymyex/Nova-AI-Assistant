from __future__ import annotations

import textwrap
from typing import Optional, Dict, Any

from google import genai
from google.genai import types
import requests

from .config import Settings
from .exceptions import ConfigurationError, GeminiError
from .models import SuggestionPayload


def get_gmail_tools():
    """Define Gmail tools as callable functions for the new SDK."""
    
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
    
    return [
        gmail_read_inbox,
        gmail_search,
        gmail_send_email,
        gmail_get_unread_count,
        gmail_read_email,
        gmail_get_labels,
        gmail_check_status
    ]


class GeminiClient:
    """Wrapper around the Google GenAI SDK with thinking and function calling support."""

    def __init__(self, settings: Settings, session: Optional[requests.Session] = None) -> None:
        if not settings.gemini_api_key:
            raise ConfigurationError("GEMINI_API_KEY must be configured before using the Gemini client")

        self._api_key = settings.gemini_api_key
        self._model_name = settings.gemini_model
        self._gmail_tools = None  # Will be set externally
        
        # Create the new SDK client
        self._client = genai.Client(api_key=self._api_key)
        
        print(f"[Gemini] Initialized with model: {self._model_name} (new SDK with thinking support)")
    
    def set_gmail_tools(self, gmail_tools) -> None:
        """Set the Gmail tools instance for function execution."""
        self._gmail_tools = gmail_tools

    def _build_prompt(self, payload: SuggestionPayload, gmail_context: str = "") -> str:
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

        # Gmail capabilities info
        gmail_info = """
            
            CAPABILITIES: 
            - You have full access to the user's Gmail account through function calls.
            - You can read emails, search emails, send emails, check unread count, and more.
            - When users ask about their emails, USE YOUR GMAIL FUNCTIONS to actually access their email.
            - You CAN process audio messages and images that are sent to you - analyze them and respond.
            - Do not say you can't listen to audio - you CAN process audio messages.
            - Do not say you don't have Gmail access - you DO have access through function calling."""

        prompt = textwrap.dedent(
            f"""
            You are Nova, a helpful AI assistant in the "{chat}" WhatsApp group. 
            Reply directly to the message from {sender} concisely and helpfully.
            Keep the tone friendly and respectful, avoid emojis unless context strongly suggests them, and limit yourself to at most three sentences.
            Do not wrap your response in quotes, do not include salutations like "Hi" or "Hello", and do not mention that you are an AI.
            
            CRITICAL INSTRUCTION: Analyze any attached media (images, audio, documents) IMMEDIATELY and provide your response in this message. 
            Do NOT defer the task. Do NOT say "I will review this" or "Summary coming shortly". 
            If the user asks for a summary, provide the summary NOW.
            
            {gmail_info}

            Conversation context:
            {context_block}

            Incoming message from {sender}:{media_context}
            {message.text.strip()}

            Your response:
            """
        ).strip()

        return prompt
    
    def _execute_function(self, function_name: str, args: Dict[str, Any]) -> str:
        """Execute a Gmail function and return the result."""
        if not self._gmail_tools:
            return "Gmail is not connected. Please connect Gmail first through the web interface."
        
        try:
            if function_name == "gmail_read_inbox":
                count = args.get("count", 5)
                return self._gmail_tools.read_inbox(count)
            
            elif function_name == "gmail_search":
                query = args.get("query", "")
                count = args.get("count", 5)
                return self._gmail_tools.search_emails(query, count)
            
            elif function_name == "gmail_send_email":
                to = args.get("to", "")
                subject = args.get("subject", "")
                body = args.get("body", "")
                return self._gmail_tools.send_email(to, subject, body)
            
            elif function_name == "gmail_get_unread_count":
                return self._gmail_tools.get_unread_count()
            
            elif function_name == "gmail_read_email":
                message_id = args.get("message_id", "")
                return self._gmail_tools.read_email(message_id)
            
            elif function_name == "gmail_get_labels":
                return self._gmail_tools.get_labels()
            
            elif function_name == "gmail_check_status":
                status = self._gmail_tools.get_status()
                if status["connected"]:
                    return f"Gmail is connected as {status['email']}"
                return "Gmail is not connected"
            
            else:
                return f"Unknown function: {function_name}"
                
        except Exception as e:
            return f"Error executing {function_name}: {str(e)}"

    def generate_suggestion(self, payload: SuggestionPayload, media_data: Optional[bytes] = None, media_mime_type: Optional[str] = None) -> str:
        prompt = self._build_prompt(payload)
        
        # Build content parts - media first, then text
        content_parts = []
        if media_data and media_mime_type:
            content_parts.append(types.Part.from_bytes(data=media_data, mime_type=media_mime_type))
            prompt += "\n\n[SYSTEM: The user has attached the media file above. The text below is a CAPTION for this media. Analyze the media to answer the user's request.]"
        
        content_parts.append(prompt)

        try:
            # Determine thinking level based on model
            # Gemini 3 Flash supports: minimal, low, medium, high
            # Gemini 3 Pro supports: low, high
            thinking_level = "high"
            if "flash" in self._model_name.lower():
                thinking_level = "high"  # Can also use "medium" for balanced
            
            print(f"[Gemini] 🧠 Thinking mode enabled (level: {thinking_level})")
            
            # Generate content with thinking enabled and function calling
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=content_parts,
                config=types.GenerateContentConfig(
                    temperature=1.0,  # Recommended for thinking models
                    top_p=0.95,
                    tools=get_gmail_tools(),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    thinking_config=types.ThinkingConfig(
                        thinking_level=thinking_level
                    )
                )
            )
            
            # Log any thinking/thoughts from the model
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'thought') and part.thought:
                        print(f"[Gemini] 💭 Model thought: {str(part.thought)[:300]}...")
            
            # Check if the model wants to call a function
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        function_name = function_call.name
                        function_args = dict(function_call.args) if function_call.args else {}
                        
                        print(f"[Gemini] Calling function: {function_name} with args: {function_args}")
                        
                        # Execute the function
                        function_result = self._execute_function(function_name, function_args)
                        
                        print(f"[Gemini] Function result: {function_result[:200]}...")
                        
                        # Send the function result back to get a natural response
                        followup_response = self._client.models.generate_content(
                            model=self._model_name,
                            contents=f"""Based on this Gmail data, provide a brief, helpful response to the user.
                            Keep it concise (max 2-3 sentences). Format nicely for WhatsApp.
                            
                            Gmail Data:
                            {function_result}
                            
                            Original user question: {payload.message.text}
                            
                            Your response:""",
                            config=types.GenerateContentConfig(
                                temperature=1.0,
                                thinking_config=types.ThinkingConfig(
                                    thinking_level="medium"  # Balanced for follow-up
                                )
                            )
                        )
                        
                        if followup_response.text:
                            return followup_response.text.strip()
            
            # Regular text response
            if response.text:
                return response.text.strip()
            
            raise GeminiError("Gemini API returned empty response")

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

