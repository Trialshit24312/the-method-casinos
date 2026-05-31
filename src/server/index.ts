import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { randomBytes } from 'crypto';
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
  getBlockedSiteByUrl,
  findSimilarCasinos,
  findSimilarCasinosByQuery,
  resetCatalogToVerified,
} from '../database/index.js';
import { runDiscovery } from '../discovery/engine.js';
import { requireAuth, requireAdmin, exchangeCode, getDiscordAuthUrl, getAvatarUrl } from './auth.js';
import type { CasinoFeature, CasinoInput, BlockedSiteInput, UrlCheckResult } from '../shared/types.js';
import { ensureHttps } from '../shared/utils.js';
import { getAllowedCorsOrigins, getDashboardUrl, getDiscordRedirectUri, getApiUrl } from '../shared/site.js';

export function createServer(): express.Application {
  const app = express();

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
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));

  // Auth routes
  app.get('/auth/setup', (_req, res) => {
    const redirectUri = getDiscordRedirectUri();
    res.json({
      redirectUri,
      discordPortalHint:
        'Discord Developer Portal → your app → OAuth2 → Redirects → add this exact URL (not just the site root)',
      loginUrl: `${getApiUrl()}/auth/discord`,
    });
  });

  app.get('/auth/discord', (_req, res) => {
    const state = randomBytes(16).toString('hex');
    _req.session.oauthState = state;
    res.redirect(getDiscordAuthUrl(state));
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${getDashboardUrl()}/login?error=no_code`);
      return;
    }

    if (state !== req.session.oauthState) {
      res.redirect(`${getDashboardUrl()}/login?error=invalid_state`);
      return;
    }

    try {
      const user = await exchangeCode(code);
      req.session.user = user;
      delete req.session.oauthState;
      res.redirect(getDashboardUrl());
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

  app.get('/api/casinos', (req, res) => {
    const query = req.query.q as string | undefined;
    const features = req.query.features
      ? (req.query.features as string).split(',') as CasinoFeature[]
      : undefined;

    const casinos = query || features
      ? searchCasinos({ query, features, limit: 100 })
      : getAllCasinos();

    res.json(casinos);
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

  app.post('/api/discover', requireAuth, requireAdmin, async (req, res) => {
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);

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
        res.write(`${JSON.stringify({ type: 'complete', result: { scanned: 0, found: 0, added: 0, skipped: 0, blocked: 0, rejected: 0, durationMs: 0, sourcesChecked: 0, errors: [err instanceof Error ? err.message : 'Discovery failed'] } })}\n`);
        res.end();
      }
    }
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
    const url = ensureHttps(raw.trim());
    const blockedSite = getBlockedSiteByUrl(url);
    const casino = getCasinoByUrl(url);
    const blocked = Boolean(blockedSite) || isUrlBlocked(url);
    const result: UrlCheckResult = {
      url,
      blocked,
      blockedSite,
      casino,
      safe: !blocked && Boolean(casino?.verified),
    };
    res.json(result);
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

  app.post('/api/admin/reset-catalog', requireAuth, requireAdmin, (_req, res) => {
    const result = resetCatalogToVerified();
    res.json(result);
  });

  // Serve dashboard in production (skip in dev — Vite handles frontend)
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
  app.listen(port, () => {
    console.log(`🌐 API + Dashboard server running on http://localhost:${port}`);
    console.log(`🔐 Discord OAuth redirect URI: ${getDiscordRedirectUri()}`);
    console.log(`   Add this exact URL in Discord Developer Portal → OAuth2 → Redirects`);
  });
}
