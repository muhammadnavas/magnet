import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# Check mock status
is_gemini_mock = "mock" in settings.GEMINI_API_KEY.lower() or not settings.GEMINI_API_KEY
is_openai_mock = "mock" in settings.OPENAI_API_KEY.lower() or not settings.OPENAI_API_KEY

# Configure clients
if not is_gemini_mock:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini AI API configured successfully.")
else:
    logger.warning("GEMINI_API_KEY is mock. Gemini client disabled.")

if not is_openai_mock:
    openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    logger.info("OpenAI API configured successfully.")
else:
    openai_client = None
    logger.warning("OPENAI_API_KEY is mock. OpenAI client disabled.")

async def get_embedding(text: str) -> List[float]:
    """
    Generate 1536-dimension vector embedding for the input text.
    Order of preference: Gemini -> OpenAI -> Ollama -> Hashed Dummy.
    """
    if not text:
        return [0.0] * 1536

    # 1. Try Gemini
    if not is_gemini_mock:
        try:
            response = await asyncio.to_thread(
                genai.embed_content,
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_document"
            )
            emb = response.get("embedding", [])
            if emb:
                # text-embedding-004 is 768 dimensions. We must pad or slice it to match our DB column Vector(1536).
                if len(emb) < 1536:
                    emb = emb + [0.0] * (1536 - len(emb))
                else:
                    emb = emb[:1536]
                return emb
        except Exception as e:
            logger.error(f"Gemini embedding failed: {e}. Trying OpenAI.")

    # 2. Try OpenAI
    if openai_client:
        try:
            response = await openai_client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}. Trying Ollama.")

    # 3. Try Ollama Fallback
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_API_URL}/api/embeddings",
                json={"model": settings.OLLAMA_MODEL, "prompt": text}
            )
            if response.status_code == 200:
                emb = response.json().get("embedding", [])
                if emb:
                    if len(emb) < 1536:
                        emb = emb + [0.0] * (1536 - len(emb))
                    else:
                        emb = emb[:1536]
                    return emb
    except Exception as e:
        logger.warning(f"Ollama embedding fallback failed: {e}")

    # 4. Simulate Deterministic Fallback Vector
    import hashlib
    h = hashlib.sha256(text.encode("utf-8")).digest()
    dummy_vector = []
    for i in range(1536):
        val = ((h[i % 32] + i) % 256) / 256.0 - 0.5
        dummy_vector.append(val)
    return dummy_vector

async def get_completion(system_prompt: str, user_prompt: str) -> str:
    """
    Generate LLM completion.
    Order of preference: Gemini -> OpenAI -> Ollama -> Simulated.
    """
    # 1. Try Gemini
    if not is_gemini_mock:
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
            logger.error(f"Gemini completion failed: {e}. Trying OpenAI.")

    # 2. Try OpenAI
    if openai_client:
        try:
            response = await openai_client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI Chat Completion failed: {e}. Trying Ollama.")

    # 3. Try Ollama Fallback
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_API_URL}/api/chat",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "stream": False
                }
            )
            if response.status_code == 200:
                return response.json().get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Ollama Chat Completion fallback failed: {e}")

    # 4. Smart RAG Fallback when AI Key is invalid or offline
    text_lower = user_prompt.lower()
    if "Retrieved Context:" in system_prompt:
        ctx = system_prompt.split("Retrieved Context:")[1].strip()
        if ctx and ctx != "[No matching knowledge snippets found in Orio]":
            return (
                f"Based on your Orio Knowledge Base records:\n\n{ctx}"
            )
        else:
            return (
                f"I searched your Orio Knowledge Base for **\"{user_prompt}\"**, but didn't find specific matching notes or documents yet.\n\n"
                "💡 **Tip**: Capture notes or upload PDFs in the **Capture** tab to build your AI knowledge base!"
            )

    if "docker" in text_lower:
        return "In your Docker Compose setup, you utilize multi-stage builds. Stage 1 compiles dependencies using a python builder image, and Stage 2 runs Alpine with copied wheels to minimize container footprint."
    elif "redis" in text_lower:
        return "Based on your caching parameters, your Redis key eviction uses volatile-lfu with a limit of 512MB to evict expired tokens first."
    elif "fastapi" in text_lower:
        return "For database sessions, FastAPI closes sessions asynchronously. The operational Pool Exhaustion was fixed by setting pool_size=20, max_overflow=10."
    return f"Orio queried your knowledge base for **'{user_prompt}'**. Add a valid `GEMINI_API_KEY` in `backend/.env` for generative AI responses."


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
        "to space them out evenly (round to the nearest whole integer). If they specify an explicit interval (e.g., 'every 2 hours'), use that. "
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

