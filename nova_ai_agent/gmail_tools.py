"""
Gmail AI Tools - Provides Gmail functionality for the AI agent.

This module enables the AI to read, search, and send emails
as part of its response generation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

from .gmail import GmailClient


class GmailAITools:
    """Gmail tools that the AI can use to interact with email."""
    
    def __init__(self, gmail_client: Optional[GmailClient] = None):
        self._gmail = gmail_client
    
    def set_client(self, gmail_client: GmailClient) -> None:
        """Set or update the Gmail client."""
        self._gmail = gmail_client
    
    @property
    def is_available(self) -> bool:
        """Check if Gmail is connected and available."""
        return self._gmail is not None and self._gmail.is_authenticated
    
    def get_status(self) -> Dict[str, Any]:
        """Get Gmail connection status for the AI."""
        if not self._gmail:
            return {"connected": False, "reason": "Gmail client not initialized"}
        
        return {
            "connected": self._gmail.is_authenticated,
            "email": self._gmail.user_email,
            "reason": None if self._gmail.is_authenticated else "Not authenticated"
        }
    
    def read_inbox(self, count: int = 5) -> str:
        """Read recent emails from inbox. Returns formatted string for AI."""
        if not self.is_available:
            return "❌ Gmail not connected. Please connect Gmail first."
        
        try:
            result = self._gmail.list_messages(query="in:inbox", max_results=count)
            messages = result.get("messages", [])
            
            if not messages:
                return "📭 Inbox is empty."
            
            lines = [f"📬 *Recent Emails ({len(messages)})*\n"]
            for i, msg in enumerate(messages, 1):
                subject = msg.get("subject", "(No subject)")[:50]
                sender = msg.get("from", "Unknown")[:30]
                snippet = msg.get("snippet", "")[:60]
                date = msg.get("date", "")[:20]
                
                lines.append(f"{i}. *{subject}*")
                lines.append(f"   From: {sender}")
                lines.append(f"   {snippet}...")
                lines.append("")
            
            return "\n".join(lines)
        except Exception as e:
            return f"❌ Failed to read inbox: {str(e)}"
    
    def search_emails(self, query: str, count: int = 5) -> str:
        """Search emails with Gmail query syntax. Returns formatted string."""
        if not self.is_available:
            return "❌ Gmail not connected. Please connect Gmail first."
        
        try:
            result = self._gmail.list_messages(query=query, max_results=count)
            messages = result.get("messages", [])
            
            if not messages:
                return f"🔍 No emails found matching: {query}"
            
            lines = [f"🔍 *Search Results for '{query}' ({len(messages)})*\n"]
            for i, msg in enumerate(messages, 1):
                subject = msg.get("subject", "(No subject)")[:50]
                sender = msg.get("from", "Unknown")[:30]
                snippet = msg.get("snippet", "")[:60]
                
                lines.append(f"{i}. *{subject}*")
                lines.append(f"   From: {sender}")
                lines.append(f"   {snippet}...")
                lines.append("")
            
            return "\n".join(lines)
        except Exception as e:
            return f"❌ Failed to search emails: {str(e)}"
    
    def read_email(self, message_id: str) -> str:
        """Read a specific email by ID. Returns formatted string."""
        if not self.is_available:
            return "❌ Gmail not connected. Please connect Gmail first."
        
        try:
            msg = self._gmail.get_message(message_id)
            if not msg:
                return f"❌ Email not found: {message_id}"
            
            subject = msg.get("subject", "(No subject)")
            sender = msg.get("from", "Unknown")
            to = msg.get("to", "Unknown")
            date = msg.get("date", "Unknown")
            body = msg.get("body", msg.get("snippet", "(No content)"))
            
            # Truncate body if too long
            if len(body) > 1000:
                body = body[:1000] + "...\n[Truncated]"
            
            return (
                f"📧 *Email Details*\n\n"
                f"*Subject:* {subject}\n"
                f"*From:* {sender}\n"
                f"*To:* {to}\n"
                f"*Date:* {date}\n\n"
                f"*Content:*\n{body}"
            )
        except Exception as e:
            return f"❌ Failed to read email: {str(e)}"
    
    def get_unread_count(self) -> str:
        """Get count of unread emails."""
        if not self.is_available:
            return "❌ Gmail not connected."
        
        try:
            result = self._gmail.list_messages(query="is:unread", max_results=100)
            count = len(result.get("messages", []))
            return f"📬 You have {count} unread email(s)."
        except Exception as e:
            return f"❌ Failed to get unread count: {str(e)}"
    
    def send_email(self, to: str, subject: str, body: str) -> str:
        """Send an email. Returns status message."""
        if not self.is_available:
            return "❌ Gmail not connected. Please connect Gmail first."
        
        try:
            result = self._gmail.send_email(to=to, subject=subject, body=body)
            if result:
                return f"✅ Email sent successfully to {to}!"
            return "❌ Failed to send email (unknown error)."
        except Exception as e:
            return f"❌ Failed to send email: {str(e)}"
    
    def reply_to_email(self, message_id: str, body: str) -> str:
        """Reply to a specific email."""
        if not self.is_available:
            return "❌ Gmail not connected."
        
        try:
            # Get original message to get sender and subject
            original = self._gmail.get_message(message_id)
            if not original:
                return f"❌ Original email not found: {message_id}"
            
            to = original.get("from", "")
            subject = original.get("subject", "")
            if not subject.lower().startswith("re:"):
                subject = f"Re: {subject}"
            
            result = self._gmail.send_email(to=to, subject=subject, body=body)
            if result:
                return f"✅ Reply sent to {to}!"
            return "❌ Failed to send reply."
        except Exception as e:
            return f"❌ Failed to reply: {str(e)}"
    
    def get_labels(self) -> str:
        """Get all Gmail labels."""
        if not self.is_available:
            return "❌ Gmail not connected."
        
        try:
            labels = self._gmail.list_labels()
            if not labels:
                return "📁 No labels found."
            
            label_names = [l["name"] for l in labels]
            return f"📁 *Gmail Labels:*\n" + "\n".join(f"• {name}" for name in label_names[:20])
        except Exception as e:
            return f"❌ Failed to get labels: {str(e)}"
    
    def process_gmail_command(self, command_text: str) -> str:
        """
        Process a Gmail command from the AI.
        
        Commands:
        - gmail inbox [count] - Read recent inbox emails
        - gmail unread - Get unread count  
        - gmail search <query> - Search emails
        - gmail read <id> - Read specific email
        - gmail send <to> | <subject> | <body> - Send email
        - gmail labels - List labels
        - gmail status - Check connection status
        """
        parts = command_text.strip().split(maxsplit=2)
        
        if len(parts) < 2:
            return self._get_help()
        
        action = parts[1].lower()
        args = parts[2] if len(parts) > 2 else ""
        
        if action == "status":
            status = self.get_status()
            if status["connected"]:
                return f"✅ Gmail connected as {status['email']}"
            return f"❌ Gmail not connected: {status.get('reason', 'Unknown')}"
        
        if action == "inbox":
            count = 5
            if args.isdigit():
                count = min(int(args), 20)
            return self.read_inbox(count)
        
        if action == "unread":
            return self.get_unread_count()
        
        if action == "search":
            if not args:
                return "❌ Please provide a search query. Example: `!nova gmail search from:example@gmail.com`"
            return self.search_emails(args)
        
        if action == "read":
            if not args:
                return "❌ Please provide an email ID to read."
            return self.read_email(args)
        
        if action == "send":
            # Format: to | subject | body
            email_parts = args.split("|")
            if len(email_parts) < 3:
                return "❌ Format: `!nova gmail send to@email.com | Subject | Body text`"
            
            to = email_parts[0].strip()
            subject = email_parts[1].strip()
            body = "|".join(email_parts[2:]).strip()  # Allow | in body
            
            return self.send_email(to, subject, body)
        
        if action == "labels":
            return self.get_labels()
        
        if action == "help":
            return self._get_help()
        
        return f"❌ Unknown Gmail command: {action}. Try `!nova gmail help`."
    
    def _get_help(self) -> str:
        """Return help text for Gmail commands."""
        return (
            "📧 *Gmail Commands*\n\n"
            "• `!nova gmail status` - Check connection\n"
            "• `!nova gmail inbox [count]` - Read recent emails\n"
            "• `!nova gmail unread` - Get unread count\n"
            "• `!nova gmail search <query>` - Search emails\n"
            "• `!nova gmail read <id>` - Read specific email\n"
            "• `!nova gmail send <to> | <subject> | <body>` - Send email\n"
            "• `!nova gmail labels` - List labels\n\n"
            "*Search examples:*\n"
            "• `from:john@example.com`\n"
            "• `subject:meeting`\n"
            "• `is:unread`\n"
            "• `newer_than:1d`"
        )
    
    def get_context_for_ai(self, include_recent: bool = True) -> str:
        """
        Get Gmail context to include in AI prompts.
        This helps the AI understand the user's email state.
        """
        if not self.is_available:
            return ""
        
        try:
            context_parts = []
            
            # Get unread count
            unread_result = self._gmail.list_messages(query="is:unread", max_results=100)
            unread_count = len(unread_result.get("messages", []))
            context_parts.append(f"User has {unread_count} unread emails.")
            
            if include_recent and unread_count > 0:
                # Get recent unread subjects
                messages = unread_result.get("messages", [])[:3]
                if messages:
                    summaries = []
                    for msg in messages:
                        subj = msg.get("subject", "No subject")[:40]
                        sender = msg.get("from", "Unknown")[:25]
                        summaries.append(f"- {subj} (from {sender})")
                    context_parts.append("Recent unread:\n" + "\n".join(summaries))
            
            return "\n".join(context_parts)
        except:
            return ""
