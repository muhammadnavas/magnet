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
    
    token_env = os.environ.get("GDRIVE_TOKEN_JSON")
    if token_env:
        import json
        try:
            token_data = json.loads(token_env)
            creds = Credentials.from_authorized_user_info(token_data, SCOPES)
        except Exception as e:
            logger.error(f"Failed to load credentials from GDRIVE_TOKEN_JSON env var: {e}")
            
    # Fallback to local file (for development)
    if not creds and os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            logger.error(f"Failed to load token.json file: {e}")
            
    # If there are no (valid) credentials available, log an error
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                
                # Update local file if it exists or if we aren't using env vars
                if os.path.exists(token_path) or not token_env:
                    with open(token_path, 'w') as token:
                        token.write(creds.to_json())
                else:
                    logger.info("Token refreshed in memory. Update your GDRIVE_TOKEN_JSON env var to persist.")
            except Exception as e:
                logger.error(f"Failed to refresh token: {e}")
                return None
        else:
            logger.warning("Google Drive credentials not found or invalid. Set GDRIVE_TOKEN_JSON env var or run 'python setup_gdrive_auth.py'.")
            return None

    try:
        service = build('drive', 'v3', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"Failed to initialize Google Drive service: {e}")
        return None

def get_or_create_orio_folder(service) -> Optional[str]:
    """Finds or creates a folder named 'Orio' in the root of Google Drive."""
    try:
        # Search for a folder named 'Orio'
        query = "name='Orio' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        items = results.get('files', [])
        
        if items:
            return items[0]['id']
            
        # If not found, create it
        folder_metadata = {
            'name': 'Orio',
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        logger.info(f"Created Orio folder in Google Drive with ID: {folder.get('id')}")
        return folder.get('id')
    except Exception as e:
        logger.error(f"Failed to get or create Orio folder: {e}")
        return None

def upload_file_to_gdrive(file_path: str, filename: str, mime_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Uploads a local file to Google Drive and returns the file metadata.
    """
    service = get_gdrive_service()
    if not service:
        return {"error": "Google Drive service not configured."}

    folder_id = settings.GDRIVE_UPLOAD_FOLDER_ID
    if not folder_id:
        folder_id = get_or_create_orio_folder(service)

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

def download_file_from_gdrive(file_id: str, dest_path: str) -> bool:
    """
    Downloads a file from Google Drive by its ID and saves it to dest_path.
    """
    import io
    from googleapiclient.http import MediaIoBaseDownload
    
    service = get_gdrive_service()
    if not service:
        logger.error("Google Drive service not configured for download.")
        return False
        
    try:
        request = service.files().get_media(fileId=file_id)
        with io.FileIO(dest_path, 'wb') as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
        return True
    except Exception as e:
        logger.error(f"Error downloading file {file_id} from Google Drive: {e}")
        return False
