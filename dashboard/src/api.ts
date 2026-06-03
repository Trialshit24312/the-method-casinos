import type { Casino, Stats, User, DiscoveryResult, DiscoveryProgressEvent, DiscoveryLiveSnapshot, BlockedSite, BlockReason, BlockSeverity, UrlCheckResult, SimilarCasinosResult, SimilarWebDiscoveryResult, SiteReport, DiscoveryHistoryEntry, CasinoCompareResult } from './types';

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
  getStatus: () => request<{ ok: boolean; searchMode: string; searchEngines: string[]; bot: boolean; stats: Pick<Stats, 'verifiedCasinos' | 'totalCasinos' | 'noPhoneCasinos' | 'blockedSites'>; uptime: number }>('/api/status'),
  getFeaturedCasinos: (limit = 10) => request<Casino[]>(`/api/casinos/featured?limit=${limit}`),
  getRecentCasinos: (limit = 10) => request<Casino[]>(`/api/casinos/recent?limit=${limit}`),
  compareCasinos: (a: string, b: string) => request<CasinoCompareResult>(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
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
  discoverSimilarWeb: (casinoId: string) =>
    request<SimilarWebDiscoveryResult>(`/api/similar/${casinoId}/discover-web`, { method: 'POST' }),
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
    await request<{ started: boolean }>('/api/discover/client/start', {
      method: 'POST',
      body: JSON.stringify({ deep }),
      signal,
    });

    let cursor = 0;
    let stepping = false;

    while (true) {
      if (signal?.aborted) {
        await fetch(`${API}/api/discover/cancel`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {});
        throw new DOMException('Aborted', 'AbortError');
      }

      if (stepping) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      stepping = true;
      let step: {
        done: boolean;
        result?: DiscoveryResult;
        cancelled?: boolean;
        live: DiscoveryLiveSnapshot;
      };
      try {
        step = await request<{
          done: boolean;
          result?: DiscoveryResult;
          cancelled?: boolean;
          live: DiscoveryLiveSnapshot;
        }>('/api/discover/client/step', {
          method: 'POST',
          body: JSON.stringify({ since: cursor }),
          signal,
        });
      } finally {
        stepping = false;
      }

      for (const raw of step.live.events) {
        const { seq, ...event } = raw;
        onEvent(event as DiscoveryProgressEvent);
        cursor = seq + 1;
      }

      if (step.live.stats) {
        onEvent({ type: 'progress', stats: step.live.stats });
      }

      if (step.cancelled) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (step.done && step.result) return step.result;

      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  },
  getDiscoveryLive: (since = 0) =>
    request<DiscoveryLiveSnapshot>(`/api/discover/live?since=${since}`),
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
    // Same-origin relative URL — works with Vite proxy locally and unified Render host in prod
    return `/auth/discord${q}`;
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
