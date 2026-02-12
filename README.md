# Coda System (Frontend Only)

This repository currently contains **only** the Coda System web frontend (Vite + React + TypeScript).

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
- Workflow: `.github/workflows/deploy-vercel.yml`
- Trigger: every push to `main`
- Required GitHub repo secret:
  - `VERCEL_TOKEN` (create in GitHub: `Settings` -> `Secrets and variables` -> `Actions`)
- Once `VERCEL_TOKEN` is set, each `main` push auto-deploys to Vercel production.

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
