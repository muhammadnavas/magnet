# Insights

## Feature Overview
Provides high-level statistics and relationship mapping for the user's knowledge vault.

## Purpose
To give users a dashboard-like overview of how many items they have stored, their most active topics (tags), and the spread of their projects.

## Key Capabilities
- Total item count aggregation.
- Top tag identification.
- Project count tracking.

## Frontend Implementation
- **Screen**: `app/(tabs)/index.jsx` (Home screen dashboard).
- Currently displays static or semi-static insight cards.

## Backend Implementation
- **Router**: `backend/app/routers/insights.py`
- Performs heavy aggregation queries via SQLAlchemy (`func.count`, `group_by`).

## API Endpoints
- `GET /insights` - Returns a JSON array of insight objects containing a type and a message string.

## Database Models/Tables
- Aggregates across `knowledge_items`, `tags`, and `projects`.

## Edge Cases
- If the database is completely empty, it gracefully falls back to a welcome message ("Orio database is spinning up...").

## Current Implementation Status
Fully implemented for basic metadata. Knowledge Graph visualization (e.g. node-edge diagrams) is not yet implemented in the UI.
