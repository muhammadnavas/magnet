# Semantic Search

## Feature Overview
Allows users to perform natural language semantic searches across their Knowledge Vault.

## Purpose
To find relevant notes, code snippets, or documents not just by exact keyword match, but by conceptual similarity using pgvector embeddings.

## Key Capabilities
- Semantic vector distance search (Cosine similarity).
- Keyword fallback.
- Contextual search highlighting (in future iterations).

## Frontend Implementation
- **Hooks**: `hooks/useSearch.js` uses React Query to fetch search results with debouncing.
- **Components**: Main search bar in `app/(tabs)/knowledge.jsx` and the Chat interface.

## Backend Implementation
- **Router**: `backend/app/routers/search.py`
- Converts the user's search query string into a vector using `utils.ai.get_embedding`.
- Performs a SQL query using pgvector `<=>` operator to find the closest `KnowledgeChunk` records, joining back to the parent `KnowledgeItem`.

## API Endpoints
- `GET /search?q={query}` - Returns a list of KnowledgeItems sorted by semantic relevance.

## Database Models/Tables
- Joins `knowledge_items` and `knowledge_chunks`.

## AI/RAG Workflow
1. User types query.
2. Query is embedded (1536 dims).
3. DB vector search retrieves top matching chunks.
4. Parent items of those chunks are grouped and returned to the UI.

## Current Implementation Status
Fully implemented.
