# AI agents (free — no billing)

Python helpers with **LangSmith tracing**. Uses **free** LLM APIs only — no Anthropic credits.

## Pick one provider (free, no credit card)

| Provider | Env var | Get key |
|----------|---------|---------|
| **Google Gemini** (recommended) | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq** (Llama 3.3) | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |

Add to repo root `.env`:

```env
GEMINI_API_KEY=your_key_here
# OR
GROQ_API_KEY=your_key_here

LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=The Method Casinos
```

Optional model overrides:

```env
GEMINI_MODEL=gemini-2.0-flash
GROQ_MODEL=llama-3.3-70b-versatile
```

## Install

```powershell
pip install -r agents/requirements.txt
```

## Run casino assistant

Uses your live catalog from `API_URL` (production or `http://localhost:3847`):

```powershell
python agents/casino_agent.py
python agents/casino_agent.py "Best VPN-friendly verified casinos?"
```

Traces: [smith.langchain.com](https://smith.langchain.com) → **The Method Casinos**

## Notes

- `ANTHROPIC_API_KEY` is **not** required.
- Start the Node API locally (`npm run dev`) if you want fresh local catalog data; otherwise it reads from `API_URL` in `.env` (Render production by default).
