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

def _make_client(api_key: str) -> genai.Client:
    """Create a google-genai client targeting the stable v1 API."""
    return genai.Client(
        api_key=api_key,
        http_options={"api_version": "v1"},
    )

# ---- Confirmed working models (from live probe) ----
# Completion: gemini-2.5-flash, gemini-3.6-flash, gemini-3.5-flash-lite
# Embedding:  text-embedding-004 (works on v1, failed on v1beta with old SDK)

FREE_COMPLETION_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]

FREE_EMBEDDING_MODELS = [
    "text-embedding-004",
    "embedding-001",
    "text-multilingual-embedding-002",
]

async def get_embedding(text: str) -> List[float]:
    """
    Generate a vector embedding for the input text using the new google-genai SDK (v1 API).
    Returns a 768-dim vector (text-embedding-004 native dim), padded/truncated to 1536 for DB.
    """
    if not text:
        return [0.0] * 1536

    api_key = _get_gemini_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY missing – returning zero vector.")
        return [0.0] * 1536

    client = _make_client(api_key)

    for model_name in FREE_EMBEDDING_MODELS:
        try:
            response = await asyncio.to_thread(
                client.models.embed_content,
                model=model_name,
                contents=text,
            )
            # New SDK returns EmbedContentResponse with .embeddings list
            values = response.embeddings[0].values if response.embeddings else []
            if values:
                # Pad or truncate to 1536 to match DB column
                if len(values) < 1536:
                    values = list(values) + [0.0] * (1536 - len(values))
                else:
                    values = list(values)[:1536]
                logger.info(f"Embedding generated with model '{model_name}', dim={len(values)}")
                return values
        except Exception as e:
            err = str(e)
            logger.warning(f"Embedding attempt with '{model_name}' failed: {err}")
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                await asyncio.sleep(1.0)

    logger.error("All embedding model attempts failed. Returning zero vector.")
    return [0.0] * 1536


async def get_completion(system_prompt: str, user_prompt: str) -> str:
    """
    Generate LLM text completion using the new google-genai SDK (v1 API).
    Falls back through confirmed working models automatically.
    """
    api_key = _get_gemini_key()
    if not api_key:
        return "AI unavailable: GEMINI_API_KEY missing in backend environment."

    client = _make_client(api_key)

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
                logger.info(f"Completion generated with model '{model_name}'")
                return response.text.strip()
        except Exception as e:
            err = str(e)
            logger.warning(f"Completion attempt with '{model_name}' failed: {err}")
            last_error = e
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                await asyncio.sleep(1.0)

    logger.error(f"All completion model attempts failed. Last error: {last_error}")
    return f"AI unavailable ({str(last_error) if last_error else 'all models failed'})."


async def analyze_document(text: str) -> Dict[str, Any]:
    """
    Analyze document text with LLM to extract summary, key points, tags, and technologies.
    """
    if not text:
        return {"summary": "Empty document", "key_points": [], "tags": [], "technologies": []}

    system_prompt = (
        "You are an expert technical document classifier. Analyze the provided text and output a JSON object "
        "with exactly these keys: 'summary' (str), 'key_points' (list of str, max 5), "
        "'tags' (list of lowercase str), 'technologies' (list of str). "
        "Output ONLY valid JSON — no markdown code fences."
    )
    user_prompt = f"Document content:\n{text[:6000]}"

    raw = await get_completion(system_prompt, user_prompt)

    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        return {
            "summary": data.get("summary", text[:150] + "..."),
            "key_points": data.get("key_points", []),
            "tags": [str(t).lower() for t in data.get("tags", [])],
            "technologies": data.get("technologies", []),
        }
    except Exception:
        logger.warning(f"Failed to parse AI JSON response: {raw[:200]}")
        return {
            "summary": " ".join(text.split()[:30]) + "...",
            "key_points": ["Document processed successfully."],
            "tags": ["imported"],
            "technologies": [],
        }


async def parse_task_intent(text: str, current_time: str) -> dict:
    """
    Parse natural language into structured task fields.
    Returns: { "title", "priority", "deadline", "reminder_interval_hours" }
    """
    if not text:
        return {"title": "Untitled Task", "priority": "medium", "deadline": None, "reminder_interval_hours": 24}

    system_prompt = (
        "You are an expert NLP task parser. Analyze the user's input and extract task details. "
        "The current time is provided so you can calculate exact deadlines (ISO 8601 format). "
        "Output ONLY a valid JSON object with these keys:\n"
        "- 'title' (str): concise action title.\n"
        "- 'priority' (str): 'low', 'medium', or 'high'.\n"
        "- 'deadline' (str or null): ISO 8601 deadline if mentioned, else null.\n"
        "- 'reminder_interval_hours' (int): hours between reminders. "
        "If user says '3 reminders', divide hours-to-deadline by 3. "
        "If they say 'remind me at X', calculate hours from now to X. "
        "If they say 'every N hours', use N. Default: 24.\n"
        "DO NOT wrap in markdown."
    )
    user_prompt = f"Current Time: {current_time}\nUser Input: {text}"

    raw = await get_completion(system_prompt, user_prompt)

    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
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
        return {
            "title": text.strip(),
            "priority": "medium",
            "deadline": None,
            "reminder_interval_hours": 24,
        }
