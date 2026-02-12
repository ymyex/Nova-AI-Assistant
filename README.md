# Coda System (Frontend Only)

This repository currently contains **only** the Coda System web frontend (Vite + React + TypeScript).

## OpenClaw Integration (Current)
- Local OpenClaw source of truth: `S:\openclaw`
- This dashboard is the remote UI layer for that local setup.
- Active integration scope right now is chat (Neural Link) over Tailscale.
- Detailed integration doc: `OPENCLAW_INTEGRATION.md`

## Deployment Configuration (verified 2026-02-12)
- Local repo path: `C:\Users\ymyex\Projects\ymyex.me\coda-integration`
- GitHub remote (`coda`): `https://github.com/ymyex/coda-integration.git`
- Legacy GitHub remote (`origin`): `https://github.com/ymyex/Nova-AI-Assistant.git`
- Vercel project: `coda-integration`
- Vercel project ID: `prj_YF84b0eOxN3FjAwcZudQngCtPLuZ`
- Production domain: `https://coda.ymyex.me`

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Deploy
```bash
vercel --prod --yes
```

## Auto Deploy On Push
- Managed directly by Vercel Git integration
- Connected repo: `ymyex/coda-integration`
- Production branch: `main`
- No GitHub Actions workflow or `VERCEL_TOKEN` secret required for deploys.
- Pushes to `main` automatically create a production deployment.
- Successful production deployments are automatically promoted and assigned to `https://coda.ymyex.me`.

## Verify Mapping
```bash
git remote -v
vercel project inspect coda-integration
vercel ls coda-integration --yes
vercel domains inspect coda.ymyex.me
```

## Related Project
- `https://ymyex.me` and `https://www.ymyex.me` map to Vercel project `portfolio`.
- That app lives in `C:\Users\ymyex\Projects\ymyex.me\Portfolio`.

## Notes

The previous backend and integrations (FastAPI, WhatsApp bridge, OpenCode, etc.) have been removed for now.
