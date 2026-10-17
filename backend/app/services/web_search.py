"""Best-effort free web search using the community-maintained ddgs package.

No API key or payment details are required. Search may be throttled by upstream
providers, so callers should treat it as optional context rather than a guarantee.
"""
import asyncio
import logging
import re
from typing import Any

from ddgs import DDGS

logger = logging.getLogger(__name__)

MAX_RESULTS = 5
SEARCH_TIMEOUT_SECONDS = 8

# Search only when the user explicitly asks for the web or asks about information
# that is likely to change. Avoid sending every ordinary chat message to search.
_WEB_INTENT = re.compile(
    r"\\b("
    r"search (?:the )?web|web search|look up|google it|find online|search online|"
    r"latest|current|currently|today|tonight|this week|this month|recent|"
    r"news|weather|price|pricing|release date|new version|updated in \\d{4}|"
    r"who is the (?:current|latest)|what happened"
    r")\\b",
    re.IGNORECASE,
)


def should_search_web(query: str) -> bool:
    return bool(query and _WEB_INTENT.search(query))


def _search_sync(query: str) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    with DDGS() as ddgs:
        for item in ddgs.text(query, max_results=MAX_RESULTS):
            title = str(item.get("title") or "").strip()
            url = str(item.get("href") or item.get("url") or "").strip()
            snippet = str(item.get("body") or item.get("description") or "").strip()
            if not title or not url.startswith(("https://", "http://")):
                continue
            results.append({
                "title": title[:240],
                "url": url,
                "snippet": snippet[:1000],
            })
    return results


async def search_web(query: str) -> list[dict[str, Any]]:
    """Return a small set of search results; errors degrade gracefully."""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_search_sync, query),
            timeout=SEARCH_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.warning("Free web search unavailable: %s", exc)
        return []
