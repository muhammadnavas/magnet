import os
import re
import json
import logging
import asyncio
from typing import List, Dict, Any

from google import genai
from google.genai import types
from app.config import settings
from app.utils.grok import get_grok_completion

logger = logging.getLogger(__name__)


def _get_gemini_key() -> str:
    key = (
        settings.GEMINI_API_KEY or
        os.getenv("GEMINI_API_KEY") or
        os.getenv("GOOGLE_GEMINI_API_KEY") or
        os.getenv("GOOGLE_API_KEY") or
        os.getenv("GEMINI_KEY") or
        ""
    )
    return key.strip()


def _make_client() -> genai.Client:
    api_key = _get_gemini_key()
    if not api_key:
        logger.error("GEMINI_API_KEY is not configured.")
        raise ValueError("GEMINI_API_KEY is not configured in deployment environment settings.")
    return genai.Client(api_key=api_key)


def _clean_model_name(name: str) -> str:
    if not name:
        return ""
    cleaned = name.strip()
    if cleaned.startswith("models/"):
        cleaned = cleaned[len("models/"):]
    return cleaned


# Reliability-first order: lighter models are tried before large Flash models.
# A 503 UNAVAILABLE is a server-side capacity error, so switching models is
# more useful than repeatedly hammering the same overloaded model.
DEFAULT_COMPLETION_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3-flash-preview",
]

DEFAULT_EMBEDDING_MODELS = [
    "gemini-embedding-001",
    "gemini-embedding-2",
]


async def get_embedding(text: str) -> List[float]:
    if not text:
        return [0.0] * 1536

    try:
        client = _make_client()
    except ValueError as e:
        logger.warning(str(e))
        return [0.0] * 1536

    configured_model = _clean_model_name(
        settings.GEMINI_EMBEDDING_MODEL or os.getenv("GEMINI_EMBEDDING_MODEL", "")
    )
    candidates = []
    if configured_model and configured_model not in ("text-embedding-004", "models/text-embedding-004"):
        candidates.append(configured_model)
    for model in DEFAULT_EMBEDDING_MODELS:
        if model not in candidates:
            candidates.append(model)

    for model_name in candidates:
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
                logger.info("Embedding OK: model='%s' dim=%s", model_name, len(values))
                return values
        except Exception as e:
            err = str(e)
            logger.warning("Embedding attempt with '%s' failed: %s", model_name, err)
            if "429" in err or "503" in err or "RESOURCE_EXHAUSTED" in err or "UNAVAILABLE" in err:
                await asyncio.sleep(1.0)

    logger.error("All embedding model attempts failed. Returning zero vector.")
    return [0.0] * 1536


async def _get_gemini_completion(
    system_prompt: str,
    user_prompt: str,
    history: List[Dict[str, str]] = None,
) -> str:
    client = _make_client()

    full_user_content = ""
    if history:
        history_lines = []
        for msg in history:
            role_name = "User" if msg.get("role") == "user" else "Orio (AI)"
            history_lines.append(f"{role_name}: {msg.get('content', '')}")
        full_user_content += "Previous Conversation Context:\n" + "\n".join(history_lines) + "\n\n"

    full_user_content += f"User Query: {user_prompt}"

    configured_model = _clean_model_name(
        settings.GEMINI_LLM_MODEL or os.getenv("GEMINI_LLM_MODEL", "")
    )
    candidates = list(DEFAULT_COMPLETION_MODELS)
    if configured_model and configured_model not in candidates:
        candidates.append(configured_model)

    last_error = None
    for model_name in candidates:
        # One retry with exponential backoff + jitter, then immediately fail
        # over to a different model. This avoids spending minutes retrying a
        # model that Google is currently rejecting for capacity reasons.
        for attempt in range(1, 3):
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=full_user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                    ),
                )
                if response and response.text:
                    logger.info("Gemini completion OK: model='%s' attempt=%d", model_name, attempt)
                    return response.text.strip()

                last_error = RuntimeError(f"Model '{model_name}' returned an empty response.")
                logger.warning("Gemini model '%s' returned an empty response.", model_name)
                break
            except Exception as e:
                err = str(e)
                last_error = e
                logger.warning(
                    "Gemini completion attempt with '%s' (%d/2) failed: %s",
                    model_name, attempt, err,
                )

                transient = any(marker in err for marker in (
                    "429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"
                ))
                if transient and attempt == 1:
                    # 1.5s first retry + small jitter prevents synchronized retries.
                    await asyncio.sleep(1.5 + (0.5 * __import__("random").random()))
                    continue
                break

    raise RuntimeError(
        f"Gemini completion failed after trying {len(candidates)} models "
        f"({str(last_error) if last_error else 'all models failed'})."
    )


async def get_completion(
    system_prompt: str,
    user_prompt: str,
    history: List[Dict[str, str]] = None,
    provider: str = None,
) -> str:
    selected_provider = (provider or os.getenv("LLM_PROVIDER", "gemini") or "gemini").strip().lower()

    if selected_provider == "grok":
        try:
            return await get_grok_completion(system_prompt, user_prompt, history)
        except Exception as grok_error:
            logger.error("Grok completion failed: %s", grok_error)
            return f"AI unavailable (grok: {grok_error})."

    if selected_provider not in {"gemini", "grok"}:
        logger.warning("Unknown LLM provider '%s'; falling back to Gemini.", selected_provider)

    try:
        return await _get_gemini_completion(system_prompt, user_prompt, history)
    except Exception as gemini_error:
        logger.error("Gemini completion failed: %s", gemini_error)
        return f"AI unavailable (gemini: {gemini_error})."


