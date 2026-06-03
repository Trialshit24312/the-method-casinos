import type { Casino, Stats, User, DiscoveryResult, DiscoveryProgressEvent, DiscoveryLiveSnapshot, DiscoveryLiveStats, BlockedSite, BlockReason, BlockSeverity, UrlCheckResult, SimilarCasinosResult, SimilarWebDiscoveryResult, SiteReport, DiscoveryHistoryEntry, CasinoCompareResult } from './types';

import { apiBaseUrl } from './lib/site';

const API = apiBaseUrl();

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, options?: RequestInit, attempt = 0): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (RETRYABLE_STATUS.has(res.status) && attempt < 4) {
      await sleep(1200 * (attempt + 1));
      return request<T>(path, options, attempt + 1);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }

    return res.json();
  } catch (err) {
    if (attempt < 4 && err instanceof TypeError) {
      await sleep(1200 * (attempt + 1));
      return request<T>(path, options, attempt + 1);
    }
    throw err;
  }
}

export const api = {
  getMe: () => request<{ user: User | null }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  getStats: () => request<Stats>('/api/stats'),
  getPublicFeed: (limit = 12) =>
    request<{ type: 'approval' | 'discovery'; at: string; title: string; detail: string; casinoId?: string; casinoSlug?: string }[]>(
      `/api/feed?limit=${limit}`,
    ),
  getOAuthSetup: () =>
    request<{ redirectUri: string; discordPortalHint: string; loginUrl: string; hostedUrl: string | null }>(
      '/api/oauth-setup',
    ),
  getStatus: () => request<{ ok: boolean; searchMode: string; searchEngines: string[]; bot: boolean; stats: Pick<Stats, 'verifiedCasinos' | 'totalCasinos' | 'noPhoneCasinos' | 'blockedSites'>; uptime: number }>('/api/status'),
  getFeaturedCasinos: (limit = 10) => request<Casino[]>(`/api/casinos/featured?limit=${limit}`),
  getRecentCasinos: (limit = 10) => request<Casino[]>(`/api/casinos/recent?limit=${limit}`),
  compareCasinos: (a: string, b: string) => request<CasinoCompareResult>(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
  getCasinos: (q?: string, all?: boolean, features?: string, noPhone?: boolean) => {
    const params = new URLSearchParams();
    if (all) params.set('all', '1');
    if (q) params.set('q', q);
    if (features) params.set('features', features);
    if (noPhone) params.set('no_phone', '1');
    const qs = params.toString();
    return request<Casino[]>(qs ? `/api/casinos?${qs}` : '/api/casinos');
  },
  getRandomCasino: (opts?: { noPhone?: boolean; vpn?: boolean; features?: string[] }) => {
    const params = new URLSearchParams();
    if (opts?.noPhone) params.set('no_phone', '1');
    if (opts?.vpn) params.set('vpn', '1');
    if (opts?.features?.length) params.set('features', opts.features.join(','));
    const qs = params.toString();
    return request<Casino>(qs ? `/api/casinos/random?${qs}` : '/api/casinos/random');
  },
  getHealth: () =>
    request<{
      ok: boolean;
      db: boolean;
      bot: boolean;
      botTag: string | null;
      discoveryRunning: boolean;
      pendingReview: number;
      openReports: number;
      staleCatalog: number;
      failedHealth: number;
      uptime: number;
      searchEngines: string[];
    }>('/health'),
  updateBlockedSite: (id: string, data: Partial<{
    name: string;
    url: string;
    reason: BlockReason;
    severity: BlockSeverity;
    description: string;
  }>) =>
    request<BlockedSite>(`/api/blocked/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCasino: (id: string) => request<Casino>(`/api/casinos/${id}`),
  getSimilar: (opts: { casinoId?: string; q?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts.casinoId) params.set('casinoId', opts.casinoId);
    if (opts.q) params.set('q', opts.q);
    if (opts.limit) params.set('limit', String(opts.limit));
    return request<SimilarCasinosResult>(`/api/similar?${params}`);
  },
  getSimilarWebQueries: (casinoId: string) =>
    request<{ source: Casino; queries: string[] }>(`/api/similar/${casinoId}/web-queries`),
  discoverSimilarWeb: async (casinoId: string) => {
    const { queries } = await request<{ source: Casino; queries: string[] }>(
      `/api/similar/${casinoId}/web-queries`,
    );
    const { collectBrowserSearchLinks } = await import('./lib/browser-search');
    const browserResults: { query: string; links: string[] }[] = [];
    for (const query of queries) {
      const hits = await collectBrowserSearchLinks(query, 2);
      for (const hit of hits) {
        browserResults.push({ query: hit.query, links: hit.links });
      }
    }
    return request<SimilarWebDiscoveryResult>(`/api/similar/${casinoId}/discover-web`, {
      method: 'POST',
      body: JSON.stringify({ browserResults }),
    });
  },
  approveAllPending: (limit = 50) =>
    request<{ ok: boolean; approved: number; ids: string[]; remaining: number }>(
      '/api/casinos/pending/approve-all',
      { method: 'POST', body: JSON.stringify({ limit }) },
    ),
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
    options?: { resume?: boolean },
  ): Promise<DiscoveryResult> => {
    if (options?.resume) {
      await request<{ resumed: boolean }>('/api/discover/client/resume', {
        method: 'POST',
        signal,
      });
    } else {
      await request<{ started: boolean }>('/api/discover/client/start', {
        method: 'POST',
        body: JSON.stringify({ deep }),
        signal,
      });
    }

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
        clientSearch?: { queries: string[]; searchPages: number };
        browserValidate?: string[];
        browserCrawl?: string[];
        live: DiscoveryLiveSnapshot;
      };
      try {
        step = await request<{
          done: boolean;
          result?: DiscoveryResult;
          cancelled?: boolean;
          clientSearch?: { queries: string[]; searchPages: number };
          browserValidate?: string[];
          browserCrawl?: string[];
          live: DiscoveryLiveSnapshot;
        }>('/api/discover/client/step', {
          method: 'POST',
          body: JSON.stringify({ since: cursor }),
          signal,
        });
      } finally {
        stepping = false;
      }

      if (step.clientSearch?.queries?.length) {
        const { collectBrowserSearchLinks } = await import('./lib/browser-search');
        const allResults: { query: string; engine: string; links: string[] }[] = [];
        for (const query of step.clientSearch.queries) {
          const hits = await collectBrowserSearchLinks(
            query,
            step.clientSearch.searchPages,
            (engine, linkCount) => {
              onEvent({ type: 'search_engine', engine: engine as 'ddg_instant', query, linkCount });
            },
          );
          for (const hit of hits) {
            allResults.push({ query: hit.query, engine: hit.engine, links: hit.links });
          }
        }
        const serpRes = await request<{ ok: boolean; queued: number; live: DiscoveryLiveSnapshot }>(
          '/api/discover/client/serp-links',
          {
            method: 'POST',
            body: JSON.stringify({ results: allResults }),
            signal,
          },
        );
        for (const raw of serpRes.live.events) {
          const { seq, ...event } = raw;
          onEvent(event as DiscoveryProgressEvent);
          cursor = seq + 1;
        }
        if (serpRes.live.stats) {
          onEvent({ type: 'progress', stats: serpRes.live.stats });
        }
        continue;
      }

      if (step.browserValidate?.length) {
        const { fetchPagesInBrowser } = await import('./lib/browser-fetch-page');
        const pages = await fetchPagesInBrowser(step.browserValidate);
        if (pages.length) {
          const valRes = await request<{ ok: boolean; added: number; live: DiscoveryLiveSnapshot }>(
            '/api/discover/client/validate-pages',
            { method: 'POST', body: JSON.stringify({ pages }), signal },
          );
          for (const raw of valRes.live.events) {
            const { seq, ...event } = raw;
            onEvent(event as DiscoveryProgressEvent);
            cursor = seq + 1;
          }
          if (valRes.live.stats) {
            onEvent({ type: 'progress', stats: valRes.live.stats });
          }
        }
        continue;
      }

      if (step.browserCrawl?.length) {
        const { fetchPagesInBrowser } = await import('./lib/browser-fetch-page');
        const pages = await fetchPagesInBrowser(step.browserCrawl);
        if (pages.length) {
          const crawlRes = await request<{ ok: boolean; linksQueued: number; live: DiscoveryLiveSnapshot }>(
            '/api/discover/client/crawl-pages',
            { method: 'POST', body: JSON.stringify({ pages }), signal },
          );
          for (const raw of crawlRes.live.events) {
            const { seq, ...event } = raw;
            onEvent(event as DiscoveryProgressEvent);
            cursor = seq + 1;
          }
          if (crawlRes.live.stats) {
            onEvent({ type: 'progress', stats: crawlRes.live.stats });
          }
        }
        continue;
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
  submitDiscoveryUrls: (urls: string[], duringScan = false) =>
    duringScan
      ? request<{ ok: boolean; queued: number }>('/api/discover/client/manual-links', {
          method: 'POST',
          body: JSON.stringify({ urls }),
        })
      : request<{ ok: boolean; queued: number; pending: number }>('/api/discover/quick-add', {
          method: 'POST',
          body: JSON.stringify({ urls }),
        }),
  promoteReportToDiscovery: (reportId: string) =>
    request<{ ok: boolean; casino: { name: string; url: string } }>(`/api/reports/${reportId}/promote`, {
      method: 'POST',
    }),
  getDiscoveryClientStatus: () =>
    request<{
      resumable: boolean;
      paused: boolean;
      mode: 'quick' | 'deep' | null;
      phase?: string;
      phaseLabel?: string;
      stats: DiscoveryLiveStats | null;
    }>('/api/discover/client/status'),
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
  getNewArrivals: (limit = 24) =>
    request<Casino[]>(`/api/casinos/new-arrivals?limit=${limit}`),
  getAdminInsights: () =>
    request<{
      pendingCount: number;
      openReports: number;
      pendingBySource: { source: string; count: number }[];
      discoveryLast7d: { runs: number; added: number; rejected: number };
      recentRuns: DiscoveryHistoryEntry[];
      catalogGrowth30d: number;
    }>('/api/admin/insights'),
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
  getFavorites: () =>
    request<{ casino: Casino; note: string | null }[]>('/api/favorites'),
  setFavoriteNote: (casinoId: string, note: string) =>
    request<{ ok: boolean }>(`/api/favorites/${casinoId}/note`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
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
