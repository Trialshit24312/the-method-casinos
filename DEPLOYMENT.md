# Deploying The Method Casinos (Free Tier)

This guide covers a **split deployment** (recommended): static dashboard on **Cloudflare Pages** (free) and API + Discord bot on **Render** (free tier). You can also run **all-in-one** on Render by serving the built dashboard from Express.

Replace placeholders like `https://your-app.pages.dev` with your real URLs after deploy.

---

## Architecture

| Component | Host | Free tier |
|-----------|------|-----------|
| React dashboard (Vite) | Cloudflare Pages | Yes |
| Express API + SQLite + Discord bot | Render Web Service | Yes (spins down when idle) |

**Note:** Render free services sleep after inactivity. The Discord bot needs a process running 24/7 — use Render always-on paid tier, Railway, Fly.io, or a small VPS if the bot must never sleep.

---

## 1. Discord Developer Portal

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → your application.
2. **Bot** → copy token → `DISCORD_BOT_TOKEN`.
3. **OAuth2** → add redirect URI(s):
   - Split deploy: `https://YOUR-SERVICE.onrender.com/auth/discord/callback`
   - All-in-one: same URL as your public API host.
4. **OAuth2** → copy Client ID and Secret → `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
5. Enable scopes: `identify` (already used by the app).
6. Invite the bot to your server (OAuth2 URL Generator → `bot` + `applications.commands`).

Set `DISCORD_REDIRECT_URI` to the **exact** callback URL above (no trailing slash).

---

## 2. Deploy API + Bot on Render

### Option A: `render.yaml` (Blueprint)

1. Push this repo to GitHub.
2. In Render → **New** → **Blueprint** → connect repo.
3. Set secret env vars in the dashboard (never commit `.env`).

### Option B: Manual Web Service

1. **New Web Service** → connect repo.
2. **Build command:** `npm install && npm run build:all`
3. **Start command:** `npm run start:prod`
4. **Environment:**
   - `NODE_ENV=production`
   - `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI=https://YOUR-SERVICE.onrender.com/auth/discord/callback`
   - `PUBLIC_SITE_URL=https://your-app.pages.dev`
   - `DASHBOARD_URL=https://your-app.pages.dev`
   - `API_URL=https://YOUR-SERVICE.onrender.com`
   - `SESSION_SECRET` (long random string)
   - `ADMIN_DISCORD_IDS` (comma-separated Discord user IDs)
   - `DISCORD_INVITE_URL=https://discord.gg/your-invite`
5. Add a **disk** (optional) mounted at `/opt/render/project/src/data` if you need persistent SQLite on Render.

Register slash commands after deploy:

```bash
npm run register-commands
```

(or rely on bot auto-register if `DISCORD_CLIENT_ID` is set).

---

## 3. Deploy Dashboard on Cloudflare Pages

1. **Workers & Pages** → **Create** → **Pages** → Connect to Git.
2. **Root directory:** `dashboard`
3. **Build command:** `npm install && npm run build`
4. **Build output directory:** `dist`
5. **Environment variables** (Production):

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://YOUR-SERVICE.onrender.com` |
| `VITE_PUBLIC_SITE_URL` | `https://your-app.pages.dev` |
| `VITE_DISCORD_INVITE` | `https://discord.gg/your-invite` |

6. Redeploy after changing env vars (Vite bakes them at build time).

### Alternatives

- **Vercel / Netlify:** same settings — build `dashboard/`, output `dashboard/dist`, set `VITE_*` env vars.

---

## 4. All-in-one on Render (single service)

Skip Cloudflare if you want one URL:

1. Set `PUBLIC_SITE_URL` and `DASHBOARD_URL` to `https://YOUR-SERVICE.onrender.com`.
2. `NODE_ENV=production` — Express serves `dashboard/dist` statically.
3. Leave `VITE_API_URL` empty in dashboard build (same-origin `/api`).

Build still runs `npm run build:all` so `dashboard/dist` exists.

---

## 5. CORS & cookies

Production CORS allows origins from `DASHBOARD_URL`, `PUBLIC_SITE_URL`, and `API_URL`.

Session cookies use `secure: true` when `NODE_ENV=production`. Your dashboard must call the API with `credentials: 'include'` (already configured).

If the dashboard is on `pages.dev` and API on `onrender.com`, cross-site cookies may require `SameSite=None; Secure` — for strictest compatibility, use the all-in-one deploy or a custom domain on both.

---

## 6. Environment variable reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `PUBLIC_SITE_URL` | Server / Bot | Links in embeds, bot activity |
| `DASHBOARD_URL` | Server | OAuth redirects after login |
| `API_URL` | Server | OAuth login link in `/website` |
| `DISCORD_REDIRECT_URI` | Server | Must match Discord portal |
| `DISCORD_INVITE_URL` | Server / Bot | Server invite in `/website` |
| `VITE_API_URL` | Dashboard build | API base URL |
| `VITE_PUBLIC_SITE_URL` | Dashboard build | Footer / absolute links |
| `VITE_DISCORD_INVITE` | Dashboard build | Footer Discord link |

---

## 7. Discord commands (website & legal)

After deploy, users can run:

- `/website` or `/dashboard` — dashboard link + Login with Discord
- `/terms`, `/rules`, `/privacy` — legal summaries + link to full pages
- `/tools` — tools hub links
- `/help` — all commands including the above

---

## 8. Local production test

```bash
cp .env.example .env
# fill in Discord vars

npm run build:all
NODE_ENV=production npm run start:prod
```

Open `http://localhost:3847` (all-in-one) or run dashboard separately with `npm run dev --prefix dashboard`.

---

## 9. Docker (optional)

```bash
docker build -t the-method-casinos .
docker run -p 3847:3847 --env-file .env the-method-casinos
```

Useful for Fly.io, Railway, or any container host.
