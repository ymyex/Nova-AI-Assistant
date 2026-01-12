import sys
import os
from pathlib import Path

# Add current directory to path so we can import nova_ai_agent
sys.path.append(os.getcwd())

try:
    from nova_ai_agent.config import get_settings
    settings = get_settings()
    
    print(f"CWD: {os.getcwd()}")
    print(f"Credentials Path from Config: {settings.gmail_credentials_path}")
    print(f"Exists? {Path(settings.gmail_credentials_path).exists()}")
    
    # Check manual resolution
    project_root = Path(".").resolve()
    print(f"Project Root (calculated): {project_root}")
    expected_path = project_root / "gmail_credentials.json"
    print(f"Expected Exists? {expected_path.exists()}")

    print("\nAttempting to initialize GmailClient...")
    from nova_ai_agent.gmail import GmailClient
    client = GmailClient(credentials_path=str(settings.gmail_credentials_path))
    print(f"GmailClient initialized. Needs auth? {client.needs_auth}")

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
