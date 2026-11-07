# Magnet Backend API

This is the Python FastAPI backend service orchestrating database sessions (via PostgreSQL + pgvector), vector similarity queries, task queueing (via ARQ + Redis), and JWT-based authentication.

## Tech Stack
- **FastAPI**: Asynchronous high-performance REST API
- **SQLAlchemy (Async)**: Database ORM
- **pgvector**: Native PostgreSQL vector operations
- **ARQ**: Async Redis Queue for document ingestion pipeline processing
- **JWT (python-jose)**: Security and session refresh token checks

## System Requirements
- Docker and Docker Compose installed

## Setup and Running

1. **Clone & Configure Environments**
   Copy the default `.env.example` configurations to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Modify variables in `.env` like `SECRET_KEY` and `OPENAI_API_KEY` to apply valid credentials.*

2. **Spin Up Containers**
   Launch database, cache, API server, and task worker:
   ```bash
   docker compose up --build
   ```

3. **Verify API Docs**
   Once containers show healthy, navigate in your web browser to:
   - Swagger OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc alternative docs: [http://localhost:8000/redoc](http://localhost:8000/redoc)


## Decision Intelligence

Decision Intelligence provides decision creation, AI-assisted scenario hypotheses, branch timelines, and event updates. See docs/DECISION_INTELLIGENCE.md for the workflow and API details. The existing container startup runs alembic upgrade head before launching FastAPI, applying the decision tables automatically.
