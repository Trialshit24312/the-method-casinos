"""
Free LLM providers — no Anthropic billing required.

Priority: GEMINI_API_KEY (Google AI Studio) → GROQ_API_KEY (Groq console).
Both offer free tiers without a credit card.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from langsmith import traceable

Message = dict[str, str]


class FreeLlmError(RuntimeError):
    pass


def active_provider() -> str | None:
    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        return "gemini"
    if os.getenv("GROQ_API_KEY"):
        return "groq"
    return None


def _gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise FreeLlmError("Set GEMINI_API_KEY — free at https://aistudio.google.com/apikey")
    return key


@traceable(name="gemini_chat")
def _chat_gemini(messages: list[Message], system: str) -> str:
    try:
        from google import genai
    except ImportError as exc:
        raise FreeLlmError("pip install google-genai") from exc

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    client = genai.Client(api_key=_gemini_key())

    parts: list[str] = []
    if system:
        parts.append(f"System:\n{system}\n")
    for msg in messages:
        role = msg.get("role", "user")
        parts.append(f"{role.capitalize()}:\n{msg.get('content', '')}\n")

    prompt = "\n".join(parts)
    response = client.models.generate_content(model=model, contents=prompt)
    text = getattr(response, "text", None) or str(response)
    return text.strip()


@traceable(name="groq_chat")
def _chat_groq(messages: list[Message], system: str) -> str:
    try:
        from groq import Groq
    except ImportError as exc:
        raise FreeLlmError("pip install groq") from exc

    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise FreeLlmError("Set GROQ_API_KEY — free at https://console.groq.com/keys")

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    client = Groq(api_key=key)

    groq_messages: list[dict[str, str]] = []
    if system:
        groq_messages.append({"role": "system", "content": system})
    groq_messages.extend(messages)

    completion = client.chat.completions.create(
        model=model,
        messages=groq_messages,
        temperature=0.3,
        max_tokens=2048,
    )
    return (completion.choices[0].message.content or "").strip()


@traceable(name="free_llm_chat")
def chat(messages: list[Message], system: str = "") -> str:
    provider = active_provider()
    if provider == "gemini":
        return _chat_gemini(messages, system)
    if provider == "groq":
        return _chat_groq(messages, system)
    raise FreeLlmError(
        "No free LLM configured. Add ONE of these to .env (no credit card):\n"
        "  GEMINI_API_KEY  → https://aistudio.google.com/apikey\n"
        "  GROQ_API_KEY    → https://console.groq.com/keys"
    )


@traceable(name="fetch_json")
def fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode())
    except urllib.error.URLError as exc:
        raise FreeLlmError(f"Could not fetch {url}: {exc}") from exc
