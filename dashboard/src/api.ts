import type { Casino, Stats, User, DiscoveryResult, DiscoveryProgressEvent, BlockedSite, BlockReason, BlockSeverity, UrlCheckResult, SimilarCasinosResult } from './types';

import { apiBaseUrl } from './lib/site';

const API = apiBaseUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  getMe: () => request<{ user: User | null }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  getStats: () => request<Stats>('/api/stats'),
  getCasinos: (q?: string) =>
    request<Casino[]>(q ? `/api/casinos?q=${encodeURIComponent(q)}` : '/api/casinos'),
  getCasino: (id: string) => request<Casino>(`/api/casinos/${id}`),
  getSimilar: (opts: { casinoId?: string; q?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts.casinoId) params.set('casinoId', opts.casinoId);
    if (opts.q) params.set('q', opts.q);
    if (opts.limit) params.set('limit', String(opts.limit));
    return request<SimilarCasinosResult>(`/api/similar?${params}`);
  },
  addCasino: (data: Partial<Casino>) =>
    request<Casino>('/api/casinos', { method: 'POST', body: JSON.stringify(data) }),
  updateCasino: (id: string, data: Partial<Casino>) =>
    request<Casino>(`/api/casinos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCasino: (id: string) =>
    request<{ ok: boolean }>(`/api/casinos/${id}`, { method: 'DELETE' }),
  discover: (deep = false) =>
    request<DiscoveryResult>('/api/discover', {
      method: 'POST',
      body: JSON.stringify({ deep }),
      signal: AbortSignal.timeout(deep ? 32 * 60 * 1000 : 10 * 60 * 1000),
    }),
  discoverStream: async (
    deep: boolean,
    onEvent: (event: DiscoveryProgressEvent) => void,
    signal?: AbortSignal,
  ): Promise<DiscoveryResult> => {
    const res = await fetch(`${API}/api/discover?stream=1`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deep, stream: true }),
      signal: signal ?? AbortSignal.timeout(deep ? 32 * 60 * 1000 : 10 * 60 * 1000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Discovery failed');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: DiscoveryResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as DiscoveryProgressEvent;
        onEvent(event);
        if (event.type === 'complete') finalResult = event.result;
      }
    }

    if (buffer.trim()) {
      const event = JSON.parse(buffer) as DiscoveryProgressEvent;
      onEvent(event);
      if (event.type === 'complete') finalResult = event.result;
    }

    if (!finalResult) throw new Error('Discovery stream ended without result');
    return finalResult;
  },
  getBlockedSites: (q?: string) =>
    request<BlockedSite[]>(q ? `/api/blocked?q=${encodeURIComponent(q)}` : '/api/blocked'),
  checkUrl: (url: string) =>
    request<UrlCheckResult>(`/api/check?url=${encodeURIComponent(url)}`),
  checkBlocked: (url: string) =>
    request<{ blocked: boolean }>(`/api/blocked/check?url=${encodeURIComponent(url)}`),
  addBlockedSite: (data: {
    name: string;
    url: string;
    reason: BlockReason;
    severity?: BlockSeverity;
    description?: string;
    removeCasino?: boolean;
  }) => request<BlockedSite>('/api/blocked', { method: 'POST', body: JSON.stringify(data) }),
  deleteBlockedSite: (id: string) =>
    request<{ ok: boolean }>(`/api/blocked/${id}`, { method: 'DELETE' }),
  loginUrl: () => `${API}/auth/discord`,
};
