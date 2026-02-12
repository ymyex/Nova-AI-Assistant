# Coda Deployment Memory

Use this file as the canonical deployment and repository mapping for this project.

## Primary Mapping (verified 2026-02-12)
- Local repo path: `C:\Users\ymyex\Projects\ymyex.me\coda-integration`
- GitHub remote (`coda`): `https://github.com/ymyex/coda-integration.git`
- Legacy GitHub remote (`origin`): `https://github.com/ymyex/Nova-AI-Assistant.git`
- Vercel project: `coda-integration` (`prj_YF84b0eOxN3FjAwcZudQngCtPLuZ`)
- Production domain: `https://coda.ymyex.me`
- Local Vercel link file: `.vercel/project.json` (must have `"projectName":"coda-integration"`)

## Deployment
- Deploy command (from repo root): `vercel --prod --yes`
- Build command: `npm run build`

## Verification Commands
- `vercel project inspect coda-integration`
- `vercel ls coda-integration --yes`
- `vercel domains inspect coda.ymyex.me`
- `git remote -v`

## Cross-Project Reference
- `https://ymyex.me` and `https://www.ymyex.me` are deployed from the sibling repo:
  - `C:\Users\ymyex\Projects\ymyex.me\Portfolio`
  - Vercel project: `portfolio`
  - GitHub remote there: `https://github.com/ymyex/Portfolio.git`
