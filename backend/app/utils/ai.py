import json
import logging
import asyncio
from typing import List, Dict, Any
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# Configure clients
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini AI API configured successfully.")
else:
    logger.warning("GEMINI_API_KEY is missing. Gemini client disabled.")

async def get_embedding(text: str) -> List[float]:
    """
    Generate 1536-dimension vector embedding for the input text using Gemini.
    """
    if not text:
        return [0.0] * 1536

    if settings.GEMINI_API_KEY:
        try:
            response = await asyncio.to_thread(
                genai.embed_content,
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_document"
            )
            emb = response.get("embedding", [])
            if emb:
                # text-embedding-004/embedding-001 is 768 dimensions. We must pad or slice it to match our DB column Vector(1536).
                if len(emb) < 1536:
                    emb = emb + [0.0] * (1536 - len(emb))
                else:
                    emb = emb[:1536]
                return emb
        except Exception as e:
            logger.error(f"Gemini embedding failed: {e}")

    logger.warning("Returning empty vector because Gemini failed or is not configured.")
    return [0.0] * 1536

async def get_completion(system_prompt: str, user_prompt: str) -> str:
    """
    Generate LLM completion using Gemini exclusively.
    """
    if settings.GEMINI_API_KEY:
        try:
            # We configure GenerativeModel. Gemini uses system_instruction parameter for the system prompt.
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_LLM_MODEL,
                system_instruction=system_prompt
            )
            response = await model.generate_content_async(
                contents=user_prompt
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini completion failed: {e}")

    return "AI is currently unavailable. Please check your Gemini configuration."


async def analyze_document(text: str) -> Dict[str, Any]:
    """
    Analyze document text using LLM to extract a summary, key points, tags, and technologies.
    """
    if not text:
        return {
            "summary": "Empty document",
            "key_points": [],
            "tags": [],
            "technologies": []
        }

    system_prompt = (
        "You are an expert technical document classifier. Analyze the provided text and output a JSON object containing "
        "the following keys exactly: 'summary' (str), 'key_points' (list of str, max 5 bullets), "
        "'tags' (list of str lowercase), and 'technologies' (list of str). "
        "Response MUST be a valid JSON object ONLY, with no extra markdown formatting."
    )
    user_prompt = f"Document content:\n{text[:6000]}" # Limit size to prevent token overflow

    raw_response = await get_completion(system_prompt, user_prompt)
    
    # Attempt to clean and load JSON
    cleaned = raw_response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        return {
            "summary": data.get("summary", text[:150] + "..."),
            "key_points": data.get("key_points", []),
            "tags": [str(t).lower() for t in data.get("tags", [])],
            "technologies": data.get("technologies", [])
        }
    except Exception:
        logger.warning(f"Failed to parse AI analysis JSON. Response was: {raw_response}")
        words = text.split()
        return {
            "summary": " ".join(words[:30]) + "...",
            "key_points": ["Document uploaded and processed successfully."],
            "tags": ["imported"],
            "technologies": []
        }

async def parse_task_intent(text: str, current_time: str) -> dict:
    """
    Parse natural language into structured task fields.
    Returns: { "title": str, "priority": str, "deadline": str | None, "reminder_interval_hours": int }
    """
    if not text:
        return {"title": "Untitled Task", "priority": "medium", "deadline": None, "reminder_interval_hours": 24}

    system_prompt = (
        "You are an expert NLP task parser. Analyze the user's input and extract task details. "
        "The current time is provided so you can calculate exact deadlines (in ISO 8601 format like YYYY-MM-DDTHH:MM:SSZ). "
        "Output ONLY a valid JSON object with EXACTLY these keys:\n"
        "- 'title' (str): A clean, concise title describing the core action (e.g., 'Submit ML assignment').\n"
        "- 'priority' (str): 'low', 'medium', or 'high'. Default to 'medium' unless urgency is implied.\n"
        "- 'deadline' (str or null): ISO 8601 formatted string if a deadline/time is mentioned, else null.\n"
        "- 'reminder_interval_hours' (int): The number of hours between reminders. Calculate this smartly: "
        "If the user asks for a specific number of reminders (e.g., 'set 3 reminders' or 'remind me 3 times'), "
        "calculate the total hours between the current time and the deadline, and divide it by the number of reminders "
        "to space them out evenly (round to the nearest whole integer). "
        "If they specify an exact date/time for the reminder (e.g., 'remind me tomorrow at 11 am'), "
        "calculate the total hours between the current time and that exact time, and set it as the interval. "
        "If they specify an explicit interval (e.g., 'every 2 hours'), use that. "
        "Otherwise, default to 24.\n"
        "DO NOT wrap your response in markdown code blocks, just raw JSON."
    )
    user_prompt = f"Current Time: {current_time}\nUser Input: {text}"

    raw_response = await get_completion(system_prompt, user_prompt)
    
    cleaned = raw_response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        return {
            "title": data.get("title", text.strip()),
            "priority": data.get("priority", "medium"),
            "deadline": data.get("deadline", None),
            "reminder_interval_hours": data.get("reminder_interval_hours", 24)
        }
    except Exception as e:
        logger.warning(f"Failed to parse task JSON: {e}. Raw response: {raw_response}")
        # Fallback
        return {
            "title": text.strip(),
            "priority": "medium",
            "deadline": None,
            "reminder_interval_hours": 24
        }

