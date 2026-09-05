# Novel Translator (Dịch Truyện)

Chinese → Vietnamese web/PWA novel reader for a small group of friends. Paste a chapter URL or raw text, read a full-width Vietnamese translation, and tap **Next Chapter** to follow the source site’s chapter chain.

Design source of truth: [`docs/superpowers/specs/2026-08-31-novel-translator-design.md`](docs/superpowers/specs/2026-08-31-novel-translator-design.md).

## Features (v1)

- Register with username + password + **invite code**; **7-day** iron-session cookie
- Shared library of novels/chapters/glossary; **per-user** reading progress
- Paste URL (69shuba / uukanshu / twkan / uuread) or paste Chinese text
- Genre-aware DeepSeek translation + glossary inject / auto-extract
- Vietnamese-first reader with Prev/Next, “Dịch lại”, Chinese toggle
- PWA installable; offline = already-saved chapters only
- Client prefs in `localStorage`: auto-translate, font size, theme, default genre

## Stack

- Next.js App Router + Prisma + PostgreSQL
- DeepSeek Chat API (`deepseek-chat`)
- iron-session, bcryptjs, cheerio, next-pwa, next-themes, vitest

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, DEEPSEEK_API_KEY, SESSION_PASSWORD (>=32 chars), INVITE_CODE

npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/thu-vien` (login at `/dang-nhap`).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server (webpack — required by next-pwa) |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Start production server |
| `npm test` | Vitest unit tests (chunk + site adapters) |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:seed` | Seed `SystemPrompt` rows from `DEFAULT_PROMPTS` |

## Env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `DEEPSEEK_API_KEY` | Server-side translation key |
| `SESSION_PASSWORD` | iron-session secret (≥32 chars) |
| `INVITE_CODE` | Shared secret required to register |
| `JINA_API_KEY` | Optional — Jina Reader API key if proxy rate-limited |

## Supported sites

| Site | URL tự động | Ghi chú |
|------|-------------|---------|
| `69shuba.com` | ✅ | Dùng URL dạng `/txt/{book}/{chapter}` |
| `uuread.tw` | ✅ | |
| `wikicv.org` / `wikicv.net` | ✅ mục lục | Đã dịch sẵn — tải về, không gọi DeepSeek |
| `uukanshu.cc` | ✅ | |
| `69shuba.tw` | ❌ auto URL | CAPTCHA — bookmarklet «Dịch Truyện» |
| `twkan.com` | ❌ auto URL | Cloudflare — bookmarklet «Dịch Truyện» |

Unsupported hosts return a Vietnamese error. QQ阅读 / Qidian are out of v1.

## Routes

| Path | Role |
|------|------|
| `/dang-nhap` | Login / register |
| `/thu-vien` | Shared library + progress badge |
| `/them` | Paste URL or text |
| `/doc/[chapterId]` | Reader |
| `/thuat-ngu/[novelId]` | Glossary CRUD |
| `/cai-dat` | Client preferences + bookmarklet for Cloudflare sites |

## Notes

- Same `novelId` + `sourceUrl` reuses the chapter row; existing `translatedText` skips DeepSeek unless “Dịch lại”.
- Paste chapters have `sourceUrl = null` (no Next/Prev until a URL-based chapter is used).
- Archive draft: `README.draft.md`.
