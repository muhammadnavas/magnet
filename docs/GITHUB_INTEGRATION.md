# GitHub Integration

## Feature
Connect a GitHub account from Magnet Settings and browse accessible repositories before importing code into the Knowledge Vault.

## Current flow
1. Settings → GitHub Sync → Connect.
2. Magnet requests a short-lived OAuth state from the backend.
3. The user authorizes Magnet on GitHub.
4. GitHub redirects to the HTTPS backend callback.
5. The backend exchanges the authorization code, encrypts the GitHub access token, and stores the connection.
6. The backend redirects back to the Android `magnet://github/callback` scheme.
7. Settings refreshes the connection and can list repositories.

## Backend endpoints
- `GET /api/v1/github/authorize` — create the GitHub authorization URL.
- `GET /api/v1/github/callback` — GitHub OAuth callback.
- `POST /api/v1/github/connect` — direct code exchange endpoint for authenticated clients.
- `GET /api/v1/github/status` — connection status.
- `GET /api/v1/github/repos` — accessible repositories.
- `POST /api/v1/github/disconnect` — remove the stored connection.
- `POST /api/v1/github/import` — reserved for the next phase: selective repository/file import through ARQ.

## GitHub OAuth App setup
Create a GitHub OAuth App and configure its **Authorization callback URL** to the exact value of `GITHUB_REDIRECT_URI`.

Set these backend environment variables in Render/local development:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://<your-render-service>.onrender.com/api/v1/github/callback
GITHUB_APP_REDIRECT_URI=magnet://github/callback
```

The client secret must remain backend-only.

## Permissions
The current prototype requests `read:user repo` so Magnet can list public/private repositories and later import selected source files. Before production, migrate to a GitHub App with fine-grained repository permissions and least-privilege access.

## Import phase
Repository browsing is implemented first. The next phase should add:

```text
Repository
  → file/folder picker
  → selected files
  → ARQ import job
  → text extraction
  → chunks
  → Gemini embeddings
  → pgvector
  → Knowledge Vault
```
