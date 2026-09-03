# GitHub Integration

## Feature Overview
Allows users to connect their GitHub account via OAuth and import source code directly into their Orio Knowledge Vault for context-aware querying.

## Purpose
To allow the AI to answer questions about the user's specific private or public codebases accurately.

## API Endpoints
- `POST /github/connect` - OAuth callback receiver.
- `GET /github/repos` - List accessible repositories.
- `POST /github/import` - Trigger ARQ background job to clone/download source code and generate embeddings.

## Current Implementation Status
**Partially Implemented (Stubs only).**
- The router (`backend/app/routers/github.py`) exists and has endpoints defined.
- However, all endpoints currently raise `HTTP_501_NOT_IMPLEMENTED` with the message: *"GitHub source code importing pipelines will be fully implemented in Phase 5."*
- There is no frontend UI wired for this yet.
