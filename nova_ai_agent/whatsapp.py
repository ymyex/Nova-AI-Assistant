from __future__ import annotations

from typing import Optional, Tuple

import requests

from .config import Settings
from .exceptions import WhatsAppError


class WhatsAppClient:
    """Client for interacting with the WhatsApp bridge used by the MCP server."""

    def __init__(self, settings: Settings, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()
        self._send_url = settings.whatsapp_send_url
        self._configured_group_jid = settings.whatsapp_group_jid
        self._db_path = settings.whatsapp_db_path

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
