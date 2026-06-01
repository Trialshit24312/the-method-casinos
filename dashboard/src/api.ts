import type { Casino, Stats, User, DiscoveryResult, DiscoveryProgressEvent, DiscoveryLiveStats, BlockedSite, BlockReason, BlockSeverity, UrlCheckResult, SimilarCasinosResult, SiteReport, DiscoveryHistoryEntry } from './types';

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
  getCasinos: (q?: string, all?: boolean) =>
    request<Casino[]>(
      all ? `/api/casinos?all=1${q ? `&q=${encodeURIComponent(q)}` : ''}` : (q ? `/api/casinos?q=${encodeURIComponent(q)}` : '/api/casinos'),
    ),
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
      signal,
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
    const streamState = { lastProgress: null as DiscoveryLiveStats | null };

    const parseLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line) as DiscoveryProgressEvent;
        if (event.type === 'heartbeat') return;
        if (event.type === 'progress') streamState.lastProgress = event.stats;
        onEvent(event);
        if (event.type === 'complete') finalResult = event.result;
      } catch {
        /* skip malformed chunk */
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) parseLine(line);
    }

    if (buffer.trim()) parseLine(buffer);

    if (finalResult) return finalResult;

    const partial = streamState.lastProgress;
    if (partial) {
      return {
        scanned: partial.scanned,
        found: partial.added + partial.rejected + partial.skipped,
        added: partial.added,
        skipped: partial.skipped,
        blocked: partial.blocked,
        rejected: partial.rejected,
        durationMs: 0,
        sourcesChecked: partial.sourcesChecked,
        errors: ['Connection closed before final summary — showing partial results'],
        mode: deep ? 'deep' : 'quick',
        addedCasinos: [],
      };
    }

    throw new Error('Discovery stream ended without result — try again or use Quick Scan');
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
  loginUrl: (next?: string) => {
    const q = next?.startsWith('/') ? `?next=${encodeURIComponent(next)}` : '';
    return `${API}/auth/discord${q}`;
  },
  cancelDiscovery: () =>
    request<{ cancelled: boolean }>('/api/discover/cancel', { method: 'POST' }),
  getPendingCasinos: () => request<Casino[]>('/api/casinos/pending'),
  approveCasino: (id: string) =>
    request<Casino>(`/api/casinos/${id}/approve`, { method: 'POST' }),
  rejectCasino: (id: string) =>
    request<{ ok: boolean }>(`/api/casinos/${id}/reject`, { method: 'POST' }),
  resetCatalog: (preserveBlocklist = true) =>
    request<{ casinosRemoved: number; blockedRemoved: number; casinosAdded: number }>(
      '/api/admin/reset-catalog',
      { method: 'POST', body: JSON.stringify({ preserveBlocklist }) },
    ),
  clearDiscoverySeen: () =>
    request<{ cleared: number }>('/api/admin/clear-discovery-seen', { method: 'POST' }),
  reportUrl: (url: string, reason?: string) =>
    request<{ id: string }>('/api/report', { method: 'POST', body: JSON.stringify({ url, reason }) }),
  getReports: () => request<SiteReport[]>('/api/reports'),
  dismissReport: (id: string) =>
    request<{ ok: boolean }>(`/api/reports/${id}/dismiss`, { method: 'POST' }),
  blockFromReport: (id: string) =>
    request<{ ok: boolean }>(`/api/reports/${id}/block`, { method: 'POST' }),
  getAiStatus: () => request<{ available: boolean; provider: string }>('/api/ai/status'),
  askAi: (query: string, history?: { role: 'user' | 'assistant'; content: string }[]) =>
    request<{ answer: string; provider: string }>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ query, history }),
    }),
  getDiscoveryHistory: (limit = 15) =>
    request<DiscoveryHistoryEntry[]>(`/api/discovery/history?limit=${limit}`),
  revalidateCatalog: (limit = 10) =>
    request<{ checked: number; passed: number; failed: number }>('/api/admin/revalidate', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    }),
  getCatalogHealth: () => request<Casino[]>('/api/admin/catalog-health'),
  revalidateCasino: (id: string) =>
    request<{ id: string; ok: boolean; reason?: string }>(`/api/casinos/${id}/revalidate`, { method: 'POST' }),
  unlistCasino: (id: string) =>
    request<{ ok: boolean }>(`/api/casinos/${id}/unlist`, { method: 'POST' }),
  getFavorites: () => request<Casino[]>('/api/favorites'),
  addFavorite: (casinoId: string) =>
    request<{ ok: boolean }>(`/api/favorites/${casinoId}`, { method: 'POST' }),
  removeFavorite: (casinoId: string) =>
    request<{ ok: boolean }>(`/api/favorites/${casinoId}`, { method: 'DELETE' }),
  getReportHistory: (limit = 50) =>
    request<SiteReport[]>(`/api/reports/history?limit=${limit}`),
  getNotifications: () =>
    request<{ pendingReview: number; openReports: number; staleCatalog: number; failedHealth: number; total: number }>(
      '/api/notifications',
    ),
};
