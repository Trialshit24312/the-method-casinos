import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
}

const STARTERS = [
  'Best no-phone verified casinos?',
  'Which casinos allow VPN?',
  'Compare Chumba and Pulsz for email signup',
  'Top rated slots casinos in the catalog',
];

import { usePageTitle } from '../hooks/usePageTitle';

export default function AssistantPage() {
  usePageTitle('AI Assistant — The Method Casinos');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAiStatus().then((s) => setAvailable(s.available)).catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const { answer, provider } = await api.askAi(q, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, provider }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
      <PageHeader
        icon={<Bot className="w-6 h-6 text-glow" />}
        title="Casino AI Assistant"
        subtitle="Free AI powered by your verified catalog — Groq or Gemini. Answers only from real database entries."
      />

      {available === false && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
          AI is not configured on the server yet. Admin: add <code className="text-glow">GROQ_API_KEY</code> to Render env.
        </div>
      )}

      <div className="flex-1 glass-glow p-4 mb-4 overflow-y-auto max-h-[55vh] space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-glow opacity-60" />
            <p className="text-sm mb-4">Ask about verified sweepstakes casinos, features, or signup requirements.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-surface-border hover:border-glow/40 hover:text-glow transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-glow/15 border border-glow/30 text-white'
                  : 'bg-surface-overlay border border-surface-border text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.provider && (
                <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-wide">via {m.provider}</p>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-accent-red text-sm mb-2">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="input-field flex-1"
          placeholder="Ask about verified casinos…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          maxLength={2000}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-glow px-4 disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
