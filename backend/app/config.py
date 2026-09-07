from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "f1c24e69b5e58fa2f33c3dc52e9cd1b5ce8aa58fd916e788c2b5357904e9c1b5"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@db:5432/orio"
    SUPABASE_URL: str = "https://kvxfxnztcwyygkfsciim.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    MONGODB_URL: str = "mongodb+srv://navasns0409:rx4Fvt8un1dCovaz@cluster0.lz452k4.mongodb.net/"
    REDIS_URL: str = "redis://redis:6379/0"
    
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_LLM_MODEL: str = "gemini-2.5-flash"

    # xAI / Grok LLM
    XAI_API_KEY: str = ""
    XAI_LLM_MODEL: str = "grok-4.6"
    
    # Google Drive Integration
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    GDRIVE_UPLOAD_FOLDER_ID: str = ""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
