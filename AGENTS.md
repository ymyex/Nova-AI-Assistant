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
- Vercel Git integration is enabled for `ymyex/coda-integration` on branch `main`.
- Expected behavior: every push to `main` auto-deploys to production and auto-promotes to `https://coda.ymyex.me` on success.
- No GitHub Actions deploy workflow is used in this repo.

## Verification Commands
- `vercel project inspect coda-integration`
- `vercel api /v9/projects/prj_YF84b0eOxN3FjAwcZudQngCtPLuZ` (check `link.productionBranch`, `gitProviderOptions.createDeployments`, latest `readySubstate`)
- `vercel ls coda-integration --yes`
- `vercel domains inspect coda.ymyex.me`
- `git remote -v`

## Cross-Project Reference
- `https://ymyex.me` and `https://www.ymyex.me` are deployed from the sibling repo:
  - `C:\Users\ymyex\Projects\ymyex.me\Portfolio`
  - Vercel project: `portfolio`
  - GitHub remote there: `https://github.com/ymyex/Portfolio.git`
