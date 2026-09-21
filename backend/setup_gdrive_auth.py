import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    """Shows basic usage of the Drive v3 API.
    Prints the names and ids of the first 10 files the user has access to.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Use one of the URIs already registered in the user's Google Cloud Console
            redirect_uri = 'http://localhost:8000/api/auth/callback/google'
            
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_secrets_file(
                'client_secret.json',
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            
            auth_url, _ = flow.authorization_url(prompt='consent')
            
            print("=========================================================")
            print("Please visit this URL to authorize the application:")
            print(f"\n{auth_url}\n")
            print("=========================================================")
            print(f"After you authorize, your browser will redirect you to {redirect_uri}.")
            print("Copy the ENTIRE URL from your browser's address bar (it should contain '?code=...') and paste it below.")
            
            auth_response = input("\nPaste the full redirect URL here: ").strip()
            
            flow.fetch_token(authorization_response=auth_response)
            creds = flow.credentials
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    print("Success! token.json has been generated.")
    print("Magnet backend can now upload files to Google Drive.")

if __name__ == '__main__':
    main()
