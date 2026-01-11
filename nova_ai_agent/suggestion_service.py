from datetime import datetime
from typing import List, Optional

from .exceptions import GeminiError, WhatsAppError
from .gemini import GeminiClient
from .models import ActivityLogEntry, SuggestionPayload, SuggestionResult
from .whatsapp import WhatsAppClient
from .gmail_tools import GmailAITools


class SuggestionService:
    """Coordinates Gemini analysis with WhatsApp delivery."""

    def __init__(
        self, 
        gemini_client: GeminiClient, 
        whatsapp_client: WhatsAppClient,
        gmail_tools: Optional[GmailAITools] = None
    ) -> None:
        self._gemini = gemini_client
        self._whatsapp = whatsapp_client
        self._gmail_tools = gmail_tools or GmailAITools()
        self.logs: List[ActivityLogEntry] = []
        self.total_count = 0
        self.failure_count = 0
        self._start_time = datetime.now()
    
    def set_gmail_tools(self, gmail_tools: GmailAITools) -> None:
        """Set or update Gmail tools."""
        self._gmail_tools = gmail_tools

    def _handle_command(self, text: str) -> str:
        parts = text.strip().split()
        if len(parts) < 2:
            return "🤖 Command missing. Use '!nova help' for commands."
        
        cmd = parts[1].lower()
        
        # Gmail commands
        if cmd == "gmail":
            return self._gmail_tools.process_gmail_command(text)
        
        if cmd == "status":
            uptime = datetime.now() - self._start_time
            hours, remainder = divmod(int(uptime.total_seconds()), 3600)
            minutes, seconds = divmod(remainder, 60)
            uptime_str = f"{hours}h {minutes}m {seconds}s"
            
            gmail_status = "✅ Connected" if self._gmail_tools.is_available else "❌ Not Connected"
            
            return (
                f"🌟 *Nova Status Report*\n\n"
                f"✅ *System*: Active\n"
                f"⏱️ *Uptime*: {uptime_str}\n"
                f"📊 *Total Req*: {self.total_count}\n"
                f"❌ *Failures*: {self.failure_count}\n"
                f"🤖 *AI Agent*: Ready\n"
                f"📧 *Gmail*: {gmail_status}"
            )
        elif cmd == "help":
            gmail_help = "\n📧 *Gmail*:\n• `!nova gmail help` - Gmail commands" if True else ""
            return (
                f"🤖 *Nova Assistant Help*\n\n"
                f"📊 *General*:\n"
                f"• `!nova status` - View system metrics\n"
                f"• `!nova help` - Show this list\n"
                f"{gmail_help}"
            )
        return f"❌ Unknown command '{cmd}'. Try `!nova help`."

    def generate_and_send(self, payload: SuggestionPayload) -> SuggestionResult:
        message_text = payload.message.text.strip()
        is_command = message_text.lower().startswith("!nova")

        entry = ActivityLogEntry(
            timestamp=datetime.now(),
            message_text=message_text,
            sender=payload.message.sender_name or payload.message.sender_phone or "Unknown",
            status="pending"
        )
        self.logs.append(entry)
        self.total_count += 1

        try:
            if is_command:
                suggestion = self._handle_command(message_text)
                entry.status = "command"
            else:
                media_data = None
                media_mime_type = None

                # Check for media and download if present
                if payload.message.media_type and payload.message.message_id:
                    try:
                        import requests
                        download_url = "http://localhost:8080/api/download" 
                        print(f"Attempting to download media for message {payload.message.message_id}")
                        
                        resp = requests.post(download_url, json={
                            "message_id": payload.message.message_id,
                            "chat_jid": payload.message.chat_jid,
                            "session": "monitoring"
                        }, timeout=30)
                        
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("success") and data.get("path"):
                                file_path = data["path"]
                                media_type = payload.message.media_type
                                
                                if media_type == "image":
                                    media_mime_type = "image/jpeg"
                                    if file_path.lower().endswith(".png"): media_mime_type = "image/png"
                                    elif file_path.lower().endswith(".webp"): media_mime_type = "image/webp"
                                elif media_type == "audio":
                                    media_mime_type = "audio/ogg"
                                    if file_path.lower().endswith(".mp3"): media_mime_type = "audio/mpeg"
                                elif media_type == "video":
                                    media_mime_type = "video/mp4"
                                    if ext in ["mov", "quicktime"]: media_mime_type = "video/quicktime"
                                    elif ext in ["mpeg", "mpg"]: media_mime_type = "video/mpeg"
                                    elif ext == "avi": media_mime_type = "video/x-msvideo"
                                    elif ext == "wmv": media_mime_type = "video/x-ms-wmv"
                                    elif ext == "flv": media_mime_type = "video/x-flv"
                                    elif ext == "webm": media_mime_type = "video/webm"
                                    elif ext == "3gp": media_mime_type = "video/3gpp"
                                elif media_type == "document":
                                    ext = file_path.lower().split('.')[-1] if '.' in file_path else ""
                                    # Documents
                                    if ext == "pdf": media_mime_type = "application/pdf"
                                    elif ext in ["doc", "docx"]: media_mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    elif ext == "rtf": media_mime_type = "application/rtf"
                                    elif ext in ["dot", "dotx"]: media_mime_type = "application/msword" # Fallback or specific
                                    elif ext in ["hwp", "hwpx"]: media_mime_type = "application/x-hwp"
                                    # Spreadsheets
                                    elif ext in ["xls", "xlsx"]: media_mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    elif ext == "csv": media_mime_type = "text/csv"
                                    elif ext == "tsv": media_mime_type = "text/tab-separated-values"
                                    # Presentations
                                    elif ext in ["ppt", "pptx"]: media_mime_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                    # Text / Code
                                    elif ext in ["txt", "text"]: media_mime_type = "text/plain"
                                    elif ext in ["md", "markdown"]: media_mime_type = "text/md"
                                    elif ext == "html": media_mime_type = "text/html"
                                    elif ext == "css": media_mime_type = "text/css"
                                    elif ext == "js": media_mime_type = "text/javascript"
                                    elif ext == "py": media_mime_type = "text/x-python"
                                    elif ext == "json": media_mime_type = "application/json"
                                    elif ext == "xml": media_mime_type = "text/xml"
                                    # Images
                                    elif ext in ["jpg", "jpeg"]: media_mime_type = "image/jpeg"
                                    elif ext == "png": media_mime_type = "image/png"
                                    elif ext == "webp": media_mime_type = "image/webp"
                                    elif ext in ["heic", "heif"]: media_mime_type = "image/heif"
                                    # Audio in documents?
                                    elif ext == "mp3": media_mime_type = "audio/mpeg"
                                    elif ext == "wav": media_mime_type = "audio/wav"
                                    elif ext == "aac": media_mime_type = "audio/aac"
                                    elif ext == "flac": media_mime_type = "audio/flac"
                                    elif ext == "ogg": media_mime_type = "audio/ogg"


                                    
                                    # Check if text-based
                                    is_text = False
                                    if ext in ["txt", "text", "md", "markdown", "csv", "tsv", "html", "css", "js", "py", "json", "xml"]:
                                        is_text = True
                                        
                                    if is_text:
                                        try:
                                            with open(file_path, "r", encoding="utf-8") as f:
                                                text_content = f.read()
                                            
                                            # Append to message text for better processing
                                            payload.message.text += f"\n\n[Attached File Content ({file_path})]:\n{text_content}"
                                            print(f"Read {len(text_content)} chars from text file")
                                            # Don't send as blob
                                            media_data = None
                                            media_mime_type = None
                                        except UnicodeDecodeError:
                                            # Fallback to blob if not valid utf-8
                                            print("Failed to read as text, falling back to blob")
                                            is_text = False
                                    
                                    if not is_text:
                                        with open(file_path, "rb") as f:
                                            media_data = f.read()
                                        print(f"Downloaded {len(media_data)} bytes of media")
                                        
                    except Exception as e:
                        print(f"Failed to download media: {e}")

                suggestion = self._gemini.generate_suggestion(payload, media_data=media_data, media_mime_type=media_mime_type)
                if not suggestion:
                    raise GeminiError("Gemini returned an empty suggestion")
            
            entry.suggestion = suggestion
            override_group = payload.force_group_name or payload.message.chat_name
            group_jid, delivered, detail = self._whatsapp.send_suggestion(suggestion, override_group)

            if not delivered:
                raise WhatsAppError(detail or "WhatsApp bridge reported a failure while sending the suggestion")

            entry.status = "success"
            entry.details = detail or "Delivery confirmed"

            return SuggestionResult(
                suggestion=suggestion,
                group_jid=group_jid,
                delivered=delivered,
                details=detail or "Delivery confirmed",
            )
        except Exception as exc:
            entry.status = "failure"
            entry.details = str(exc)
            self.failure_count += 1
            raise