REDUNDANT_TAGS = {"imported", "pdf", "file", "doc", "text", "document", "url", "github", "image", "unknown", "screenshot", "code", "error"}


async def analyze_document(text: str) -> Dict[str, Any]:
    if not text:
        return {"summary": "Empty document", "key_points": [], "tags": [], "technologies": []}

    system_prompt = (
        "You are an expert senior technical document analyst for Orio AI co-pilot. "
        "Analyze the provided document text and output a JSON object with exactly these keys:\n"
        "1. 'summary' (str): A well-crafted, synthesized 2-3 sentence overview explaining what this document is, its primary significance, key themes, and main value. DO NOT just copy or extract lines verbatim.\n"
        "2. 'key_points' (list of str, max 5): Strategic takeaways, core technical components, or takeaways synthesized intelligently from the text.\n"
        "3. 'tags' (list of lowercase str): Specific domain and topic tags. NEVER include generic tags like 'pdf', 'file', 'imported', 'doc', 'text'.\n"
        "4. 'technologies' (list of str): Frameworks, languages, tools, databases, or platforms mentioned.\n\n"
        "Output ONLY valid JSON — no markdown code fences or extra commentary."
    )
    raw = await get_completion(system_prompt, f"Document content:\n{text[:6000]}")
    cleaned = raw.strip()
    for prefix in ("```json", "```"):
        if cleaned.startswith(prefix): cleaned = cleaned[len(prefix):]
    if cleaned.endswith("```"): cleaned = cleaned[:-3]
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
        logger.warning("Failed to parse AI JSON. Raw: %s", raw[:200])
        return {"summary": " ".join(text.split()[:30]) + "...", "key_points": ["Document processed successfully."], "tags": [], "technologies": []}


from datetime import datetime, timedelta


def _rule_based_task_parse(text: str, current_time: str) -> dict:
    try:
        if current_time:
            now_dt = datetime.fromisoformat(current_time.replace("Z", "+00:00")).replace(tzinfo=None)
        else:
            now_dt = datetime.now()
    except Exception:
        now_dt = datetime.now()

    clean_title = text.strip()
    deadline = None
    reminder_interval = 24
    min_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:min|mins|minute|minutes)', text, re.IGNORECASE) or re.search(r'(\d+)\s*(?:min|mins|minute|minutes)', text, re.IGNORECASE)
    hour_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:hr|hrs|hour|hours)', text, re.IGNORECASE) or (None if min_match else re.search(r'(\d+)\s*(?:hr|hrs|hour|hours)', text, re.IGNORECASE))
    day_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:day|days)', text, re.IGNORECASE)

    if min_match:
        mins = int(min_match.group(1)); deadline = now_dt + timedelta(minutes=mins); reminder_interval = 1
    elif hour_match:
        hrs = int(hour_match.group(1)); deadline = now_dt + timedelta(hours=hrs); reminder_interval = max(1, hrs)
    elif day_match:
        days = int(day_match.group(1)); deadline = now_dt + timedelta(days=days)
    elif "tomorrow" in text.lower():
        deadline = now_dt + timedelta(days=1)

    clean_title = re.sub(r'^(set\s+(?:a\s+)?(?:three\s+)?reminder\s+(?:for\s+)?|remind\s+me\s+to\s+|remind\s+me\s+)', '', clean_title, flags=re.IGNORECASE).strip()
    clean_title = re.sub(r'\s*(?:for\s+next|in|next)\s+\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours|day|days)\b', '', clean_title, flags=re.IGNORECASE).strip()
    if not clean_title or clean_title.lower() in ("reminder", "reminders", "set a reminder", "set a three reminder"): clean_title = "Reminder"
    return {"title": clean_title.capitalize(), "priority": "medium", "deadline": deadline.isoformat() if deadline else None, "reminder_interval_hours": reminder_interval}


async def parse_task_intent(text: str, current_time: str) -> dict:
    if not text:
        return {"title": "Untitled Task", "priority": "medium", "deadline": None, "reminder_interval_hours": 24}

    fallback = _rule_based_task_parse(text, current_time)
    system_prompt = (
        "You are an expert NLP task parser. Analyze the user prompt and current ISO timestamp.\n"
        "1. Extract a concise, clean action title (remove trigger phrases like 'set a reminder for', 'in 5 minutes').\n"
        "2. Priority: 'low', 'medium', or 'high'.\n"
        "3. Deadline: Calculate the exact target ISO 8601 deadline timestamp if a target date/time/duration is mentioned. If no time mentioned, return null.\n"
        "4. reminder_interval_hours: int (default 24).\n\n"
        "Output ONLY a valid JSON object with keys 'title', 'priority', 'deadline', 'reminder_interval_hours'. No markdown wrapping."
    )
    raw = await get_completion(system_prompt, f"Current Time: {current_time}\nUser Input: {text}")
    cleaned = raw.strip()
    for prefix in ("```json", "```"):
        if cleaned.startswith(prefix): cleaned = cleaned[len(prefix):]
    if cleaned.endswith("```"): cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        data = json.loads(cleaned)
        parsed_title = str(data.get("title", "")).strip()
        parsed_deadline = data.get("deadline", None)
        return {
            "title": parsed_title if parsed_title and parsed_title.lower() not in ("untitled task", text.lower()) else fallback["title"],
            "priority": data.get("priority", fallback["priority"]),
            "deadline": parsed_deadline if parsed_deadline else fallback["deadline"],
            "reminder_interval_hours": data.get("reminder_interval_hours", fallback["reminder_interval_hours"]),
        }
    except Exception as e:
        logger.warning("Failed to parse task JSON: %s. Using fallback rule parser.", e)
        return fallback
