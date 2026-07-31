# Golf AI

Production web app for golf swing analysis from slow-motion video uploads.

See [`SPEC.md`](./SPEC.md) for the full build specification.

## Phase A status

Foundation only: Next.js 15, Tailwind v4, shadcn/ui, Drizzle + Neon, Clerk, Zod env validation, analysis contract + JSON Schema, Vitest, Playwright, `/api/health`.

## Local setup

```bash
pnpm install
cp .env.example .env.local
# fill real Neon / Clerk / Blob values
pnpm db:push
pnpm contract:build
pnpm dev
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright e2e |
| `pnpm typecheck` | TypeScript |
| `pnpm contract:build` | Generate `contract/analysis.schema.json` |
| `pnpm db:generate` / `db:push` | Drizzle migrations |

## Inference

The Modal GPU service lives in `inference/` and is excluded from Vercel builds via `.vercelignore`. Not implemented until Phase D. Use `INFERENCE_MODE=mock` until then.

## Dataset note

GolfDB / Kaggle `videos-160` are reference-only. Do not download datasets into this repo. `/data` is gitignored.
