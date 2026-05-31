# The Method Casinos

Discord bot + dashboard for discovering US sweepstakes casinos (email-only signup, no phone).

- **Dashboard:** casino search, similar casinos, discovery, tools, blocklist
- **Discord:** `/search`, `/website`, `/terms`, `/rules`, and more
- **Data:** verified casino catalog only — run `npm run reset-data` to purge junk entries

## Local development

```bash
npm install
npm install --prefix dashboard
cp .env.example .env
# Fill in Discord credentials in .env

npm run dev
```

- Dashboard: http://localhost:5173  
- API: http://localhost:3847  

Register slash commands after changing them:

```bash
npm run register-commands
```

## Deploy (free)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full steps.

**Fastest path — all-in-one on Render (one public URL):**

1. Push this repo to GitHub (see below).
2. [Render](https://render.com) → **New Web Service** → connect repo.
3. Use `render.yaml` or set build `npm install && npm run build:all`, start `npm run start:prod`.
4. Add env vars from `.env.example` (Discord token, client ID/secret, admin IDs).
5. Set `PUBLIC_SITE_URL`, `DASHBOARD_URL`, and `API_URL` to your Render URL (e.g. `https://the-method-casinos.onrender.com`).
6. Set `DISCORD_REDIRECT_URI` to `https://YOUR-URL.onrender.com/auth/discord/callback` in both `.env` and the Discord Developer Portal.
7. Redeploy, then run `npm run register-commands` locally once (or restart the service).

**Split deploy (optional):** Cloudflare Pages for `dashboard/` + Render for API — see DEPLOYMENT.md.

## Push to GitHub

```powershell
git init
git add .
git commit -m "Initial commit: The Method Casinos bot and dashboard"
git branch -M main
gh repo create the-method-casinos --public --source=. --remote=origin --push
```

If `gh` is not installed, create a repo at https://github.com/new then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/the-method-casinos.git
git push -u origin main
```

**Never commit `.env`** — it is gitignored.
