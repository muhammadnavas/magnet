# Projects

## Feature Overview
Allows users to group and organize their Knowledge Items into specific logical containers called Projects.

## Purpose
To help developers separate their 'Second Brain' knowledge by client, repository, or product line, keeping the interface clean and organized.

## Key Capabilities
- Create new projects automatically when tagging an item with a new project name.
- Filter Knowledge Library by project.

## Frontend Implementation
- **Component**: `components/projects/ProjectSelector.jsx`
- **State**: The active project filter is passed down from `app/(tabs)/knowledge.jsx` into the query hooks.

## Backend Implementation
- **Router**: `backend/app/routers/projects.py`
- Projects are typically created lazily during knowledge item ingestion (`POST /knowledge/upload`).

## API Endpoints
- `GET /projects` - List all projects belonging to the user.
- `GET /projects/{id}` - Get project details.
- `DELETE /projects/{id}` - Delete a project.

## Database Models/Tables
**Table**: `projects`
- `id` (UUID)
- `user_id` (UUID, ForeignKey)
- `name` (String)
- `status` (String)

**Table**: `knowledge_projects` (Association Table)
- `knowledge_id` (UUID, ForeignKey)
- `project_id` (UUID, ForeignKey)

## Current Implementation Status
Fully implemented.
