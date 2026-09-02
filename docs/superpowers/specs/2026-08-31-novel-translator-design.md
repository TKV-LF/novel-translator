# Novel Translator — Design Spec

**Date:** 2026-08-31  
**Project:** `novel-translator`  
**Status:** Approved for planning (brainstorm)

## 1. Goal

Build a Chinese → Vietnamese **web/PWA novel reader** for a small group of friends. Users paste chapter text or a chapter URL, read a full-width Vietnamese translation, and tap **Next Chapter** to follow the source site’s chapter chain (fetch + translate), not just one-shot paste translation.

The existing `README.md` is a draft reference only; this spec is the source of truth for v1. Update the README after implementation planning or implementation.

## 2. Users & access

| Decision | Choice |
|----------|--------|
| Audience | You + a few friends |
| Auth | Light accounts: username + password; **open self-register** in v1 (rely on non-public deploy URL). Invite codes deferred. |
| Session | Cookie/session lasting **7 days** |
| API key | **One shared** `DEEPSEEK_API_KEY` on the server (never sent to the client) |
| Library | **Shared** novels, chapters, translations, glossary |
| Progress | **Per-user** reading position (`ReadingProgress`) |

## 3. Scope

### In v1

- Paste raw Chinese text **or** paste a supported chapter URL
- Vietnamese-first full-width reader (Chinese available via toggle/drawer)
- **Next / Prev chapter** from stored source next/prev URLs
- Setting: **auto-translate on Next** (default) vs **fetch only**
- Genre-aware DeepSeek system prompts
- Glossary per novel (auto-extract after translate + manual CRUD)
- Auto-save chapters; reuse existing translation for the same `sourceUrl` (friends don’t re-pay)
- PWA installable; offline = already-saved chapters only (no offline scrape/translate)
- Site adapters for open HTML sources (see §5)

### Out of v1

- QQ阅读 / Qidian adapters
- Export (`.txt` / `.md`)
- Per-user API keys
- Split-pane Chinese \| Vietnamese compare mode
- Admin UI for system prompts (seeded prompts in DB are enough; edit later if needed)
- Background worker / second deploy (escape hatch only if Vercel scrape/translate proves unreliable)

## 4. Architecture

**Approach:** Next.js App Router full-stack on Vercel + Prisma + Postgres (same deploy style as `so-thu-chi`).

```
Browser (PWA)
  → Auth (session cookie, 7d)
  → Library / Reader UI
  → API routes / server actions
       → SiteAdapter registry (scrape + parse)
       → DeepSeek (translate + glossary extract)
       → Prisma / Postgres
```

**Major modules**

1. **Auth** — register/login, hashed passwords, session table, 7-day expiry  
2. **Library** — shared novels/chapters; per-user progress  
3. **Site adapters** — hostname → `{ title, content, nextUrl, prevUrl, … }`  
4. **Translate** — genre prompt + glossary inject; chunk long text; stream to UI; retry 2× on timeout  
5. **Reader orchestration** — open URL / paste → upsert chapter → translate if needed → update progress  

## 5. Site adapters (v1)

Supported host families (site-specific parsers):

- `69shuba.com`, `69shuba.tw` (and close variants under the same family)
- `uukanshu.cc`
- `twkan.com`
- `uuread.tw`

**Contract**

```ts
type ParsedChapter = {
  title: string
  content: string
  nextUrl?: string | null
  prevUrl?: string | null
  novelTitle?: string | null
  author?: string | null
}

interface SiteAdapter {
  matches(hostname: string): boolean
  parseChapter(html: string, url: string): ParsedChapter
}
```

- Fetch is **server-side** only (browser-like User-Agent, timeout).
- Unsupported host → clear Vietnamese error: site not supported in v1.
- CI uses **saved HTML fixtures** per adapter; no live scrape in CI.
- QQ / Qidian deferred (auth / anti-bot).

## 6. Data model (Prisma)

