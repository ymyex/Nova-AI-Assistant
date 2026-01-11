class ConfigurationError(RuntimeError):
    """Raised when required configuration is missing or invalid."""


class GeminiError(RuntimeError):
    """Raised when Gemini API interactions fail."""


class WhatsAppError(RuntimeError):
    """Raised when WhatsApp MCP interactions fail."""
