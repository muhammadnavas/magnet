import os
import re
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
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
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


async def get_completion(system_prompt: str, user_prompt: str, history: List[Dict[str, str]] = None) -> str:
    """
    Generate LLM completion using google-genai SDK (v1beta).
    system_instruction requires v1beta; falls back through confirmed working models.
    Supports multi-turn conversation context via history parameter.
    """
    try:
        client = _make_client()
    except ValueError as e:
        return f"AI unavailable: {e}"

    full_user_content = ""
    if history:
        history_lines = []
        for msg in history:
            role_name = "User" if msg.get("role") == "user" else "Orio (AI)"
            history_lines.append(f"{role_name}: {msg.get('content', '')}")
        full_user_content += "Previous Conversation Context:\n" + "\n".join(history_lines) + "\n\n"

    full_user_content += f"User Query: {user_prompt}"

    last_error = None
    for model_name in FREE_COMPLETION_MODELS:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=full_user_content,
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
        "You are an expert senior technical document analyst for Orio AI co-pilot. "
        "Analyze the provided document text and output a JSON object with exactly these keys:\n"
        "1. 'summary' (str): A well-crafted, synthesized 2-3 sentence overview explaining what this document is, its primary significance, key themes, and main value. DO NOT just copy or extract lines verbatim.\n"
        "2. 'key_points' (list of str, max 5): Strategic takeaways, core technical components, or takeaways synthesized intelligently from the text.\n"
        "3. 'tags' (list of lowercase str): Specific domain and topic tags (e.g. 'resume', 'python', 'fastapi', 'machine-learning'). NEVER include generic tags like 'pdf', 'file', 'imported', 'doc', 'text'.\n"
        "4. 'technologies' (list of str): Frameworks, languages, tools, databases, or platforms mentioned.\n\n"
        "Output ONLY valid JSON — no markdown code fences or extra commentary."
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


from datetime import datetime, timedelta

def _rule_based_task_parse(text: str, current_time: str) -> dict:
    """Fallback rule-based parser for relative time phrases."""
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

    min_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:min|mins|minute|minutes)', text, re.IGNORECASE)
    if not min_match:
        min_match = re.search(r'(\d+)\s*(?:min|mins|minute|minutes)', text, re.IGNORECASE)

    hour_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:hr|hrs|hour|hours)', text, re.IGNORECASE)
    if not hour_match and not min_match:
        hour_match = re.search(r'(\d+)\s*(?:hr|hrs|hour|hours)', text, re.IGNORECASE)

    day_match = re.search(r'(?:in|next|for)\s+(\d+)\s*(?:day|days)', text, re.IGNORECASE)

    if min_match:
        mins = int(min_match.group(1))
        deadline = now_dt + timedelta(minutes=mins)
        reminder_interval = max(1, mins // 60) if mins >= 60 else 1
    elif hour_match:
        hrs = int(hour_match.group(1))
        deadline = now_dt + timedelta(hours=hrs)
        reminder_interval = max(1, hrs)
    elif day_match:
        days = int(day_match.group(1))
        deadline = now_dt + timedelta(days=days)
        reminder_interval = 24
    elif "tomorrow" in text.lower():
        deadline = now_dt + timedelta(days=1)
        reminder_interval = 24

    # Strip trigger prefix and suffix
    clean_title = re.sub(r'^(set\s+(?:a\s+)?(?:three\s+)?reminder\s+(?:for\s+)?|remind\s+me\s+to\s+|remind\s+me\s+)', '', clean_title, flags=re.IGNORECASE).strip()
    clean_title = re.sub(r'\s*(?:for\s+next|in|next)\s+\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours|day|days)\b', '', clean_title, flags=re.IGNORECASE).strip()
    
    if not clean_title or clean_title.lower() in ("reminder", "reminders", "set a reminder", "set a three reminder"):
        clean_title = "Reminder"

    return {
        "title": clean_title.capitalize(),
        "priority": "medium",
        "deadline": deadline.isoformat() if deadline else None,
        "reminder_interval_hours": reminder_interval,
    }


async def parse_task_intent(text: str, current_time: str) -> dict:
    """Parse natural language into structured task fields."""
    if not text:
        return {"title": "Untitled Task", "priority": "medium", "deadline": None, "reminder_interval_hours": 24}

    fallback = _rule_based_task_parse(text, current_time)

    system_prompt = (
        "You are an expert NLP task parser. Analyze the user prompt and current ISO timestamp.\n"
        "1. Extract a concise, clean action title (remove trigger phrases like 'set a reminder for', 'in 5 minutes').\n"
        "2. Priority: 'low', 'medium', or 'high'.\n"
        "3. Deadline: Calculate the exact target ISO 8601 deadline timestamp if a target date/time/duration is mentioned (e.g. 'next 5 minutes' -> current_time + 5 mins). If no time mentioned, return null.\n"
        "4. reminder_interval_hours: int (default 24).\n\n"
        "Output ONLY a valid JSON object with keys 'title', 'priority', 'deadline', 'reminder_interval_hours'. No markdown wrapping."
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
        parsed_title = str(data.get("title", "")).strip()
        parsed_deadline = data.get("deadline", None)
        
        # If AI returned generic or unparsed title/null deadline when rule-based found a deadline, merge them
        final_title = parsed_title if parsed_title and parsed_title.lower() not in ("untitled task", text.lower()) else fallback["title"]
        final_deadline = parsed_deadline if parsed_deadline else fallback["deadline"]
        
        return {
            "title": final_title,
            "priority": data.get("priority", fallback["priority"]),
            "deadline": final_deadline,
            "reminder_interval_hours": data.get("reminder_interval_hours", fallback["reminder_interval_hours"]),
        }
    except Exception as e:
        logger.warning(f"Failed to parse task JSON: {e}. Using fallback rule parser.")
        return fallback
