# Local secrets and credentials

Never commit credentials, OAuth tokens, service-account keys, or environment files.

## Backend

From the `backend` directory, copy `.env.example` to `.env` and replace all `CHANGE_ME` values. Generate a new application signing key with:

```bash
openssl rand -hex 32
```

Use a strong unique PostgreSQL password and make sure it matches the password in `DATABASE_URL`. Keep `.env` out of Git.

For Google Drive OAuth, set `GDRIVE_CLIENT_ID` and `GDRIVE_CLIENT_SECRET` for a Desktop OAuth client, then run:

```bash
python setup_gdrive_auth.py
```

The script creates a local `backend/token.json`; this file is ignored by Git. For container deployments, provide the token through the `GDRIVE_TOKEN_JSON` environment variable or a secret manager.

## Firebase Android configuration

Download a fresh `google-services.json` from the Firebase Console for the Android app and keep it local. It is ignored by Git. Expo loads it automatically when present at the project root, or from the path in `GOOGLE_SERVICES_JSON`. If it is not supplied, the Firebase Android configuration is omitted from the native build.

## Rotation is mandatory

Any credential that was ever committed must be considered compromised, even after the file is deleted. Revoke and recreate the exposed Google OAuth client secret, Google Drive refresh/access tokens, Google service-account key, Firebase API key (or restrict and replace it), and any database/JWT credentials that were used. Update deployment secrets with the new values.

Deleting a secret in a new commit does not remove it from previous Git commits. After rotating credentials, purge the exposed files from Git history and coordinate a force-push with all collaborators.
