from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, knowledge, search, chat, projects, insights, github, sync

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup lifecycle hooks (e.g. redis pools initialization in Phase 2)
    yield
    # Shutdown hooks

app = FastAPI(
    title="Orio API",
    description="Backend API orchestrating PostgreSQL, pgvector, Redis task queues, and AI models.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurations for mobile emulators and local frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Expand in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(github.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")

@app.get("/health", tags=["Healthcheck"])
def health_check():
    return {"status": "ok", "app": "Orio Backend API", "version": "1.0.0"}
