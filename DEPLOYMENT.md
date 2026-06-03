# Deploying The Method Casinos (Free Tier)

**Quick start (after GitHub push):** [Render Blueprint](https://dashboard.render.com/select-repo?type=blueprint) → connect repo → set Discord env vars → set URLs after first deploy → add OAuth redirect in Discord portal.

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
2. In Render → **New** → **Blueprint** → connect repo (or **Sync** on an existing Blueprint).
3. Set secret env vars in the dashboard (never commit `.env`).
4. **Database persistence (Render free — no disk):** Use **Cloudflare R2** (free S3-compatible storage). See [§2b Cloudflare R2 setup](#2b-cloudflare-r2-setup-render-free-tier) below.
5. Set **`SESSION_SECRET`** manually to a long random string (keep it stable across deploys).

**Verify persistence after deploy:** open `https://YOUR-SERVICE.onrender.com/health`:

```json
"persistence": { "diskLikelyPersistent": true, "remoteDbSync": true, "warnings": [] }
```

If both are false, catalog data resets on every Render restart/deploy.

### Option B: Manual Web Service

1. **New Web Service** → connect repo.
2. **Build command:** `npm run render-build` (or `npm install && npm run build:all`)
3. **Start command:** `npm run start:prod`
4. **Environment:**
   - `NODE_ENV=production`
   - `REMOTE_DB_SYNC=true` + R2/S3 vars (see §2b)
   - `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI=https://YOUR-SERVICE.onrender.com/auth/discord/callback`
   - `PUBLIC_SITE_URL=https://your-app.pages.dev`
   - `DASHBOARD_URL=https://your-app.pages.dev`
   - `API_URL=https://YOUR-SERVICE.onrender.com`
   - `SESSION_SECRET` (long random string — keep stable across deploys)
   - `ADMIN_DISCORD_IDS` (comma-separated Discord user IDs)
   - `DISCORD_INVITE_URL=https://discord.gg/your-invite`
5. Configure **R2 remote sync** (§2b) — required on free tier.

Register slash commands after deploy:

```bash
npm run register-commands
```

(or rely on bot auto-register if `DISCORD_CLIENT_ID` is set).

---

## 2b. Cloudflare R2 setup (Render free tier)

Render **free web services cannot attach persistent disks**. The app stores `casinos.db` in object storage and restores it on every boot.

### Create R2 bucket (one-time, free)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket** (e.g. `method-casinos-db`).
2. **Manage R2 API tokens** → **Create API token** → Object Read & Write → scope to that bucket.
3. Copy **Access Key ID**, **Secret Access Key**, and note your **Account ID** (dashboard URL or R2 overview).

### Render environment variables

| Variable | Example |
|----------|---------|
| `REMOTE_DB_SYNC` | `true` |
| `S3_ENDPOINT` | `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `method-casinos-db` |
| `S3_ACCESS_KEY_ID` | *(from R2 token)* |
| `S3_SECRET_ACCESS_KEY` | *(from R2 token)* |
| `S3_REGION` | `auto` |
| `S3_OBJECT_KEY` | `casinos.db` |
| `REMOTE_DB_SYNC_INTERVAL_MINUTES` | `15` |

Redeploy. Logs should show:

- `☁️  Restored database from s3://...` (after first upload), or `starting fresh` on first run
- `⏱️  Remote DB sync every 15m`
- On shutdown: `☁️  Uploaded database to s3://...`

**Paid Render with disk:** you can still use R2 as off-site backup, or set `DATA_DIR=/var/data` and omit `REMOTE_DB_SYNC`.

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
| `REMOTE_DB_SYNC` | Server | `true` = upload/download SQLite via S3 API (R2 on free Render) |
| `S3_ENDPOINT` / `S3_BUCKET` / keys | Server | Cloudflare R2 or any S3-compatible store |
| `DATA_DIR` | Server | Optional; paid Render disk path (`/var/data`) |
| `DISCOVERY_CONTINUOUS` | Server | `true` = 24/7 deep discovery loop |
| `DISCORD_LIVE_FEED` | Server | Mirror discovery log to Discord |
| `DISCORD_FEED_CHANNEL_ID` | Server | Channel for live feed posts |

---

## 6b. Data not saving after Render restart?

**Free plan:** use R2 (§2b), not a Render disk.

1. **Delete `DATA_DIR`** if it is set to `/var/data` — free tier cannot write there and the app will crash.
2. **`REMOTE_DB_SYNC=true`** and all **`S3_*`** vars set on the web service.
2. **Logs on boot:** `☁️  Restored database from s3://...` or upload messages every 15m.
3. **`/health`** → `persistence.remoteDbSync: true` and `diskLikelyPersistent: true`.
4. After approving casinos, wait for the next sync (or redeploy once to force upload on shutdown).
5. **Paid plan with disk:** set `DATA_DIR=/var/data` and attach a disk; R2 is optional backup.

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
