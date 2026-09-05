# Wikicv Import — Design Spec

**Date:** 2026-09-05  
**Project:** `novel-translator`  
**Status:** Approved for planning (brainstorm)  
**Parent:** [2026-08-31-novel-translator-design.md](./2026-08-31-novel-translator-design.md)

## 1. Goal

Import novels that are **already Vietnamese** on [wikicv.org](https://wikicv.org) (Wikidich family) into the shared library. Users paste a mục lục URL, pick chapters, and download text. DeepSeek is not used.

This is an import path, not a translate path. Chinese source sites stay on the existing scrape → translate flow.

## 2. Decisions

| Topic | Choice |
|--------|--------|
| Workflow | Paste mục lục URL → create novel → select chapters on our mục lục → download |
| Select all | Supported (existing **Chọn tất cả**) |
| Already saved | Skip — same `novelId` + `sourceUrl` with text is left unchanged |
| Locked / VIP / empty | Try the page; if body is unreadable, skip and continue the batch |
| Hosts | `wikicv.org`, `wikicv.net` |
| Schema | No Prisma change |
| Approach | New `wikicv` site adapter + reuse `/them` and `/muc-luc` |

Out of this spec: other pre-translated sites, background workers, overwrite / “Tải lại”, exporting.

## 3. Architecture

Reuse the existing adapter + catalog + reader stack. Wikicv is a pre-translated host: parse Vietnamese, save it, never call DeepSeek.

```
Browser
  → /them (paste wikicv URL)
  → create/reuse Novel, sync catalog
  → /muc-luc/[novelId]
  → POST chapter import (one URL at a time)
       → wikicv adapter (TOC + chapter HTML)
       → Prisma Chapter upsert (skip if text already present)
```

**Adapter contract** (extend `SiteAdapter`):

```ts
interface SiteAdapter {
  id: string
  matches(hostname: string): boolean
  parseChapter(html: string, url: string): ParsedChapter
  parseBookIndex?(html: string, url: string): ParsedBookIndex | null
  pretranslated?: boolean  // true for wikicv
}
```

`wikicvAdapter.pretranslated === true`. `openUrlChapter` / save path: if the adapter is pre-translated, copy parsed content into **both** `originalText` and `translatedText` and skip `maybeTranslate`.

## 4. Data

No new tables. A Wikicv novel is a normal `Novel` with `sourceHost` `wikicv.org` or `wikicv.net` and `sourceNovelUrl` set to the mục lục URL.

**Chapter after a successful download**

| Field | Value |
|--------|--------|
| `sourceUrl` | Canonical Wikicv chapter URL |
| `originalText` | Vietnamese from `#bookContent` |
| `translatedText` | Same Vietnamese |
| `title` | Chapter title from the page |
| `chapterNumber` | Best-effort from title (existing `guessChapterNumber`) |
| `nextSourceUrl` / `prevSourceUrl` | **Chương sau** / **Chương trước** |

Both text fields are filled so existing mục lục flags work (`hasContent` and `hasTranslation`) and the reader shows Vietnamese immediately.

**Skip rule:** if the chapter row already has non-empty `translatedText` (or non-empty `originalText`), do not fetch or overwrite.

**Book URL**

- Mục lục: `https://wikicv.org/truyen/{slug}-{bookKey}`  
  Example: `https://wikicv.org/truyen/trung-quoc-tho-san-WSZACO8h7G0re1A9`
- Chapter: `https://wikicv.org/truyen/{slug}/{chapter-slug}-{chapterKey}`

`inferBookUrl` for a chapter URL uses the **Mục lục** link on the chapter page when present; otherwise `/truyen/{slug}` is not enough (the book key lives on the TOC URL). Pasting a TOC URL first always stores `sourceNovelUrl` correctly.

**URL shape (Wikicv only)**

- Mục lục: exactly one path segment after `/truyen/` — `{slug}-{bookKey}`
- Chapter: two or more path segments — `{slug}/{chapter-slug}-{chapterKey}`

## 5. Flows

### 5.1 Paste on `/them`

The existing **Dán URL** field accepts a Wikicv mục lục URL or a chapter URL. The client branches on URL shape:

- **Mục lục URL** → create/reuse novel (existing novels API or a small open-book helper) → `POST /api/novels/[id]/sync-toc` → redirect to `/muc-luc/[novelId]`. Do not call `open-url`.
- **Chapter URL** → `POST /api/chapters/open-url` (pre-translated save) → `/doc/[chapterId]`. User can open mục lục afterward; **Tải mục lục** uses stored or inferred book URL.

If the hostname is Wikicv, hide the “Tự động dịch…” checkbox. Submit label stays **Mở URL**.

### 5.2 Sync mục lục

Wikicv does not put the full chapter list in the first HTML. The book page calls `loadBookIndex(start, size)` → `GET /book/index` with `bookId`, `start`, `size`, and a page-embedded signature.

Importer:

1. Fetch the book page HTML (direct, then Jina fallback like other book indexes).
2. Read `bookId`, `signKey`, and the page’s sign helper from that HTML.
3. Request `/book/index` in pages (site uses size `501`). Append `li.chapter-name a` links until a page returns fewer chapters than requested.
4. Store the merged list in `catalogCache` (`bookUrl`, `syncedAt`, `novelTitle`, `chapters`).

Novel title comes from the book page `h2` (example: “Trung Quốc thợ săn”). Author from the book page when present (example: “Bộ Thương”).

**Tải mục lục** on `/muc-luc` runs the same sync.

If `/book/index` cannot be signed or fails, try parsing any `li.chapter-name` already in the book HTML / Jina markdown. Empty result → `EMPTY_CATALOG`.

### 5.3 Download selected chapters

Same select UI as today. For a Wikicv novel the primary action is **Tải về N chương**.

For each selected chapter, in list order, the client calls `POST /api/chapters/open-url` with `autoTranslate: false` and `updateProgress: false` (same batch flags as today):

1. Client: chapter already has text → do not call the API.
2. Server: if that `sourceUrl` already has non-empty text → return the existing row, do not fetch.
3. Else `GET` the chapter URL (direct, then Jina fallback).
4. Parse `#bookContent`. Missing or fewer than 20 characters after clean (locked / VIP / empty) → `EMPTY_CONTENT`. The batch treats this as a skip and continues.
5. Else upsert and write Vietnamese into both text fields.

The browser drives the loop (same pattern as current “Lấy & dịch”). Progress: `Đang tải 12/500…`. Closing the tab stops the job; **Chọn chưa tải** resumes. Already-saved chapters are not refetched. Other scrape failures also skip that chapter and continue; the page then shows how many were skipped.

### 5.4 Reader Prev / Next

Stored `nextSourceUrl` / `prevSourceUrl` go through the same import save path. Skip if that URL is already saved. Do not translate.

Hide **Dịch lại** and the Chinese toggle when `novel.sourceHost` is a Wikicv host.

## 6. UI

### `/them`

- URL hint also lists Wikicv (`wikicv.org`).
- Wikicv URL → hide auto-translate checkbox.

### `/muc-luc` (Wikicv novels only)

- Counts: `N chương trên site · đã tải X`
- Status: **Đã tải** (green) / **Chưa tải** (gray). No “Đã lấy / Đã dịch” split.
- Buttons: **Chọn chưa tải**, **Chọn tất cả**, **Bỏ chọn**. Hide **Chọn chưa dịch**.
- Primary: **Tải về N chương**.

Non-Wikicv novels are unchanged.

### `/thu-vien` and `/doc/[chapterId]`

No new library page. Wikicv books appear with the others. Reader is Vietnamese full-width with Prev / Next and mục lục; no **Dịch lại**, no Chinese toggle.

## 7. Errors (Vietnamese)

| Case | Behavior |
|------|----------|
| Unsupported host | Existing “site chưa hỗ trợ” |
| Mục lục fetch / empty catalog | “Không tải được mục lục từ site” |
| One chapter scrape failure | Skip that chapter; batch continues; after the run, show how many failed |
| Empty / locked body | Skip; do not stop the batch |
| Expired session | Redirect to login |

No DeepSeek errors on this path.

## 8. Testing

CI uses **saved HTML fixtures** only. No live Wikicv requests in CI.

- Adapter `matches` `wikicv.org` and `wikicv.net`; rejects unrelated hosts.
- `parseBookIndex` fixture → novel title + chapter URLs + numbers.
- `parseChapter` fixture → title, `#bookContent` text, next/prev URLs.
- Empty `#bookContent` → empty content (caller skips).
- Save path: existing non-empty text is not overwritten.
- `inferBookUrl` from a chapter page that includes a Mục lục link.

Manual before ship: paste [Trung Quốc thợ săn](https://wikicv.org/truyen/trung-quoc-tho-san-WSZACO8h7G0re1A9), sync mục lục, download a few free chapters, confirm empty/VIP pages skip, confirm reader Prev/Next imports the next missing chapter only.

## 9. Success criteria

- Pasting that mục lục URL creates one shared novel and shows the full (paged) catalog on `/muc-luc`.
- **Chọn tất cả** + **Tải về** saves free chapters as readable Vietnamese with no DeepSeek usage.
- A second **Chọn tất cả** only fetches chapters that are still empty.
- Locked/empty chapters do not abort the batch.
- Friends opening the same chapter see the stored text; nobody re-downloads unless the row is empty.
