from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
from typing import Optional

_DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"
_DEFAULT_WHATSAPP_BRIDGE_URL = "http://localhost:8080/api"


def _default_whatsapp_db_path() -> Optional[str]:
    """Return a best effort default path to the WhatsApp message store."""
    # Use path relative to project root (parent of nova_ai_agent)
    project_root = Path(__file__).parent.parent
    candidate = project_root / "whatsapp-mcp" / "whatsapp-bridge" / "store" / "messages.db"
    return str(candidate)


@dataclass
class Settings:
    gemini_api_key: Optional[str]
    gemini_model: str
    whatsapp_bridge_base_url: str
    whatsapp_group_jid: Optional[str]
    whatsapp_db_path: Optional[str]
    # Gmail OAuth2 configuration
    gmail_credentials_path: str
    gmail_token_path: str
    # OpenCode configuration
    opencode_base_url: str
    opencode_path: str
    opencode_auto_start: bool
    # Research Mode - Google Search and URL Context (disables function calling when enabled)
    google_search_enabled: bool
    url_context_enabled: bool

    @property
    def whatsapp_send_url(self) -> str:
        base = self.whatsapp_bridge_base_url.rstrip("/")
        return f"{base}/send"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    gemini_model = os.getenv("GEMINI_MODEL", _DEFAULT_GEMINI_MODEL)
    bridge_url = os.getenv("WHATSAPP_BRIDGE_URL", _DEFAULT_WHATSAPP_BRIDGE_URL)

    # Gmail defaults - use absolute paths based on project root (parent of nova_ai_agent)
    # This ensures the token is always found regardless of current working directory
    project_root = Path(__file__).parent.parent
    default_gmail_creds = str(project_root / "gmail_credentials.json")
    default_gmail_token = str(project_root / "gmail_token.json")
    default_opencode_path = str(project_root / "opencode")

    settings = Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=gemini_model,
        whatsapp_bridge_base_url=bridge_url,
        whatsapp_group_jid=os.getenv("WHATSAPP_GROUP_JID"),
        whatsapp_db_path=os.getenv("WHATSAPP_DB_PATH", _default_whatsapp_db_path()),
        gmail_credentials_path=os.getenv("GMAIL_CREDENTIALS_PATH", default_gmail_creds),
        gmail_token_path=os.getenv("GMAIL_TOKEN_PATH", default_gmail_token),
        opencode_base_url=os.getenv("OPENCODE_BASE_URL", "http://localhost:4096"),
        opencode_path=os.getenv("OPENCODE_PATH", default_opencode_path),
        opencode_auto_start=os.getenv("OPENCODE_AUTO_START", "true").lower() == "true",
        # Research Mode settings - default to disabled
        google_search_enabled=os.getenv("GOOGLE_SEARCH_ENABLED", "false").lower() == "true",
        url_context_enabled=os.getenv("URL_CONTEXT_ENABLED", "false").lower() == "true",
    )

    return settings

