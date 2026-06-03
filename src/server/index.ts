import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import {
  getAllCasinos,
  searchCasinos,
  getCasinoById,
  addCasino,
  updateCasino,
  deleteCasino,
  getStats,
  getAllBlockedSites,
  searchBlockedSites,
  getBlockedSiteById,
  addBlockedSite,
  updateBlockedSite,
  deleteBlockedSite,
  isUrlBlocked,
  getCasinoByUrl,
  findSimilarCasinos,
  findSimilarCasinosByQuery,
  resetCatalogToVerified,
  clearDiscoverySeen,
  getPendingCasinos,
  approveCasino,
  rejectCasino,
  addSiteReport,
  getOpenSiteReports,
  dismissSiteReport,
  markSiteReportReviewed,
  getDiscoveryHistory,
  getDatabase,
  getCatalogHealthIssues,
  unlistCasino,
  getCasinoBySlug,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getClosedSiteReports,
  getFeaturedCasinos,
  getRecentCasinos,
} from '../database/index.js';
import { runDiscovery } from '../discovery/engine.js';
import { cancelDiscoveryRun, isDiscoveryRunning } from '../discovery/run-state.js';
import { runRevalidationBatch, revalidateCasinoById } from '../discovery/revalidate.js';
import { requireAuth, requireAdmin, exchangeCode, getDiscordAuthUrl, getAvatarUrl, createOAuthState, parseOAuthState } from './auth.js';
import type { CasinoFeature, CasinoInput, BlockedSiteInput, DiscoveryResult } from '../shared/types.js';
import { getAllowedCorsOrigins, getDiscordRedirectUri, getOAuthSetupInfo } from '../shared/site.js';
import { applySecurityMiddleware } from './middleware.js';
import { SqliteSessionStore } from './session-store.js';
import { getBotHealth } from '../bot/state.js';
import { registerHttpServer } from '../shared/shutdown.js';
import { notifySiteReport, notifyCasinoApproved } from '../shared/notify.js';
import { checkCasinoUrl } from '../shared/url-check.js';
import { redirectToDashboardPath } from './request-origin.js';
import { discoverSimilarOnWeb } from '../discovery/similar-search.js';
import { compareCasinos } from '../shared/compare.js';

