import os
import logging
from typing import Dict, Any, Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from app.config import settings

logger = logging.getLogger(__name__)

# Scopes required by the API
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_gdrive_service():
    """Authenticate and return the Google Drive API service using OAuth."""
    creds = None
    token_path = 'token.json'
    
    # The file token.json stores the user's access and refresh tokens
    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            logger.error(f"Failed to load token.json: {e}")
            
    # If there are no (valid) credentials available, log an error
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                logger.error(f"Failed to refresh token: {e}")
                return None
        else:
            logger.warning("Google Drive token.json not found or invalid. Please run 'python setup_gdrive_auth.py' in the terminal.")
            return None

    try:
        service = build('drive', 'v3', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"Failed to initialize Google Drive service: {e}")
        return None

def upload_file_to_gdrive(file_path: str, filename: str, mime_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Uploads a local file to Google Drive and returns the file metadata.
    """
    service = get_gdrive_service()
    if not service:
        return {"error": "Google Drive service not configured."}

    folder_id = settings.GDRIVE_UPLOAD_FOLDER_ID

    file_metadata = {
        'name': filename
    }
    
    if folder_id:
        file_metadata['parents'] = [folder_id]

    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

    try:
        # Create the file on Drive
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        logger.info(f"File ID: {file.get('id')} uploaded successfully to Google Drive.")
        return file
    except Exception as e:
        logger.error(f"Error uploading file to Google Drive: {e}")
        return {"error": str(e)}
