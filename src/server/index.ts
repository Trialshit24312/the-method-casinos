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
} from '../database/index.js';
import { runDiscovery } from '../discovery/engine.js';
import { cancelDiscoveryRun, isDiscoveryRunning } from '../discovery/run-state.js';
import { runRevalidationBatch } from '../discovery/revalidate.js';
import { requireAuth, requireAdmin, exchangeCode, getDiscordAuthUrl, getAvatarUrl, createOAuthState, verifyOAuthState } from './auth.js';
import type { CasinoFeature, CasinoInput, BlockedSiteInput } from '../shared/types.js';
import { getAllowedCorsOrigins, getDashboardUrl, getDiscordRedirectUri, getOAuthSetupInfo } from '../shared/site.js';
import { applySecurityMiddleware } from './middleware.js';
import { SqliteSessionStore } from './session-store.js';
import { getBotHealth } from '../bot/state.js';
import { registerHttpServer } from '../shared/shutdown.js';
import { askCasinoAssistant, getAiProvider, isAiConfigured } from '../ai/assistant.js';
import { notifySiteReport, notifyCasinoApproved } from '../shared/notify.js';
import { checkCasinoUrl } from '../shared/url-check.js';
import { isSerperEnabled } from '../discovery/serper.js';

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
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
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
        serper: isSerperEnabled(),
        ai: isAiConfigured(),
        aiProvider: getAiProvider(),
        pendingReview: stats.pendingReview,
        openReports: stats.openReports,
        staleCatalog: stats.staleCatalogCasinos,
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

  app.get('/auth/discord', (_req, res) => {
    const state = createOAuthState();
    res.redirect(getDiscordAuthUrl(state));
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${getDashboardUrl()}/login?error=no_code`);
      return;
    }

    if (!state || typeof state !== 'string' || !verifyOAuthState(state)) {
      res.redirect(`${getDashboardUrl()}/login?error=invalid_state`);
      return;
    }

    try {
      const user = await exchangeCode(code);
      req.session.user = user;
      req.session.save((err) => {
        if (err) {
          res.redirect(`${getDashboardUrl()}/login?error=auth_failed`);
          return;
        }
        res.redirect(`${getDashboardUrl()}/dashboard`);
      });
    } catch {
      res.redirect(`${getDashboardUrl()}/login?error=auth_failed`);
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
    res.json({
      available: isAiConfigured(),
      provider: getAiProvider(),
    });
  });

  app.post('/api/ask', async (req, res) => {
    const query = req.body?.query as string | undefined;
    const history = req.body?.history as { role: 'user' | 'assistant'; content: string }[] | undefined;
    if (!query?.trim()) {
      res.status(400).json({ error: 'query required' });
      return;
    }
    try {
      const result = await askCasinoAssistant(query, history);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      const status = message.includes('not configured') ? 503 : 500;
      res.status(status).json({ error: message });
    }
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

  app.get('/api/casinos/:id', (req, res) => {
    const casino = getCasinoById(req.params.id);
    if (!casino) {
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

    try {
      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        await runDiscovery(deep, (event) => {
          res.write(`${JSON.stringify(event)}\n`);
        });
        res.end();
        return;
      }

      const result = await runDiscovery(deep);
      res.json(result);
    } catch (err) {
      if (stream && !res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Discovery failed' });
      } else if (!stream) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Discovery failed' });
      } else {
        res.write(`${JSON.stringify({ type: 'complete', result: { scanned: 0, found: 0, added: 0, skipped: 0, blocked: 0, rejected: 0, durationMs: 0, sourcesChecked: 0, errors: [err instanceof Error ? err.message : 'Discovery failed'], mode: deep ? 'deep' : 'quick', addedCasinos: [] } })}\n`);
        res.end();
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

  app.post('/api/reports/:id/dismiss', requireAuth, requireAdmin, (req, res) => {
    const ok = dismissSiteReport(String(req.params.id));
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
    markSiteReportReviewed(String(req.params.id));
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
