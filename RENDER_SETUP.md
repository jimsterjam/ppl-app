Render Deployment — Setup Guide for ppl-app
=========================================

This repository contains a Vue/Vite client and a Node/Express server. The `render.yaml` manifest defines two services:

- `ppl-app-client` (Static Site) — builds `client` and publishes `client/dist`
- `ppl-app-server` (Web Service) — runs `server` using Node

Quick checklist
---------------
1. Rotate secrets (important)
   - Immediately rotate and replace any compromised keys (MongoDB user/password, Clerk secret, OpenAI key).
2. Create Render account and link GitHub repository
   - https://dashboard.render.com
   - Connect GitHub and grant repository access to `jimsterjam/ppl-app`.
3. Use the manifest or create services manually
   - Option A (recommended): In Render Dashboard → New → Import from `render.yaml` (select repo + branch `main`).
   - Option B: Create services manually and use these settings:
     - Static Site (`ppl-app-client`):
       - Build Command: `cd client && npm ci && npm run build`
       - Publish Directory: `client/dist`
       - Branch: `main`
     - Web Service (`ppl-app-server`):
       - Environment: Node
       - Build Command: `cd server && npm ci`
       - Start Command: `cd server && npm run start`
       - Branch: `main`

4. Add environment variables (Render Dashboard → Service → Environment)
    - For `ppl-app-server` add (example keys):
       - `MONGO_URI` = mongodb+srv://... (rotate credentials first)
       - `FIREBASE_ADMIN_CREDENTIAL_JSON` = <full Firebase service account JSON as a single line>
       - `OPENAI_API_KEY` = sk-... (if used)
       - `NODE_ENV` = production

5. Deploy and verify
   - After import / manual creation, trigger a deploy or push to `main`.
   - Check service logs in Render for build and run output.
   - Verify static site: `https://ppl-app-client.onrender.com` (or custom domain)
   - Verify API health: `https://ppl-app-server.onrender.com/api/health`
   - Current production server: `https://ppl-app-server.onrender.com`

6. Domains & DNS
   - If you use a custom domain, add it in Render and update DNS records (CNAME/ALIAS) as instructed by Render.
   - Remove the custom domain from Vercel to avoid conflicts.

Notes & Tips
------------
- The manifest `render.yaml` includes placeholders for env vars. Fill them in the Render Dashboard rather than committing secrets to the repo.
- Do not commit `server/serviceAccount.json`; use `FIREBASE_ADMIN_CREDENTIAL_JSON` in Render instead.
- Render sets a `PORT` env var for web services — the server reads `process.env.PORT` already.
- If you want automatic certificate management for custom domains, enable Render's managed TLS.
- For production, consider using a paid plan for better performance and persistent disks (if needed for uploads).

If you want, I can also generate a CI workflow (GitHub Actions) to deploy automatically to Render on pushes to `main`.
