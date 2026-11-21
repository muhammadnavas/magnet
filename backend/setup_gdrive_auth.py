"""Run a local Google Drive OAuth flow using credentials from environment variables.

Set GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET before running this script.
The resulting token.json is local-only and must never be committed.
"""
import json
import os
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
TOKEN_PATH = Path(os.getenv("GDRIVE_TOKEN_PATH", "token.json"))


def main() -> None:
    client_id = os.getenv("GDRIVE_CLIENT_ID")
    client_secret = os.getenv("GDRIVE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise SystemExit(
            "Missing GDRIVE_CLIENT_ID or GDRIVE_CLIENT_SECRET. "
            "Set both in your local backend/.env file."
        )

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    credentials = flow.run_local_server(port=0, prompt="consent")

    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(credentials.to_json(), encoding="utf-8")
    try:
        TOKEN_PATH.chmod(0o600)
    except OSError:
        pass

    print(f"Google Drive authorization saved to {TOKEN_PATH}. Keep this file private.")


if __name__ == "__main__":
    main()
