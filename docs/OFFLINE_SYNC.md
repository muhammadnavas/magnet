# Offline Sync

## Feature Overview
A background synchronization queue that processes batched CRUD operations performed while the mobile client was offline.

## Purpose
To support an offline-first experience on mobile devices where network drops are common.

## Key Capabilities
- Accepts arrays of queued operations.
- Processes creates, updates, and deletes sequentially.
- Resolves conflicts by defaulting to server-side last-write-wins (currently).

## Backend Implementation
- **Router**: `backend/app/routers/sync.py`
- **Queue Dispatch**: Newly created offline items are immediately forwarded to the Redis ARQ queue for document processing.

## API Endpoints
- `POST /sync` - Accepts payload format `[{"operation": "create", "payload": {...}}]`. Returns processed count.

## Error Handling
- The sync loop uses a try-catch block for *each* operation. If one offline operation is corrupted or fails, it skips it and proceeds to sync the rest of the queue to ensure robust recovery.

## Current Implementation Status
Backend endpoint is fully implemented. The frontend AsyncStorage persistence layer to batch these offline requests is partially implemented and will be fully wired in future phases.
