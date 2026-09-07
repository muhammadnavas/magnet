import json
import logging
import os
from typing import Any, Dict

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

IMAGE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]

SUPPORTED_IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def _gemini_key() -> str:
    return (
        settings.GEMINI_API_KEY
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip()


def _client() -> genai.Client:
    key = _gemini_key()
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    return genai.Client(api_key=key)


def _parse_json(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


async def analyze_image(filepath: str) -> Dict[str, Any]:
    """Understand an image once and return compact searchable knowledge."""
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError(f"Image file not found: {filepath}")

    extension = os.path.splitext(filepath)[1].lower()
    mime_type = SUPPORTED_IMAGE_TYPES.get(extension)
    if not mime_type:
        raise ValueError(f"Unsupported image type: {extension or 'unknown'}")

    prompt = """
Analyze this image for Orio's personal knowledge base.

Extract useful information for future semantic search. Prioritize readable text,
code, error messages, commands, names, concepts, and technical details.
If the image contains code or an error, preserve the important text exactly.
Do not invent information that is not visible.

Return ONLY valid JSON with exactly these keys:
{
  "extracted_text": "all useful readable text, preserving code/errors where possible",
  "summary": "2-3 sentence concise summary of what the image contains",
  "key_points": ["up to 5 useful points"],
  "tags": ["lowercase topic tags"],
  "technologies": ["frameworks, languages, tools, databases, platforms"],
  "errors": ["important error messages, if any"]
}

For a mostly visual image with little/no text, describe the meaningful content in
extracted_text so the image remains searchable. Keep the output concise.
""".strip()

    client = _client()
    last_error = None

    for model_name in IMAGE_MODELS:
        try:
            with open(filepath, "rb") as image_file:
                image_bytes = image_file.read()

            response = await client.aio.models.generate_content(
                model=model_name,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "extracted_text": {"type": "STRING"},
                            "summary": {"type": "STRING"},
                            "key_points": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "technologies": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "errors": {"type": "ARRAY", "items": {"type": "STRING"}},
                        },
                        "required": ["extracted_text", "summary", "key_points", "tags", "technologies", "errors"],
                    },
                ),
            )

            if not response or not response.text:
                raise RuntimeError("Gemini returned an empty image analysis response.")

            data = _parse_json(response.text)
            result = {
                "extracted_text": str(data.get("extracted_text") or "").strip(),
                "summary": str(data.get("summary") or "").strip(),
                "key_points": [str(x).strip() for x in data.get("key_points", []) if str(x).strip()][:5],
                "tags": [str(x).strip().lower() for x in data.get("tags", []) if str(x).strip()][:12],
                "technologies": [str(x).strip() for x in data.get("technologies", []) if str(x).strip()][:12],
                "errors": [str(x).strip() for x in data.get("errors", []) if str(x).strip()][:8],
            }
            logger.info("Image analysis OK: model='%s' path='%s'", model_name, filepath)
            return result
        except Exception as exc:
            last_error = exc
            error_text = str(exc)
            logger.warning("Image analysis with '%s' failed: %s", model_name, error_text)
            if not any(code in error_text for code in ("429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL")):
                continue

    raise RuntimeError(f"Image analysis failed after {len(IMAGE_MODELS)} models: {last_error}")