- **User** — username (unique), passwordHash, createdAt  
- **Session** — token, userId, expiresAt  
- **Novel** — title, author?, genre, sourceHost?, sourceNovelUrl?, createdByUserId, createdAt  
- **Chapter** — novelId, chapterNumber? (best-effort parse from title/URL; nullable if unknown), title, sourceUrl? (unique per novel when set), originalText, translatedText?, nextSourceUrl?, prevSourceUrl?, createdAt, updatedAt  
- **GlossaryEntry** — novelId, original, translated, type (`character` \| `term` \| `location` \| `skill` \| `sect` \| `item` \| `other`), firstChapterId?, createdAt  
- **ReadingProgress** — unique (userId, novelId), chapterId, updatedAt  
- **SystemPrompt** — genre (PK), promptText, updatedAt  
- **ApiUsage** — chapterId?, inputTokens, outputTokens, estimatedCostUsd?, createdAt  

**Upsert rule:** same novel + same `sourceUrl` → reuse row; if `translatedText` already present, skip DeepSeek unless user taps “Dịch lại”.

## 7. Next Chapter & paste flows

### URL / Next Chapter

1. Resolve adapter by hostname → fetch HTML → parse.  
2. Upsert `Chapter` by `sourceUrl`; store `nextSourceUrl` / `prevSourceUrl`.  
3. If auto-translate enabled and translation empty → DeepSeek (genre + glossary) → save.  
4. Update caller’s `ReadingProgress`.  
5. UI shows Vietnamese; Next/Prev use stored URLs.

### Paste text

- Create/attach chapter **without** `sourceUrl` / next-prev links.  
- Next disabled until a source URL is bound (future) or user opens a URL-based chapter.

## 8. UI

1. **Login / Register**  
2. **Library** — shared novels; badge from *your* last progress  
3. **Reader** — Vietnamese full-width; title; Prev / Next; “Dịch lại”; menu: Chinese, glossary, settings  
4. **Add content** — Paste text \| Paste URL; pick/create novel + genre  
5. **Glossary** — filter by type; add/edit/delete  
6. **Settings** — auto-translate vs fetch-only; font size; theme (dark default); default genre  

**Client preferences:** auto-translate, font size, theme, and default genre are stored **per browser** (e.g. `localStorage`), not in Postgres, for v1.

## 9. Translation & glossary

- Genres/system prompts seeded from the README draft (kiếm hiệp, tu tiên, đô thị, ngôn tình, huyền huyễn, lịch sử) — literary context translation, not word-by-word; return translation only.  
- Prepend novel glossary to each translate call for consistency.  
- After translate: secondary extract pass → merge new terms (skip duplicates on `original`).  
- Chunk long chapters (~3k tokens); stream progress; track usage in `ApiUsage`.  
- Model: `deepseek-chat` by default; optional “Deep Think” can wait for a later iteration.

## 10. Errors (user-facing, Vietnamese)

- Scrape failure, empty content, missing next link  
- DeepSeek rate limit, invalid key, timeout  
- Auth failure / expired session → re-login  
- Unsupported novel site  

## 11. Testing

- Unit: adapters vs HTML fixtures  
- Unit: glossary merge + text chunking  
- Integration: session auth; chapter upsert by URL; skip re-translate when present  
- Manual: one live Next Chapter path per supported site before production ship  

## 12. Deployment

- Vercel + Prisma Postgres (user already has a Prisma account)  
- Env: `DATABASE_URL`, `DEEPSEEK_API_KEY`, session secret  
- Follow a ship checklist similar to `so-thu-chi` after features land  

## 13. Success criteria

- Friend can register, open a 69shuba (or other v1) chapter URL, read Vietnamese, tap Next repeatedly without re-pasting.  
- Second friend opening the same chapter sees the existing translation (no duplicate API cost).  
- Glossary grows and keeps names/terms consistent across chapters.  
- App installable as PWA; reading works offline for chapters already saved.
