from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@db:5432/orio"
    SUPABASE_URL: str = "https://kvxfxnztcwyygkfsciim.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    MONGODB_URL: str = ""
    REDIS_URL: str = "redis://redis:6379/0"
    
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"  # default; overridden by ai.py fallback chain
    GEMINI_LLM_MODEL: str = "gemini-3.8-flash"            # current stable default; ai.py provides fallbacks

    # xAI / Grok LLM
    XAI_API_KEY: str = ""
    XAI_LLM_MODEL: str = "grok-4.6"
    
    # Google Drive Integration
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    GDRIVE_UPLOAD_FOLDER_ID: str = ""

    # GitHub OAuth. Register this exact HTTPS URL as the GitHub OAuth callback.
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""
    GITHUB_APP_REDIRECT_URI: str = "magnet://github/callback"

    # Google Classroom OAuth (Web Application client from Google Cloud Console)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_CLASSROOM_REDIRECT_URI: str = "http://localhost:8000/api/v1/classroom/callback"
    GOOGLE_CLASSROOM_APP_REDIRECT_URI: str = "magnet://classroom/callback"


    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
