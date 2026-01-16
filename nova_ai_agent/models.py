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
    sender_jid: Optional[str] = Field(default=None, description="Sender WhatsApp JID (full)")
    sender_id: Optional[str] = Field(default=None, description="Sender user ID (phone or LID)")
    # Keep sender_phone as alias for backward compatibility
    sender_phone: Optional[str] = Field(default=None, description="Deprecated: use sender_id")
    text: str = Field(description="Message body text")
    media_type: Optional[str] = Field(default=None, description="Type of media (image, audio, video, etc)")
    context: List[ContextMessage] = Field(default_factory=list, description="Additional context messages")


class NovaPayload(BaseModel):
    message: IncomingMessage
    force_group_name: Optional[str] = Field(default=None, description="Override target group name")


class NovaResult(BaseModel):
    response: str
    group_jid: str
    delivered: bool
    details: str


class NovaResponse(BaseModel):
    success: bool
    result: Optional[NovaResult] = None
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
    whatsapp_bridge_url: str
    whatsapp_db_path: Optional[str]
    whatsapp_group_jid: Optional[str]

class ConfigUpdate(BaseModel):
    gemini_api_key: Optional[str] = Field(default=None)
    gemini_model: Optional[str] = Field(default=None)
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


# =============================================================================
# Chat History Models (for persistent conversation storage)
# =============================================================================
from typing import Any, Dict, Literal


class ToolCallData(BaseModel):
    """Tool call information stored in message history."""
    name: str = Field(description="Name of the tool that was called")
    args: Dict[str, Any] = Field(default_factory=dict, description="Arguments passed to the tool")
    result: Optional[str] = Field(default=None, description="Result returned by the tool")


class MessageData(BaseModel):
    """A message in a conversation."""
    id: str = Field(description="Unique message ID (UUID)")
    conversation_id: str = Field(description="ID of the parent conversation")
    role: Literal["user", "assistant"] = Field(description="Role of the message sender")
    content: str = Field(description="Message text content")
    tool_calls: Optional[List[ToolCallData]] = Field(default=None, description="Tool calls made during this message")
    thinking: Optional[List[str]] = Field(default=None, description="Thinking/reasoning steps")
    trace_log: Optional[List[Dict[str, Any]]] = Field(default=None, description="High-fidelity event trace for exact history reconstruction")
    status: Optional[Literal["streaming", "complete", "error"]] = Field(default="complete", description="Message status for tracking streaming state")
    created_at: datetime = Field(description="When the message was created")


class ConversationData(BaseModel):
    """A conversation with optional messages."""
    id: str = Field(description="Unique conversation ID (UUID)")
    title: str = Field(description="Conversation title")
    created_at: datetime = Field(description="When the conversation was created")
    updated_at: datetime = Field(description="When the conversation was last updated")
    messages: Optional[List[MessageData]] = Field(default=None, description="Messages in the conversation")


class ConversationListItem(BaseModel):
    """Summary of a conversation for list display."""
    id: str
    title: str
    updated_at: datetime


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    title: Optional[str] = Field(default=None, description="Optional title, auto-generated if not provided")


class UpdateConversationRequest(BaseModel):
    """Request to update a conversation."""
    title: str = Field(description="New title for the conversation")


class ChatMessageRequest(BaseModel):
    """Request to send a message to a conversation."""
    message: str = Field(description="The user's message to send")
    model_override: Optional[str] = Field(default=None, description="Optional model to use for this request, overrides the default")


class GenerateTitleRequest(BaseModel):
    """Request to generate a title for a conversation."""
    message: str = Field(description="The user's first message to generate a title from")


# =============================================================================
# Agent Chat Models (for Dashboard Chat UI with SSE streaming)
# =============================================================================


class AgentChatRequest(BaseModel):
    """Request model for agent chat endpoint."""
    message: str = Field(description="The user's message to the agent")
    conversation_id: Optional[str] = Field(default=None, description="Optional conversation ID for context")


class AgentEvent(BaseModel):
    """Event model for SSE streaming during agent processing."""
    type: Literal["thinking", "tool_call_start", "tool_call_result", "text", "error", "done"] = Field(
        description="Type of event being streamed"
    )
    content: Optional[str] = Field(default=None, description="Text content (for thinking/text/error events)")
    name: Optional[str] = Field(default=None, description="Tool name (for tool_call events)")
    args: Optional[Dict[str, Any]] = Field(default=None, description="Tool arguments (for tool_call_start)")
    result: Optional[str] = Field(default=None, description="Tool result (for tool_call_result)")
