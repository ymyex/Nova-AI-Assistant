"""
Gmail Client for Nova AI Assistant

Provides full Gmail API access including reading, writing, and managing emails.
Uses OAuth2 for secure authentication.
"""

import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow, Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Full Gmail access scope
SCOPES = ['https://mail.google.com/']


class GmailClient:
    """Gmail API client with full access capabilities."""
    
    def __init__(
        self, 
        credentials_path: str = "gmail_credentials.json",
        token_path: str = "gmail_token.json"
    ):
        """
        Initialize Gmail client.
        
        Args:
            credentials_path: Path to OAuth2 credentials JSON from Google Cloud Console
            token_path: Path to store/load the OAuth2 token
        """
        self.credentials_path = Path(credentials_path)
        self.token_path = Path(token_path)
        self.creds: Optional[Credentials] = None
        self.service = None
        self._user_email: Optional[str] = None
        
        # Try to load existing token
        self._load_token()
    
    def _load_token(self) -> bool:
        """Load existing token if available and valid."""
        if self.token_path.exists():
            try:
                self.creds = Credentials.from_authorized_user_file(
                    str(self.token_path), SCOPES
                )
                if self.creds and self.creds.valid:
                    print(f"Gmail token loaded successfully (valid until {self.creds.expiry})")
                    self._build_service()
                    return True
                elif self.creds and self.creds.expired and self.creds.refresh_token:
                    print(f"Gmail token expired (was valid until {self.creds.expiry}), attempting refresh...")
                    # Attempt refresh with retry logic
                    refresh_success = self._try_refresh_token()
                    if refresh_success:
                        self._save_token()
                        self._build_service()
                        print(f"Gmail token refreshed successfully (now valid until {self.creds.expiry})")
                        return True
                    else:
                        print("Gmail token refresh failed after retries. Re-authentication required.")
                        return False
                elif self.creds and not self.creds.refresh_token:
                    print("Gmail token has no refresh_token - re-authentication required.")
                    return False
            except Exception as e:
                print(f"Failed to load Gmail token: {type(e).__name__}: {e}")
        return False
    
    def _try_refresh_token(self, max_retries: int = 2) -> bool:
        """
        Attempt to refresh the access token with retry logic.
        
        Args:
            max_retries: Number of retry attempts for transient failures
            
        Returns:
            True if refresh succeeded
        """
        import time as time_module
        
        for attempt in range(max_retries + 1):
            try:
                self.creds.refresh(Request())
                return True
            except Exception as e:
                error_msg = str(e).lower()
                
                # Check for permanent failures that shouldn't be retried
                if 'invalid_grant' in error_msg or 'token has been expired or revoked' in error_msg:
                    print(f"Gmail refresh token is invalid or revoked: {e}")
                    print("NOTE: If using Google Cloud 'Testing' mode, tokens expire after 7 days.")
                    print("      Consider publishing your app or reconnecting Gmail.")
                    return False
                
                # Retry for transient network errors
                if attempt < max_retries:
                    wait_time = (attempt + 1) * 2  # 2s, 4s
                    print(f"Gmail token refresh attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                    time_module.sleep(wait_time)
                else:
                    print(f"Gmail token refresh failed after {max_retries + 1} attempts: {e}")
        
        return False
    
    def _save_token(self) -> None:
        """Save the current credentials to token file."""
        if self.creds:
            with open(self.token_path, 'w') as token:
                token.write(self.creds.to_json())
    
    def _build_service(self) -> None:
        """Build the Gmail API service."""
        if self.creds:
            self.service = build('gmail', 'v1', credentials=self.creds)
            # Get user email
            try:
                profile = self.service.users().getProfile(userId='me').execute()
                self._user_email = profile.get('emailAddress')
            except Exception:
                pass
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self.creds is not None and self.creds.valid
    
    @property
    def user_email(self) -> Optional[str]:
        """Get the authenticated user's email address."""
        return self._user_email
    
    @property
    def needs_auth(self) -> bool:
        """Check if authentication is needed."""
        return not self.credentials_path.exists() or not self.is_authenticated
    
    def get_auth_url(self, redirect_uri: str = "http://localhost/api/gmail/callback") -> Optional[str]:
        """
        Get the OAuth2 authorization URL for web-based auth flow.
        
        Args:
            redirect_uri: The redirect URI for the OAuth callback
            
        Returns:
            Authorization URL or None if credentials file not found
        """
        if not self.credentials_path.exists():
            return None
        
        try:
            flow = Flow.from_client_secrets_file(
                str(self.credentials_path),
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true'
                # Note: Removed prompt='consent' to avoid forcing re-consent
                # This allows existing refresh tokens to remain valid
            )
            return auth_url
        except Exception as e:
            print(f"Failed to generate auth URL: {e}")
            return None
    
    def authenticate_with_code(
        self, 
        code: str, 
        redirect_uri: str = "http://localhost/api/gmail/callback"
    ) -> bool:
        """
        Complete authentication using authorization code from OAuth callback.
        
        Args:
            code: Authorization code from Google OAuth callback
            redirect_uri: The redirect URI used in the initial auth request
            
        Returns:
            True if authentication successful
        """
        if not self.credentials_path.exists():
            return False
        
        try:
            flow = Flow.from_client_secrets_file(
                str(self.credentials_path),
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            flow.fetch_token(code=code)
            self.creds = flow.credentials
            self._save_token()
            self._build_service()
            return True
        except Exception as e:
            print(f"Failed to authenticate with code: {e}")
            return False
    
    def authenticate_local(self) -> bool:
        """
        Run local OAuth2 flow (opens browser).
        Best for desktop/CLI applications.
        
        Returns:
            True if authentication successful
        """
        if not self.credentials_path.exists():
            print(f"Credentials file not found: {self.credentials_path}")
            return False
        
        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(self.credentials_path), SCOPES
            )
            self.creds = flow.run_local_server(port=0)
            self._save_token()
            self._build_service()
            return True
        except Exception as e:
            print(f"Gmail authentication failed: {e}")
            return False
    
    def logout(self) -> bool:
        """
        Logout and remove stored credentials.
        
        Returns:
            True if successfully logged out
        """
        try:
            if self.token_path.exists():
                os.remove(self.token_path)
            self.creds = None
            self.service = None
            self._user_email = None
            return True
        except Exception as e:
            print(f"Failed to logout: {e}")
            return False
    
    def list_messages(
        self, 
        query: str = "", 
        max_results: int = 10,
        page_token: Optional[str] = None,
        label_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        List messages matching the query.
        
        Args:
            query: Gmail search query (same syntax as Gmail search box)
            max_results: Maximum number of messages to return
            page_token: Token for pagination
            label_ids: Filter by label IDs (e.g., ['INBOX', 'UNREAD'])
            
        Returns:
            Dict with 'messages' list and optional 'nextPageToken'
        """
        if not self.service:
            return {"messages": [], "error": "Not authenticated"}
        
        try:
            kwargs = {
                "userId": "me",
                "maxResults": max_results,
                "q": query
            }
            if page_token:
                kwargs["pageToken"] = page_token
            if label_ids:
                kwargs["labelIds"] = label_ids
            
            results = self.service.users().messages().list(**kwargs).execute()
            
            messages = []
            for msg in results.get('messages', []):
                full_msg = self.get_message(msg['id'], format='metadata')
                if full_msg:
                    messages.append(full_msg)
            
            return {
                "messages": messages,
                "nextPageToken": results.get('nextPageToken')
            }
        except HttpError as e:
            print(f"Failed to list messages: {e}")
            return {"messages": [], "error": str(e)}
    
    def get_message(
        self, 
        message_id: str, 
        format: str = "full"
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific message by ID.
        
        Args:
            message_id: The message ID
            format: 'full', 'metadata', 'minimal', or 'raw'
            
        Returns:
            Message dict with parsed fields
        """
        if not self.service:
            return None
        
        try:
            msg = self.service.users().messages().get(
                userId="me", 
                id=message_id, 
                format=format
            ).execute()
            
            # Parse headers
            headers = {}
            for header in msg.get('payload', {}).get('headers', []):
                name = header.get('name', '').lower()
                if name in ['from', 'to', 'subject', 'date']:
                    headers[name] = header.get('value', '')
            
            # Get body
            body = ""
            if format == "full":
                body = self._get_message_body(msg.get('payload', {}))
            
            return {
                "id": msg.get('id'),
                "threadId": msg.get('threadId'),
                "labelIds": msg.get('labelIds', []),
                "snippet": msg.get('snippet', ''),
                "subject": headers.get('subject', ''),
                "from": headers.get('from', ''),
                "to": headers.get('to', ''),
                "date": headers.get('date', ''),
                "body": body
            }
        except HttpError as e:
            print(f"Failed to get message {message_id}: {e}")
            return None
    
    def _get_message_body(self, payload: Dict) -> str:
        """Extract message body from payload."""
        body = ""
        
        if 'body' in payload and payload['body'].get('data'):
            body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        elif 'parts' in payload:
            for part in payload['parts']:
                if part.get('mimeType') == 'text/plain':
                    if part.get('body', {}).get('data'):
                        body = base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
                        break
                elif part.get('mimeType') == 'text/html' and not body:
                    if part.get('body', {}).get('data'):
                        body = base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
                elif 'parts' in part:
                    body = self._get_message_body(part)
                    if body:
                        break
        
        return body
    
    def send_email(
        self, 
        to: str, 
        subject: str, 
        body: str,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Send a plain text email.
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Plain text email body
            cc: CC recipients (comma-separated)
            bcc: BCC recipients (comma-separated)
            
        Returns:
            Sent message info or None on failure
        """
        if not self.service:
            return None
        
        try:
            message = MIMEText(body)
            message['to'] = to
            message['subject'] = subject
            if self._user_email:
                message['from'] = self._user_email
            if cc:
                message['cc'] = cc
            if bcc:
                message['bcc'] = bcc
            
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            result = self.service.users().messages().send(
                userId="me",
                body={'raw': raw}
            ).execute()
            
            return {
                "id": result.get('id'),
                "threadId": result.get('threadId'),
                "labelIds": result.get('labelIds', [])
            }
        except HttpError as e:
            print(f"Failed to send email: {e}")
            return None
    
    def send_html_email(
        self, 
        to: str, 
        subject: str, 
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Send an HTML email with optional plain text fallback.
        
        Args:
            to: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Optional plain text fallback
            cc: CC recipients
            bcc: BCC recipients
            
        Returns:
            Sent message info or None on failure
        """
        if not self.service:
            return None
        
        try:
            message = MIMEMultipart('alternative')
            message['to'] = to
            message['subject'] = subject
            if self._user_email:
                message['from'] = self._user_email
            if cc:
                message['cc'] = cc
            if bcc:
                message['bcc'] = bcc
            
            if text_body:
                message.attach(MIMEText(text_body, 'plain'))
            message.attach(MIMEText(html_body, 'html'))
            
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            result = self.service.users().messages().send(
                userId="me",
                body={'raw': raw}
            ).execute()
            
            return {
                "id": result.get('id'),
                "threadId": result.get('threadId'),
                "labelIds": result.get('labelIds', [])
            }
        except HttpError as e:
            print(f"Failed to send HTML email: {e}")
            return None
    
    def create_draft(
        self, 
        to: str, 
        subject: str, 
        body: str,
        html: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Create an email draft.
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body (plain text or HTML based on html flag)
            html: If True, body is treated as HTML
            
        Returns:
            Draft info or None on failure
        """
        if not self.service:
            return None
        
        try:
            if html:
                message = MIMEText(body, 'html')
            else:
                message = MIMEText(body)
            
            message['to'] = to
            message['subject'] = subject
            if self._user_email:
                message['from'] = self._user_email
            
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            result = self.service.users().drafts().create(
                userId="me",
                body={'message': {'raw': raw}}
            ).execute()
            
            return {
                "id": result.get('id'),
                "messageId": result.get('message', {}).get('id')
            }
        except HttpError as e:
            print(f"Failed to create draft: {e}")
            return None
    
    def list_labels(self) -> List[Dict[str, str]]:
        """
        List all Gmail labels.
        
        Returns:
            List of label dicts with 'id' and 'name'
        """
        if not self.service:
            return []
        
        try:
            results = self.service.users().labels().list(userId="me").execute()
            return [
                {"id": label['id'], "name": label['name']}
                for label in results.get('labels', [])
            ]
        except HttpError as e:
            print(f"Failed to list labels: {e}")
            return []
    
    def modify_message(
        self, 
        message_id: str, 
        add_labels: Optional[List[str]] = None,
        remove_labels: Optional[List[str]] = None
    ) -> bool:
        """
        Modify labels on a message.
        
        Args:
            message_id: The message ID
            add_labels: Label IDs to add
            remove_labels: Label IDs to remove
            
        Returns:
            True if successful
        """
        if not self.service:
            return False
        
        try:
            body = {}
            if add_labels:
                body['addLabelIds'] = add_labels
            if remove_labels:
                body['removeLabelIds'] = remove_labels
            
            self.service.users().messages().modify(
                userId="me",
                id=message_id,
                body=body
            ).execute()
            return True
        except HttpError as e:
            print(f"Failed to modify message {message_id}: {e}")
            return False
    
    def mark_as_read(self, message_id: str) -> bool:
        """Mark a message as read."""
        return self.modify_message(message_id, remove_labels=['UNREAD'])
    
    def mark_as_unread(self, message_id: str) -> bool:
        """Mark a message as unread."""
        return self.modify_message(message_id, add_labels=['UNREAD'])
    
    def trash_message(self, message_id: str) -> bool:
        """
        Move a message to trash.
        
        Args:
            message_id: The message ID
            
        Returns:
            True if successful
        """
        if not self.service:
            return False
        
        try:
            self.service.users().messages().trash(
                userId="me",
                id=message_id
            ).execute()
            return True
        except HttpError as e:
            print(f"Failed to trash message {message_id}: {e}")
            return False
    
    def delete_message(self, message_id: str) -> bool:
        """
        Permanently delete a message.
        
        Warning: This cannot be undone!
        
        Args:
            message_id: The message ID
            
        Returns:
            True if successful
        """
        if not self.service:
            return False
        
        try:
            self.service.users().messages().delete(
                userId="me",
                id=message_id
            ).execute()
            return True
        except HttpError as e:
            print(f"Failed to delete message {message_id}: {e}")
            return False
    
    def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """
        Get all messages in a thread.
        
        Args:
            thread_id: The thread ID
            
        Returns:
            Thread dict with messages
        """
        if not self.service:
            return None
        
        try:
            thread = self.service.users().threads().get(
                userId="me",
                id=thread_id
            ).execute()
            
            messages = []
            for msg in thread.get('messages', []):
                parsed = self.get_message(msg['id'])
                if parsed:
                    messages.append(parsed)
            
            return {
                "id": thread.get('id'),
                "messages": messages
            }
        except HttpError as e:
            print(f"Failed to get thread {thread_id}: {e}")
            return None
