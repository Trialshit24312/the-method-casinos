import { buildCatalogContext } from './catalog-context.js';
import { getCasinoByUrl, isUrlBlocked } from '../database/index.js';
import { casinoHostKey, ensureHttps } from '../shared/utils.js';

const SYSTEM_BASE = `You are The Method Casinos AI assistant.
Help users find legitimate US sweepstakes casinos with email-only signup when possible.
ONLY recommend casinos listed in the LIVE CATALOG DATA below.
Never invent casino names or URLs. If data is missing, say so.
Warn users to use the URL checker or /check for unknown sites.
Be concise, practical, and accurate.`;

export type AiProvider = 'groq' | 'gemini' | 'none';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const MAX_HISTORY = 6;

export function getAiProvider(): AiProvider {
  if (process.env.GROQ_API_KEY?.trim()) return 'groq';
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) return 'gemini';
  return 'none';
}

export function isAiConfigured(): boolean {
  return getAiProvider() !== 'none';
}

function trimHistory(history: ChatTurn[] | undefined): ChatTurn[] {
  if (!history?.length) return [];
  return history
    .filter((m) => m.content.trim() && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_HISTORY);
}

async function chatGroq(system: string, query: string, history: ChatTurn[]): Promise<string> {
  const key = process.env.GROQ_API_KEY!.trim();
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: query },
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || 'No response from model.';
}

async function chatGemini(system: string, query: string, history: ChatTurn[]): Promise<string> {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!.trim();
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const historyText = history.length
    ? history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
    : '';
  const prompt = [system, historyText, `User:\n${query}`].filter(Boolean).join('\n\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() || 'No response from model.';
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]>]+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, '')))];
}

function appendGroundingNotice(answer: string): string {
  const urls = extractUrls(answer);
  if (!urls.length) return answer;

  const unknown: string[] = [];
  for (const raw of urls) {
    try {
      const url = ensureHttps(raw);
      if (isUrlBlocked(url)) continue;
      const casino = getCasinoByUrl(url);
      if (!casino || casino.reviewStatus !== 'approved' || !casino.verified) {
        unknown.push(casinoHostKey(url));
      }
    } catch {
      unknown.push(raw);
    }
  }

  if (!unknown.length) return answer;
  const note = `\n\n⚠️ Note: Some URLs mentioned (${unknown.slice(0, 3).join(', ')}) are not in the verified catalog. Use /check before signing up.`;
  return answer + note;
}

export async function askCasinoAssistant(
  query: string,
  history?: ChatTurn[],
): Promise<{ answer: string; provider: AiProvider }> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Question is required');
  if (trimmed.length > 2000) throw new Error('Question too long (max 2000 chars)');

  const provider = getAiProvider();
  if (provider === 'none') {
    throw new Error(
      'AI not configured. Set GROQ_API_KEY (free) or GEMINI_API_KEY on the server.',
    );
  }

  const prior = trimHistory(history);
  const context = buildCatalogContext();
  const system = `${SYSTEM_BASE}\n\n--- LIVE CATALOG DATA ---\n${context}`;

  const rawAnswer = provider === 'groq'
    ? await chatGroq(system, trimmed, prior)
    : await chatGemini(system, trimmed, prior);

  const answer = appendGroundingNotice(rawAnswer);

  return { answer, provider };
}
