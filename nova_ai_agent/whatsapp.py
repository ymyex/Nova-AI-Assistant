from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional, Tuple

import requests

from .config import Settings
from .exceptions import ConfigurationError, WhatsAppError


class WhatsAppClient:
    """Client for interacting with the WhatsApp bridge used by the MCP server."""

    def __init__(self, settings: Settings, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()
        self._send_url = settings.whatsapp_send_url
        self._configured_group_name = settings.whatsapp_group_name
        self._configured_group_jid = settings.whatsapp_group_jid
        self._db_path = settings.whatsapp_db_path
        self._group_cache: dict[str, str] = {}

        if not self._configured_group_jid and not self._db_path:
            raise ConfigurationError(
                "Either WHATSAPP_GROUP_JID must be set or a WhatsApp messages database must be available."
            )

    def resolve_group_jid(self, override_name: Optional[str] = None) -> str:
        if self._configured_group_jid:
            return self._configured_group_jid

        target_name = (override_name or self._configured_group_name or "").strip()
        if not target_name:
            raise ConfigurationError("Cannot resolve WhatsApp group JID without a group name")

        if target_name in self._group_cache:
            return self._group_cache[target_name]

        if not self._db_path:
            raise ConfigurationError("WHATSAPP_DB_PATH is required to resolve group names to JIDs")

        # Resolving JID usually implies checking the Replying session's DB since that's where we send
        # But for now assuming single DB path in config. 
        # TODO: Config might need to specify which DB to use or we use the 'replying' one by default.
        # The bridge handles DBs internally now. This client-side DB check is a bit legacy/redundant if bridge could resolve names.
        # But let's keep it as is, assuming _db_path points to the relevant DB (probably replying).
        
        db_path = Path(self._db_path)
        if not db_path.exists():
            # If the specific file doesn't exist, maybe try to guess based on session naming convention?
            # But let's respect the config for now.
             raise WhatsAppError(f"WhatsApp messages database not found at {db_path}")

        try:
            connection = sqlite3.connect(str(db_path))
            cursor = connection.cursor()
            cursor.execute(
                "SELECT jid FROM chats WHERE LOWER(name) = ? ORDER BY last_message_time DESC LIMIT 1",
                (target_name.lower(),),
            )
            row = cursor.fetchone()
        except sqlite3.Error as exc:
            raise WhatsAppError(f"Failed to query chats table: {exc}") from exc
        finally:
            if 'connection' in locals():
                connection.close()

        if not row or not row[0]:
            raise WhatsAppError(f"Could not find a WhatsApp chat named '{target_name}' in the bridge database")

        jid = row[0]
        self._group_cache[target_name] = jid
        return jid

    def send_message(self, recipient_jid: str, message: str, session: str = "replying") -> Tuple[bool, str]:
        payload = {
            "recipient": recipient_jid,
            "message": message,
            "session": session
        }

        try:
            response = self._session.post(self._send_url, json=payload, timeout=(5, 15))
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WhatsAppError(f"Failed to send message via WhatsApp bridge: {exc}") from exc

        try:
            response_json = response.json()
        except ValueError as exc:
            raise WhatsAppError("WhatsApp bridge returned invalid JSON") from exc

        success = bool(response_json.get("success"))
        detail = response_json.get("message", "")
        return success, detail or ""

    def get_status(self) -> dict:
        """Fetch pairing and connection status from the bridge."""
        try:
            status_url = self._send_url.replace("/api/send", "/api/status")
            response = self._session.get(status_url, timeout=2)
            response.raise_for_status()
            return response.json()
        except Exception:
            # Return empty struct matching expectation if failed
            return {
                "monitoring": {"paired": False, "connected": False, "connecting": False},
                "replying": {"paired": False, "connected": False, "connecting": False}
            }

    def get_qr(self, session: str) -> Optional[str]:
        """Fetch current QR code from the bridge for a specific session."""
        try:
            qr_url = self._send_url.replace("/api/send", "/api/qr")
            response = self._session.get(qr_url, params={"session": session}, timeout=2)
            response.raise_for_status()
            return response.json().get("qr")
        except Exception:
            return None

    def reconnect(self, session: str) -> bool:
        """Trigger a reconnection attempt on the bridge for a specific session."""
        try:
            reconnect_url = self._send_url.replace("/api/send", "/api/connect")
            response = self._session.get(reconnect_url, params={"session": session}, timeout=5)
            response.raise_for_status()
            return response.json().get("success", False)
        except Exception:
            return False

    def unpair(self, session: str) -> bool:
        """Trigger a logout/unpair on the bridge for a specific session."""
        try:
            logout_url = self._send_url.replace("/api/send", "/api/logout")
            response = self._session.get(logout_url, params={"session": session}, timeout=5)
            response.raise_for_status()
            return response.json().get("success", False)
        except Exception:
            return False

    def send_suggestion(self, suggestion: str, override_group_name: Optional[str] = None) -> Tuple[str, bool, str]:
        group_jid = self.resolve_group_jid(override_group_name)
        # Always send suggestions via replying session
        success, detail = self.send_message(group_jid, suggestion, session="replying")
        return group_jid, success, detail
