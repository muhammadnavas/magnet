"""xAI Grok LLM provider for Orio.

Grok is intentionally isolated from the existing Gemini implementation so the
rest of the application can switch providers without duplicating RAG logic.
"""

import asyncio
import logging
import os
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

XAI_BASE_URL = "https://api.x.ai/v1"
DEFAULT_GROK_MODEL = "grok-4.6"


def _get_xai_key() -> str:
    return (
        settings.XAI_API_KEY
        or os.getenv("XAI_API_KEY")
        or ""
    ).strip()


def _get_grok_model() -> str:
    return (
        settings.XAI_LLM_MODEL
        or os.getenv("XAI_LLM_MODEL")
        or DEFAULT_GROK_MODEL
    ).strip()


def _build_input(
    system_prompt: str,
    user_prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    if history:
        for msg in history:
            role = msg.get("role", "user")
            if role not in {"user", "assistant", "system"}:
                role = "user"
            messages.append({
                "role": role,
                "content": msg.get("content", ""),
            })

    messages.append({"role": "user", "content": user_prompt})
    return messages


async def get_grok_completion(
    system_prompt: str,
    user_prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Generate a text completion using xAI's Grok Responses API."""
    api_key = _get_xai_key()
    if not api_key:
        raise ValueError("XAI_API_KEY is not configured in deployment environment settings.")

    payload = {
        "model": _get_grok_model(),
        "input": _build_input(system_prompt, user_prompt, history),
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(120.0, connect=15.0)

    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{XAI_BASE_URL}/responses",
                    headers=headers,
                    json=payload,
                )

            if response.status_code in {429, 500, 502, 503, 504} and attempt < 2:
                logger.warning(
                    "Grok request returned %s; retrying (attempt %s/3)",
                    response.status_code,
                    attempt + 1,
                )
                await asyncio.sleep(1.5 * (attempt + 1))
                continue

            response.raise_for_status()
            data = response.json()

            # The Responses API exposes output_text on supported responses.
            output_text = data.get("output_text")
            if output_text:
                logger.info("Grok completion OK: model='%s'", payload["model"])
                return str(output_text).strip()

            # Defensive parsing for response objects that only expose output[].
            parts: List[str] = []
            for item in data.get("output", []) or []:
                if item.get("type") != "message":
                    continue
                for content in item.get("content", []) or []:
                    text = content.get("text")
                    if text:
                        parts.append(str(text))

            if parts:
                logger.info("Grok completion OK: model='%s'", payload["model"])
                return "\n".join(parts).strip()

            raise RuntimeError("Grok returned an empty response.")

        except (httpx.HTTPError, ValueError, RuntimeError) as exc:
            last_error = exc
            logger.warning("Grok completion attempt %s failed: %s", attempt + 1, exc)
            if attempt < 2:
                await asyncio.sleep(1.0 * (attempt + 1))

    raise RuntimeError(f"Grok request failed: {last_error}")
