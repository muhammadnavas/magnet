from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, knowledge, search, chat, projects, insights, github, sync

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup lifecycle hooks: Seed default developer user
    from app.database import async_session
    from app.models.user import User
    from app.utils.security import get_password_hash
    from sqlalchemy.future import select
    
    async with async_session() as db:
        try:
            result = await db.execute(select(User).where(User.email == "personal-app@orio.local"))
            user = result.scalars().first()
            if not user:
                user = User(
                    email="personal-app@orio.local",
                    hashed_password=get_password_hash("password"),
                    full_name="Navas",
                )
                db.add(user)
                await db.commit()
                print("Seeded default developer user: personal-app@orio.local / password")
        except Exception as e:
            print(f"Error seeding user on startup: {e}")
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
