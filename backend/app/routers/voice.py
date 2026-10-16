import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
import httpx
from app.config import settings
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["Voice"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/m4a", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav",
    "audio/x-wav", "audio/webm", "audio/ogg", "application/octet-stream",
}

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Transcribe a short user-recorded audio clip. Provider keys remain server-side."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Voice transcription is not configured. Set OPENAI_API_KEY on the backend.")
    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported audio format. Please record audio again in the app.")
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio:
        raise HTTPException(status_code=400, detail="The recording is empty.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Recording is too large. Keep voice clips under 25 MB.")
    filename = file.filename or "orio-voice.m4a"
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                data={"model": "gpt-4o-mini-transcribe"},
                files={"file": (filename, audio, content_type)},
            )
        if response.status_code >= 400:
            logger.warning("Transcription provider returned status %s", response.status_code)
            raise HTTPException(status_code=502, detail="Speech transcription failed. Please try again.")
        text = str(response.json().get("text", "")).strip()
        return {"text": text}
    except HTTPException:
        raise
    except httpx.HTTPError:
        logger.exception("Voice transcription provider unavailable")
        raise HTTPException(status_code=502, detail="Speech transcription service is temporarily unavailable.")