export function createServer(): express.Application {
  const app = express();

  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    app.set('trust proxy', 1);
  }

  const corsOrigins = getAllowedCorsOrigins();
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, origin ?? corsOrigins[0] ?? true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  applySecurityMiddleware(app);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    name: 'method.sid',
    proxy: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
    cookie: {
      secure: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/',
    },
  }));

  app.get('/health', (_req, res) => {
    try {
      getDatabase().prepare('SELECT 1').get();
      const bot = getBotHealth();
      const stats = getStats();
      res.json({
        ok: true,
        db: true,
        bot: bot.connected,
        botTag: bot.tag,
        discoveryRunning: isDiscoveryRunning(),
        searchMode: 'free',
        searchEngines: ['duckduckgo_lite', 'duckduckgo', 'bing', 'brave'],
        pendingReview: stats.pendingReview,
        openReports: stats.openReports,
        staleCatalog: stats.staleCatalogCasinos,
        failedHealth: stats.failedHealthCasinos,
        uptime: process.uptime(),
      });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  // Auth routes
  app.get('/auth/setup', (_req, res) => {
    res.json(getOAuthSetupInfo());
  });

  app.get('/api/oauth-setup', (_req, res) => {
    res.json(getOAuthSetupInfo());
  });

  app.get('/auth/discord', (req, res) => {
    const next = typeof req.query.next === 'string' ? req.query.next : '';
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : undefined;
    if (safeNext) {
      req.session.loginRedirect = safeNext;
    }
    const state = createOAuthState(safeNext);
    req.session.save(() => {
      res.redirect(getDiscordAuthUrl(state));
    });
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${redirectToDashboardPath(req, '/login')}?error=no_code`);
      return;
    }

    if (!state || typeof state !== 'string') {
      res.redirect(`${redirectToDashboardPath(req, '/login')}?error=invalid_state`);
      return;
    }

    const parsed = parseOAuthState(state);
    if (!parsed.valid) {
      res.redirect(`${redirectToDashboardPath(req, '/login')}?error=invalid_state`);
      return;
    }

    try {
      const user = await exchangeCode(code);
      req.session.user = user;
      req.session.save((err) => {
        if (err) {
          res.redirect(`${redirectToDashboardPath(req, '/login')}?error=session_failed`);
          return;
        }
        const fromState = parsed.next;
        const fromSession = req.session.loginRedirect;
        delete req.session.loginRedirect;
        const dest =
          (fromState?.startsWith('/') && !fromState.startsWith('//') ? fromState : null) ||
          (fromSession?.startsWith('/') && !fromSession.startsWith('//') ? fromSession : null) ||
          '/dashboard';
        res.redirect(redirectToDashboardPath(req, dest));
      });
    } catch (err) {
      console.error('Discord OAuth callback failed:', err instanceof Error ? err.message : err);
      res.redirect(`${redirectToDashboardPath(req, '/login')}?error=auth_failed`);
    }
  });

  app.get('/auth/me', (req, res) => {
    if (!req.session.user) {
      res.json({ user: null });
      return;
    }
    res.json({
      user: {
        ...req.session.user,
        avatarUrl: getAvatarUrl(req.session.user),
      },
    });
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // Public API
  app.get('/api/stats', (_req, res) => {
    res.json(getStats());
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({ available: false, provider: 'none', disabled: true });
  });

  app.post('/api/ask', (_req, res) => {
    res.status(410).json({
      error: 'AI assistant is disabled. Use Similar Casinos or Discovery — 100% free web search, no API keys.',
    });
  });

  app.get('/api/casinos', (req, res) => {
    const query = req.query.q as string | undefined;
    const features = req.query.features
      ? (req.query.features as string).split(',') as CasinoFeature[]
      : undefined;
    const includeAll = req.query.all === '1';
    const isAdmin = Boolean(req.session.user?.isAdmin);
    const parsedLimit = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(500, Math.max(1, parsedLimit))
      : 500;

    const filters = {
      query,
      features,
      limit,
      catalogOnly: !includeAll || !isAdmin,
    };

    const casinos = query || features
      ? searchCasinos(filters)
      : (includeAll && isAdmin ? getAllCasinos(false) : getAllCasinos(true));

    res.json(casinos);
  });

  app.get('/api/casinos/pending', requireAuth, requireAdmin, (_req, res) => {
    res.json(getPendingCasinos());
  });

  app.post('/api/casinos/:id/approve', requireAuth, requireAdmin, (req, res) => {
    const approved = approveCasino(String(req.params.id), req.session.user?.username);
    if (!approved) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    void notifyCasinoApproved(approved, req.session.user?.username ?? 'admin');
    res.json(approved);
  });

  app.post('/api/casinos/:id/reject', requireAuth, requireAdmin, (req, res) => {
    const rejected = rejectCasino(String(req.params.id));
    if (!rejected) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/casinos/:id/unlist', requireAuth, requireAdmin, (req, res) => {
    const ok = unlistCasino(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/casinos/:id/revalidate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await revalidateCasinoById(String(req.params.id));
      if (result.reason === 'not found') {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Revalidation failed' });
    }
  });

  app.get('/api/favorites', requireAuth, (req, res) => {
    res.json(getUserFavorites(req.session.user!.id));
  });

  app.post('/api/favorites/:casinoId', requireAuth, (req, res) => {
    const ok = addUserFavorite(req.session.user!.id, String(req.params.casinoId));
    if (!ok) {
      res.status(404).json({ error: 'Casino not found or not in catalog' });
      return;
    }
    res.status(201).json({ ok: true });
  });

  app.delete('/api/favorites/:casinoId', requireAuth, (req, res) => {
    const ok = removeUserFavorite(req.session.user!.id, String(req.params.casinoId));
    if (!ok) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/catalog-health', requireAuth, requireAdmin, (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    res.json(getCatalogHealthIssues(limit));
  });

  app.get('/api/notifications', requireAuth, requireAdmin, (_req, res) => {
    const stats = getStats();
    res.json({
      pendingReview: stats.pendingReview,
      openReports: stats.openReports,
      staleCatalog: stats.staleCatalogCasinos,
      failedHealth: stats.failedHealthCasinos,
      total: stats.pendingReview + stats.openReports + stats.failedHealthCasinos,
    });
  });

  app.get('/api/status', (_req, res) => {
    try {
      const stats = getStats();
      const bot = getBotHealth();
      res.json({
        ok: true,
        searchMode: 'free',
        searchEngines: ['duckduckgo_lite', 'duckduckgo', 'bing', 'brave'],
        bot: bot.connected,
        stats: {
          verifiedCasinos: stats.verifiedCasinos,
          totalCasinos: stats.totalCasinos,
          noPhoneCasinos: stats.noPhoneCasinos,
          blockedSites: stats.blockedSites,
        },
        uptime: process.uptime(),
      });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/api/casinos/featured', (_req, res) => {
    const limit = Math.min(25, Math.max(1, parseInt(String(_req.query.limit ?? '10'), 10) || 10));
    res.json(getFeaturedCasinos(limit));
  });

  app.get('/api/casinos/recent', (_req, res) => {
    const limit = Math.min(25, Math.max(1, parseInt(String(_req.query.limit ?? '10'), 10) || 10));
    res.json(getRecentCasinos(limit));
  });

  app.get('/api/compare', (req, res) => {
    const idA = String(req.query.a ?? req.query.casino_a ?? '');
    const idB = String(req.query.b ?? req.query.casino_b ?? '');
    const casinoA = getCasinoById(idA) ?? getCasinoBySlug(idA);
    const casinoB = getCasinoById(idB) ?? getCasinoBySlug(idB);
    if (!casinoA || !casinoB) {
      res.status(404).json({ error: 'One or both casinos not found' });
      return;
    }
    res.json(compareCasinos(casinoA, casinoB));
  });

  app.get('/api/similar', (req, res) => {
    const casinoId = req.query.casinoId as string | undefined;
    const q = req.query.q as string | undefined;
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit ?? '8'), 10) || 8));

    const result = casinoId
      ? findSimilarCasinos(casinoId, limit)
      : q
        ? findSimilarCasinosByQuery(q, limit)
        : null;

    if (!result) {
      res.status(404).json({ error: 'Casino not found — provide casinoId or q' });
      return;
    }
    res.json(result);
  });

  app.get('/api/casinos/:id/similar', (req, res) => {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit ?? '8'), 10) || 8));
    const result = findSimilarCasinos(String(req.params.id), limit);
    if (!result) {
      res.status(404).json({ error: 'Casino not found' });
      return;
    }
    res.json(result);
  });

  app.post('/api/similar/:id/discover-web', async (req, res) => {
    const casinoId = String(req.params.id);
    const isAdmin = Boolean(req.session.user?.isAdmin);
    try {
      const result = await discoverSimilarOnWeb(casinoId, {
        maxQueries: isAdmin ? 6 : 4,
        maxAnalyze: isAdmin ? 15 : 8,
        searchPages: isAdmin ? 2 : 1,
      });
      if (!result) {
        res.status(404).json({ error: 'Casino not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Web discovery failed' });
    }
  });

  app.get('/api/casinos/:id', (req, res) => {
    const param = String(req.params.id);
    let casino = getCasinoById(param) ?? getCasinoBySlug(param);
    if (!casino) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const isPublic = casino.verified && casino.reviewStatus === 'approved' && casino.active;
    if (!isPublic && !req.session.user?.isAdmin) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(casino);
  });

  // Protected routes
  app.post('/api/casinos', requireAuth, requireAdmin, (req, res) => {
    const input = req.body as CasinoInput;
    if (!input.name || !input.url) {
      res.status(400).json({ error: 'Name and URL required' });
      return;
    }

    const casino = addCasino(input);
    if (!casino) {
      if (isUrlBlocked(input.url)) {
        res.status(403).json({ error: 'This URL is on the blocked/scam list' });
        return;
      }
      res.status(409).json({ error: 'Casino already exists (duplicate URL)' });
      return;
    }
    res.status(201).json(casino);
  });

  app.put('/api/casinos/:id', requireAuth, requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const updated = updateCasino(id, req.body as Partial<CasinoInput>);
    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/casinos/:id', requireAuth, requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const deleted = deleteCasino(id);
    if (!deleted) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/discover/cancel', requireAuth, requireAdmin, (_req, res) => {
    res.json({ cancelled: cancelDiscoveryRun() });
  });

  app.get('/api/discovery/history', requireAuth, requireAdmin, (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '15'), 10) || 15));
    res.json(getDiscoveryHistory(limit));
  });

  app.post('/api/discover', requireAuth, requireAdmin, async (req, res) => {
    req.setTimeout(35 * 60 * 1000);
    res.setTimeout(35 * 60 * 1000);

    const deep = Boolean(req.body?.deep);
    const stream = req.query.stream === '1' || Boolean(req.body?.stream);

    const emptyDiscoveryResult = (errors: string[]): DiscoveryResult => ({
      scanned: 0,
      found: 0,
      added: 0,
      skipped: 0,
      blocked: 0,
      rejected: 0,
      durationMs: 0,
      sourcesChecked: 0,
      errors,
      mode: deep ? 'deep' : 'quick',
      addedCasinos: [],
    });

    try {
      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        let completed = false;
        const writeEvent = (event: { type: string; result?: DiscoveryResult }) => {
          if (res.writableEnded) return;
          try {
            res.write(`${JSON.stringify(event)}\n`);
            (res as typeof res & { flush?: () => void }).flush?.();
          } catch {
            /* client disconnected */
          }
          if (event.type === 'complete') completed = true;
        };

        try {
          await runDiscovery(deep, writeEvent);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Discovery failed';
          if (!completed) {
            writeEvent({ type: 'complete', result: emptyDiscoveryResult([msg]) });
          }
        } finally {
          if (!completed && !res.writableEnded) {
            writeEvent({
              type: 'complete',
              result: emptyDiscoveryResult(['Connection closed before scan finished — partial progress may be lost']),
            });
          }
          if (!res.writableEnded) res.end();
        }
        return;
      }

      const result = await runDiscovery(deep);
      res.json(result);
    } catch (err) {
      if (stream && !res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Discovery failed' });
      } else if (!stream) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Discovery failed' });
      }
    }
  });

  app.post('/api/report', (req, res) => {
    const url = req.body?.url as string | undefined;
    if (!url?.trim()) {
      res.status(400).json({ error: 'URL required' });
      return;
    }
    const report = addSiteReport({
      url: url.trim(),
      reason: req.body?.reason as string | undefined,
      reportedBy: req.session.user?.username ?? 'web',
    });
    void notifySiteReport(report);
    res.status(201).json(report);
  });

  app.get('/api/reports', requireAuth, requireAdmin, (_req, res) => {
    res.json(getOpenSiteReports());
  });

  app.get('/api/reports/history', requireAuth, requireAdmin, (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    res.json(getClosedSiteReports(limit));
  });

  app.post('/api/reports/:id/dismiss', requireAuth, requireAdmin, (req, res) => {
    const ok = dismissSiteReport(String(req.params.id), req.session.user?.username);
    if (!ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/reports/:id/block', requireAuth, requireAdmin, (req, res) => {
    const reports = getOpenSiteReports();
    const report = reports.find((r) => r.id === String(req.params.id));
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    const site = addBlockedSite({
      name: report.url.replace(/^https?:\/\//, '').slice(0, 60),
      url: report.url,
      reason: 'scam',
      severity: 'high',
      description: report.reason,
      reportedBy: report.reportedBy,
      removeCasino: true,
    });
    markSiteReportReviewed(String(req.params.id), req.session.user?.username);
    res.json({ ok: true, blockedSite: site });
  });

  app.get('/api/blocked', (req, res) => {
    const query = req.query.q as string | undefined;
    res.json(query ? searchBlockedSites(query) : getAllBlockedSites());
  });

  app.get('/api/blocked/check', (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: 'URL required' });
      return;
    }
    res.json({ blocked: isUrlBlocked(url) });
  });

  app.get('/api/check', (req, res) => {
    const raw = req.query.url as string;
    if (!raw?.trim()) {
      res.status(400).json({ error: 'URL required' });
      return;
    }
    res.json(checkCasinoUrl(raw));
  });

  app.get('/api/blocked/:id', (req, res) => {
    const site = getBlockedSiteById(String(req.params.id));
    if (!site) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(site);
  });

  app.post('/api/blocked', requireAuth, requireAdmin, (req, res) => {
    const input = req.body as BlockedSiteInput;
    if (!input.name || !input.url || !input.reason) {
      res.status(400).json({ error: 'Name, URL, and reason required' });
      return;
    }
    const site = addBlockedSite(input);
    if (!site) {
      res.status(409).json({ error: 'Site already blocked (duplicate URL)' });
      return;
    }
    res.status(201).json(site);
  });

  app.put('/api/blocked/:id', requireAuth, requireAdmin, (req, res) => {
    const updated = updateBlockedSite(String(req.params.id), req.body as Partial<BlockedSiteInput>);
    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/blocked/:id', requireAuth, requireAdmin, (req, res) => {
    const deleted = deleteBlockedSite(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/reset-catalog', requireAuth, requireAdmin, (req, res) => {
    const preserveBlocklist = req.body?.preserveBlocklist !== false;
    const result = resetCatalogToVerified({ preserveBlocklist });
    res.json(result);
  });

  app.post('/api/admin/clear-discovery-seen', requireAuth, requireAdmin, (_req, res) => {
    const cleared = clearDiscoverySeen();
    res.json({ cleared });
  });

  app.post('/api/admin/revalidate', requireAuth, requireAdmin, async (req, res) => {
    const limit = Math.min(25, Math.max(1, parseInt(String(req.body?.limit ?? '10'), 10) || 10));
    try {
      const result = await runRevalidationBatch(limit);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Revalidation failed' });
    }
  });

  // Serve dashboard in production
  if (process.env.NODE_ENV === 'production') {
    const dashboardDist = path.join(process.cwd(), 'dashboard', 'dist');
    app.use(express.static(dashboardDist));
    // SPA fallback — never intercept /api or /auth
    app.get(/^(?!\/api(?:\/|$)|\/auth(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(dashboardDist, 'index.html'), (err) => {
        if (err) res.status(404).json({ error: 'Not found' });
      });
    });
  }

  return app;
}

export function startServer(): void {
  const port = Number(process.env.PORT) || 3847;
  const app = createServer();
  const server = app.listen(port, () => {
    console.log(`🌐 API + Dashboard server running on http://localhost:${port}`);
    console.log(`🔐 Discord OAuth redirect URI: ${getDiscordRedirectUri()}`);
    console.log(`   Add this exact URL in Discord Developer Portal → OAuth2 → Redirects`);
  });
  registerHttpServer(server);
}
