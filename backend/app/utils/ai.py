import os
import json
import logging
import asyncio
from typing import List, Dict, Any

from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

def _get_gemini_key() -> str:
    key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY") or ""
    return key.strip()

def _make_client() -> genai.Client:
    """
    Create a google-genai client.
    Uses v1beta (the default) so that system_instruction works in generateContent.
    Embedding models (gemini-embedding-001, gemini-embedding-2) are also available on v1beta.
    """
    api_key = _get_gemini_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment variables.")
    return genai.Client(api_key=api_key)   # default = v1beta


# ---- Confirmed working models for this API key (from ListModels probe) ----
FREE_COMPLETION_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]

FREE_EMBEDDING_MODELS = [
    "gemini-embedding-001",   # confirmed present on v1 and v1beta
    "gemini-embedding-2",     # confirmed present on v1 and v1beta
]


async def get_embedding(text: str) -> List[float]:
    """
    Generate a vector embedding using google-genai SDK (v1beta).
    gemini-embedding-001 returns 768-dim; padded to 1536 to match DB column.
    """
    if not text:
        return [0.0] * 1536

    try:
        client = _make_client()
    except ValueError as e:
        logger.warning(str(e))
        return [0.0] * 1536

    for model_name in FREE_EMBEDDING_MODELS:
        try:
            response = await asyncio.to_thread(
                client.models.embed_content,
                model=model_name,
                contents=text,
            )
            values = response.embeddings[0].values if response.embeddings else []
            if values:
                values = list(values)
                if len(values) < 1536:
                    values += [0.0] * (1536 - len(values))
                else:
                    values = values[:1536]
                logger.info(f"Embedding OK: model='{model_name}' dim={len(values)}")
                return values
        except Exception as e:
            err = str(e)
            logger.warning(f"Embedding attempt with '{model_name}' failed: {err}")
            if "429" in err or "503" in err or "RESOURCE_EXHAUSTED" in err or "UNAVAILABLE" in err:
                await asyncio.sleep(1.0)

    logger.error("All embedding model attempts failed. Returning zero vector.")
    return [0.0] * 1536


async def get_completion(system_prompt: str, user_prompt: str) -> str:
    """
    Generate LLM completion using google-genai SDK (v1beta).
    system_instruction requires v1beta; falls back through confirmed working models.
    """
    try:
        client = _make_client()
    except ValueError as e:
        return f"AI unavailable: {e}"

    last_error = None
    for model_name in FREE_COMPLETION_MODELS:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.4,
                ),
            )
            if response and response.text:
                logger.info(f"Completion OK: model='{model_name}'")
                return response.text.strip()
        except Exception as e:
            err = str(e)
            logger.warning(f"Completion attempt with '{model_name}' failed: {err}")
            last_error = e
            if "429" in err or "503" in err or "RESOURCE_EXHAUSTED" in err or "UNAVAILABLE" in err:
                await asyncio.sleep(1.0)

    logger.error(f"All completion attempts failed. Last: {last_error}")
    return f"AI unavailable ({str(last_error) if last_error else 'all models failed'})."


REDUNDANT_TAGS = {"imported", "pdf", "file", "doc", "text", "document", "url", "github", "image", "unknown", "screenshot", "code", "error"}

async def analyze_document(text: str) -> Dict[str, Any]:
    """Analyze document text with LLM to extract summary, key points, tags, and technologies."""
    if not text:
        return {"summary": "Empty document", "key_points": [], "tags": [], "technologies": []}

    system_prompt = (
        "You are an expert technical document classifier. Analyze the provided text and output a JSON object "
        "with exactly these keys: 'summary' (str), 'key_points' (list of str, max 5), "
        "'tags' (list of lowercase str for specific domain topics like 'resume', 'python', 'database'), "
        "'technologies' (list of str). "
        "DO NOT include generic tags like 'pdf', 'file', 'imported', 'doc', 'text', or file extension names. "
        "Output ONLY valid JSON — no markdown code fences."
    )
    raw = await get_completion(system_prompt, f"Document content:\n{text[:6000]}")

    cleaned = raw.strip()
    for prefix in ("```json", "```"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        raw_tags = [str(t).lower().strip() for t in data.get("tags", [])]
        clean_tags = [t for t in raw_tags if t and t not in REDUNDANT_TAGS]
        return {
            "summary": data.get("summary", text[:150] + "..."),
            "key_points": data.get("key_points", []),
            "tags": clean_tags,
            "technologies": data.get("technologies", []),
        }
    except Exception:
        logger.warning(f"Failed to parse AI JSON. Raw: {raw[:200]}")
        return {
            "summary": " ".join(text.split()[:30]) + "...",
            "key_points": ["Document processed successfully."],
            "tags": [],
            "technologies": [],
        }


async def parse_task_intent(text: str, current_time: str) -> dict:
    """Parse natural language into structured task fields."""
    if not text:
        return {"title": "Untitled Task", "priority": "medium", "deadline": None, "reminder_interval_hours": 24}

    system_prompt = (
        "You are an expert NLP task parser. Output ONLY a valid JSON object with these keys:\n"
        "- 'title' (str): concise action title.\n"
        "- 'priority' (str): 'low', 'medium', or 'high'.\n"
        "- 'deadline' (str or null): ISO 8601 deadline if mentioned, else null.\n"
        "- 'reminder_interval_hours' (int): hours between reminders. "
        "If user says '3 reminders', divide hours-to-deadline by 3. "
        "If they say 'remind me at X', calculate hours from now to X. "
        "If they say 'every N hours', use N. Default: 24.\n"
        "DO NOT wrap in markdown."
    )
    raw = await get_completion(system_prompt, f"Current Time: {current_time}\nUser Input: {text}")

    cleaned = raw.strip()
    for prefix in ("```json", "```"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        return {
            "title": data.get("title", text.strip()),
            "priority": data.get("priority", "medium"),
            "deadline": data.get("deadline", None),
            "reminder_interval_hours": data.get("reminder_interval_hours", 24),
        }
    except Exception as e:
        logger.warning(f"Failed to parse task JSON: {e}. Raw: {raw[:200]}")
        return {"title": text.strip(), "priority": "medium", "deadline": None, "reminder_interval_hours": 24}
