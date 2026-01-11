from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ContextMessage(BaseModel):
    role: str = Field(description="Role of the speaker, e.g. sender, recipient, system")
    sender: Optional[str] = Field(default=None, description="Display name or identifier of the speaker")
    text: str = Field(description="Message text content")
    timestamp: Optional[datetime] = Field(default=None, description="Timestamp of the message if available")


class IncomingMessage(BaseModel):
    message_id: Optional[str] = Field(default=None, description="WhatsApp message identifier")
    chat_name: Optional[str] = Field(default=None, description="Human readable chat name")
    chat_jid: Optional[str] = Field(default=None, description="WhatsApp JID for the chat")
    sender_name: Optional[str] = Field(default=None, description="Display name of the message sender")
    sender_jid: Optional[str] = Field(default=None, description="Sender WhatsApp JID")
    sender_phone: Optional[str] = Field(default=None, description="Sender phone number without +")
    text: str = Field(description="Message body text")
    media_type: Optional[str] = Field(default=None, description="Type of media (image, audio, video, etc)")
    context: List[ContextMessage] = Field(default_factory=list, description="Additional context messages")


class SuggestionPayload(BaseModel):
    message: IncomingMessage
    force_group_name: Optional[str] = Field(default=None, description="Override target group name")


class SuggestionResult(BaseModel):
    suggestion: str
    group_jid: str
    delivered: bool
    details: str


class SuggestionResponse(BaseModel):
    success: bool
    result: Optional[SuggestionResult] = None
    error: Optional[str] = None


class ActivityLogEntry(BaseModel):
    timestamp: datetime
    message_text: str
    sender: str
    suggestion: Optional[str] = None
    status: str  # "success", "failure", "pending"
    details: Optional[str] = None


class SessionStatus(BaseModel):
    connected: bool
    paired: bool
    connecting: bool
    qr: Optional[str] = None


class SystemStatus(BaseModel):
    uptime_seconds: float
    gemini_connected: bool
    
    # Dual sessions
    monitoring: SessionStatus
    replying: SessionStatus
    
    total_suggestions: int
    failed_suggestions: int


class SystemConfig(BaseModel):
    gemini_model: str
    whatsapp_group_name: str
    whatsapp_bridge_url: str
    whatsapp_db_path: Optional[str]
    whatsapp_group_jid: Optional[str]

class ConfigUpdate(BaseModel):
    gemini_api_key: Optional[str] = Field(default=None)
    gemini_model: Optional[str] = Field(default=None)
    whatsapp_group_name: Optional[str] = Field(default=None)
    whatsapp_bridge_url: Optional[str] = Field(default=None)


# Gmail Models
class GmailStatus(BaseModel):
    connected: bool
    email: Optional[str] = None
    needs_auth: bool
    credentials_found: bool


class EmailMessage(BaseModel):
    id: str
    thread_id: str = Field(alias="threadId")
    subject: str = ""
    sender: str = Field(default="", alias="from")
    recipient: str = Field(default="", alias="to")
    date: str = ""
    snippet: str = ""
    body: Optional[str] = None
    labels: List[str] = Field(default_factory=list, alias="labelIds")

    class Config:
        populate_by_name = True


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: bool = False
    cc: Optional[str] = None
    bcc: Optional[str] = None


class CreateDraftRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: bool = False


class EmailListResponse(BaseModel):
    messages: List[EmailMessage]
    next_page_token: Optional[str] = Field(default=None, alias="nextPageToken")

    class Config:
        populate_by_name = True
