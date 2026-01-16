"""
SQLite database manager for Nova AI chat history persistence.

This module provides a simple interface for storing and retrieving chat conversations
and messages using SQLite with file-based storage in the project root.
"""

import sqlite3
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from contextlib import contextmanager


# Database file location - project root
DB_PATH = Path(__file__).parents[1] / "nova_chats.db"


@contextmanager
def get_connection():
    """Context manager for database connections with proper cleanup."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema. Safe to call multiple times."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                tool_calls TEXT,
                thinking TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        
        # Indexes for performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation 
            ON messages(conversation_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_updated 
            ON conversations(updated_at DESC)
        """)
        
        # Schema Migration: Add trace_log column if not exists
        cursor.execute("PRAGMA table_info(messages)")
        columns = [info[1] for info in cursor.fetchall()]
        if "trace_log" not in columns:
            print("[Database] Migrating: Adding trace_log column to messages table")
            cursor.execute("ALTER TABLE messages ADD COLUMN trace_log TEXT")

        # Schema Migration: Add status column for streaming state tracking
        if "status" not in columns:
            print("[Database] Migrating: Adding status column to messages table")
            cursor.execute("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'complete'")

        print(f"[Database] Initialized at {DB_PATH}")


def create_conversation(title: Optional[str] = None) -> Dict[str, Any]:
    """Create a new conversation.
    
    Args:
        title: Optional title, defaults to "New Chat" if not provided
        
    Returns:
        Dict with conversation data including id, title, created_at, updated_at
    """
    conversation_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    title = title or "New Chat"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conversation_id, title, now, now)
        )
    
    return {
        "id": conversation_id,
        "title": title,
        "created_at": now,
        "updated_at": now
    }


def get_conversations(page: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
    """Get all conversations, paginated and sorted by updated_at desc.
    
    Args:
        page: Page number (0-indexed)
        limit: Number of items per page
        
    Returns:
        List of conversation dicts (without messages)
    """
    offset = page * limit
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, title, created_at, updated_at 
            FROM conversations 
            ORDER BY updated_at DESC 
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        )
        rows = cursor.fetchall()
    
    return [dict(row) for row in rows]


def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Get a conversation with all its messages.
    
    Args:
        conversation_id: UUID of the conversation
        
    Returns:
        Conversation dict with messages list, or None if not found
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Get conversation
        cursor.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
            (conversation_id,)
        )
        conv_row = cursor.fetchone()
        
        if not conv_row:
            return None
        
        conversation = dict(conv_row)
        
        # Get messages
        cursor.execute(
            """
            SELECT id, conversation_id, role, content, tool_calls, thinking, trace_log, status, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conversation_id,)
        )
        message_rows = cursor.fetchall()
        
        messages = []
        for row in message_rows:
            msg = dict(row)
            # Parse JSON fields
            if msg.get("tool_calls"):
                try:
                    msg["tool_calls"] = json.loads(msg["tool_calls"])
                except json.JSONDecodeError:
                    msg["tool_calls"] = []
            if msg.get("thinking"):
                try:
                    msg["thinking"] = json.loads(msg["thinking"])
                except json.JSONDecodeError:
                    msg["thinking"] = []
            if msg.get("trace_log"):
                try:
                    msg["trace_log"] = json.loads(msg["trace_log"])
                except json.JSONDecodeError:
                    msg["trace_log"] = []
            messages.append(msg)
        
        conversation["messages"] = messages
        return conversation


def update_conversation(conversation_id: str, title: str) -> bool:
    """Update a conversation's title.
    
    Args:
        conversation_id: UUID of the conversation
        title: New title
        
    Returns:
        True if updated, False if conversation not found
    """
    now = datetime.utcnow().isoformat() + "Z"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conversation_id)
        )
        return cursor.rowcount > 0


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages.
    
    Args:
        conversation_id: UUID of the conversation
        
    Returns:
        True if deleted, False if conversation not found
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        return cursor.rowcount > 0


def delete_all_conversations() -> int:
    """Delete all conversations and messages.
    
    Returns:
        Number of conversations deleted
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversations")
        return cursor.rowcount


def add_message(
    conversation_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    thinking: Optional[List[str]] = None,
    trace_log: Optional[List[Dict[str, Any]]] = None,
    status: str = "complete",
    message_id: Optional[str] = None
) -> Dict[str, Any]:
    """Add a message to a conversation.

    Args:
        conversation_id: UUID of the conversation
        role: 'user' or 'assistant'
        content: Message content text
        tool_calls: Optional list of tool call dicts
        thinking: Optional list of thinking strings
        trace_log: Optional list of raw event objects for high-fidelity history
        status: Message status - 'streaming', 'complete', or 'error'
        message_id: Optional pre-generated message ID (for tracking streaming messages)

    Returns:
        Dict with message data
    """
    if message_id is None:
        message_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    # Serialize JSON fields
    tool_calls_json = json.dumps(tool_calls) if tool_calls else None
    thinking_json = json.dumps(thinking) if thinking else None
    trace_log_json = json.dumps(trace_log) if trace_log else None

    with get_connection() as conn:
        cursor = conn.cursor()

        # Add message
        cursor.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, tool_calls, thinking, trace_log, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (message_id, conversation_id, role, content, tool_calls_json, thinking_json, trace_log_json, status, now)
        )

        # Update conversation's updated_at
        cursor.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id)
        )

    return {
        "id": message_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "tool_calls": tool_calls,
        "thinking": thinking,
        "trace_log": trace_log,
        "status": status,
        "created_at": now
    }


def update_conversation_title_from_message(conversation_id: str, first_message: str) -> None:
    """Auto-generate a conversation title from the first user message.

    Args:
        conversation_id: UUID of the conversation
        first_message: The first user message to generate title from
    """
    # Take first ~50 chars, clean up
    title = first_message.strip()[:50]
    if len(first_message) > 50:
        title += "..."

    # Remove newlines
    title = title.replace("\n", " ").replace("\r", "")

    if title:
        update_conversation(conversation_id, title)


def update_message(
    message_id: str,
    content: Optional[str] = None,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    thinking: Optional[List[str]] = None,
    trace_log: Optional[List[Dict[str, Any]]] = None,
    status: Optional[str] = None
) -> bool:
    """Update an existing message (used for streaming progress updates).

    Args:
        message_id: UUID of the message to update
        content: New content (if provided)
        tool_calls: Updated tool calls list (if provided)
        thinking: Updated thinking list (if provided)
        trace_log: Updated trace log (if provided)
        status: New status (if provided)

    Returns:
        True if updated, False if message not found
    """
    updates = []
    params = []

    if content is not None:
        updates.append("content = ?")
        params.append(content)

    if tool_calls is not None:
        updates.append("tool_calls = ?")
        params.append(json.dumps(tool_calls))

    if thinking is not None:
        updates.append("thinking = ?")
        params.append(json.dumps(thinking))

    if trace_log is not None:
        updates.append("trace_log = ?")
        params.append(json.dumps(trace_log))

    if status is not None:
        updates.append("status = ?")
        params.append(status)

    if not updates:
        return False

    params.append(message_id)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE messages SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        return cursor.rowcount > 0


def get_conversation_message_count(conversation_id: str) -> int:
    """Get the number of messages in a conversation.
    
    Args:
        conversation_id: UUID of the conversation
        
    Returns:
        Number of messages
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = ?",
            (conversation_id,)
        )
        return cursor.fetchone()[0]


# Initialize database on module import
init_db()
