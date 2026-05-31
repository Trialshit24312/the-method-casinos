"""
The Method Casinos — free AI assistant (Gemini or Groq + LangSmith tracing).

Usage:
  pip install -r agents/requirements.txt
  # Add GEMINI_API_KEY or GROQ_API_KEY to .env
  python agents/casino_agent.py
  python agents/casino_agent.py "Which verified casinos have no phone signup?"
"""

from __future__ import annotations

import sys
from pathlib import Path

_AGENTS_DIR = Path(__file__).resolve().parent
if str(_AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(_AGENTS_DIR))

from env_loader import load_dotenv

load_dotenv()

import os

from free_llm import FreeLlmError, active_provider, chat, fetch_json
from langsmith import traceable

SYSTEM_PROMPT = """You are The Method Casinos research assistant.
You help users find legitimate US sweepstakes casinos with email-only signup (no phone).
Only recommend casinos from the VERIFIED CATALOG data provided below.
Never invent casino names or URLs. If unsure, say so.
Warn users to use /check or the dashboard URL checker for unknown sites.
Be concise and practical."""


@traceable(name="load_catalog_context")
def load_catalog_context() -> str:
    base = os.getenv("API_URL", "http://localhost:3847").rstrip("/")
    stats = fetch_json(f"{base}/api/stats")
    casinos = fetch_json(f"{base}/api/casinos")

    lines = [
        f"Verified catalog: {stats.get('verifiedCasinos', '?')} casinos",
        f"No-phone signup: {stats.get('noPhoneCasinos', '?')}",
        f"Email-only: {stats.get('emailOnlyCasinos', '?')}",
        f"Blocked scam URLs: {stats.get('blockedSites', '?')}",
        "",
        "Sample verified operators:",
    ]
    for c in casinos[:25]:
        name = c.get("name", "?")
        url = c.get("url", "?")
        feats = ", ".join((c.get("features") or [])[:6])
        lines.append(f"- {name} ({url}) — {feats}")
    if len(casinos) > 25:
        lines.append(f"... and {len(casinos) - 25} more in catalog")
    return "\n".join(lines)


@traceable(name="casino_agent_run")
def run(user_query: str) -> str:
    context = load_catalog_context()
    system = f"{SYSTEM_PROMPT}\n\n--- LIVE CATALOG DATA ---\n{context}"
    return chat([{"role": "user", "content": user_query}], system=system)


def main() -> None:
    query = " ".join(sys.argv[1:]).strip() or (
        "List 5 verified sweepstakes casinos that do not require a phone number "
        "and briefly explain why they are good for email-only signup."
    )

    provider = active_provider()
    print(f"Provider: {provider or 'none — set GEMINI_API_KEY or GROQ_API_KEY'}")
    print(f"Query: {query}\n")

    if not provider:
        print(
            "Get a free key (no credit card):\n"
            "  Gemini → https://aistudio.google.com/apikey\n"
            "  Groq   → https://console.groq.com/keys",
            file=sys.stderr,
        )
        raise SystemExit(1)

    try:
        answer = run(query)
        print(answer)
    except FreeLlmError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
