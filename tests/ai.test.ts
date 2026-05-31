import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAiProvider, isAiConfigured } from '../src/ai/assistant.js';

describe('AI provider config', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...orig };
  });

  it('prefers Groq when GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'test-key';
    expect(getAiProvider()).toBe('groq');
    expect(isAiConfigured()).toBe(true);
  });

  it('falls back to Gemini when only Gemini key is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(getAiProvider()).toBe('gemini');
    expect(isAiConfigured()).toBe(true);
  });

  it('returns none when no keys configured', () => {
    expect(getAiProvider()).toBe('none');
    expect(isAiConfigured()).toBe(false);
  });
});
