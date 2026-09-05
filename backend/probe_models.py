"""
Probe all candidate Gemini models to find which are live on this API key.
Run from /backend: python probe_models.py
"""
import os, asyncio, httpx, sys

sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "AQ.Ab8RN6LBmfHnL7UVWQpw5k8fdTtUg8hVJwTo8bKhT92E2h6zmw"
BASE = "https://generativelanguage.googleapis.com/v1beta"

COMPLETION_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

EMBEDDING_CANDIDATES = [
    "text-embedding-004",
    "embedding-001",
    "text-multilingual-embedding-002",
    "gemini-embedding-exp-03-07",
    "gemini-embedding-exp",
]

async def test_completion(client, model):
    url = f"{BASE}/models/{model}:generateContent?key={API_KEY}"
    body = {"contents": [{"parts": [{"text": "Say OK"}]}]}
    try:
        r = await client.post(url, json=body, timeout=15)
        if r.status_code == 200:
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return f"  [OK]  {model} -> '{text.strip()[:40]}'"
        else:
            err = r.json().get("error", {}).get("message", r.text)[:120]
            return f"  [XX]  {model} -> {r.status_code}: {err}"
    except Exception as e:
        return f"  [EX]  {model} -> EXCEPTION: {e}"

async def test_embedding(client, model):
    url = f"{BASE}/models/{model}:embedContent?key={API_KEY}"
    body = {"model": f"models/{model}", "content": {"parts": [{"text": "hello"}]}}
    try:
        r = await client.post(url, json=body, timeout=15)
        if r.status_code == 200:
            vec = r.json().get("embedding", {}).get("values", [])
            return f"  [OK]  {model} -> dim={len(vec)}"
        else:
            err = r.json().get("error", {}).get("message", r.text)[:120]
            return f"  [XX]  {model} -> {r.status_code}: {err}"
    except Exception as e:
        return f"  [EX]  {model} -> EXCEPTION: {e}"

async def main():
    async with httpx.AsyncClient() as client:
        print("\n=== COMPLETION MODELS ===")
        for m in COMPLETION_CANDIDATES:
            result = await test_completion(client, m)
            print(result)

        print("\n=== EMBEDDING MODELS ===")
        for m in EMBEDDING_CANDIDATES:
            result = await test_embedding(client, m)
            print(result)

    print("\nDone.")

asyncio.run(main())
