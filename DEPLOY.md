# Ship to production (novel-translator)

## Checklist

1. `npm test && npm run build`
2. Push `main` if you want GitHub in sync
3. Set Vercel env: `DATABASE_URL`, `DEEPSEEK_API_KEY`, `SESSION_PASSWORD` (≥32 chars), `INVITE_CODE`
4. `npm run db:push && npm run db:seed` (same Prisma Postgres as prod)
5. `npx vercel --prod --yes`

## Env (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma Postgres (same as local `.env`) |
| `DEEPSEEK_API_KEY` | Translation |
| `SESSION_PASSWORD` | Cookie encryption, ≥32 characters |
| `INVITE_CODE` | Required to register |

Optional: `JINA_API_KEY` if scrape proxy is rate-limited.

## After deploy

Open the Vercel URL → `/dang-nhap` → register with invite code → read from Thư viện.

DeepSeek must have credit or translation returns 402.
