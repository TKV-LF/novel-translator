"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { isWikicvHost, isWikicvUrl } from "@/lib/sites/types";

type TocChapter = {
  id: string | null;
  title: string;
  chapterNumber: number | null;
  sourceUrl: string | null;
  hasContent: boolean;
  hasTranslation: boolean;
};

function chapterKey(chapter: TocChapter): string {
  return chapter.id ?? chapter.sourceUrl ?? chapter.title;
}

const TOC_PAGE_SIZE = 200;

function pageForChapterIndex(index: number): number {
  return Math.floor(index / TOC_PAGE_SIZE) + 1;
}

export default function MucLucPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Đang tải mục lục…</p>}>
      <MucLucInner />
    </Suspense>
  );
}

function MucLucInner() {
  const params = useParams<{ novelId: string }>();
  const searchParams = useSearchParams();
  const novelId = params.novelId;
  const fromChapterId = searchParams.get("from");

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("kiem_hiep");
  const [sourceHost, setSourceHost] = useState("");
  const [chapters, setChapters] = useState<TocChapter[]>([]);
  const [bookUrl, setBookUrl] = useState("");
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${novelId}`);
      const data = (await res.json()) as {
        novel?: {
          title?: string;
          genre?: string;
          sourceHost?: string | null;
          chapters?: TocChapter[];
          sourceNovelUrl?: string | null;
          inferredBookUrl?: string | null;
          catalogSyncedAt?: string | null;
        };
        message?: string;
      };
      if (!res.ok || !data.novel) {
        setError(data.message || "Không tải được mục lục");
        return;
      }
      setTitle(data.novel.title || "");
      setGenre(data.novel.genre || "kiem_hiep");
      setSourceHost(data.novel.sourceHost || "");
      setChapters(data.novel.chapters || []);
      setBookUrl(
        data.novel.sourceNovelUrl || data.novel.inferredBookUrl || ""
      );
      setCatalogSyncedAt(data.novel.catalogSyncedAt ?? null);
      setError("");
      return data.novel;
    } catch {
      setError("Không kết nối được máy chủ");
      return null;
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  const syncToc = useCallback(
    async (url?: string) => {
      setSyncing(true);
      setError("");
      try {
        const res = await fetch(`/api/novels/${novelId}/sync-toc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(url?.trim() ? { bookUrl: url.trim() } : {}),
        });
        const data = (await res.json()) as {
          message?: string;
          catalog?: { syncedAt?: string; bookUrl?: string };
        };
        if (!res.ok) {
          setError(data.message || "Không tải được mục lục từ site");
          return false;
        }
        if (data.catalog?.bookUrl) setBookUrl(data.catalog.bookUrl);
        if (data.catalog?.syncedAt) setCatalogSyncedAt(data.catalog.syncedAt);
        await load();
        return true;
      } catch {
        setError("Không kết nối được máy chủ");
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [load, novelId]
  );

  useEffect(() => {
    void (async () => {
      const novel = await load();
      if (!novel || autoSyncAttempted) return;
      setAutoSyncAttempted(true);
      const hasCatalog = Boolean(novel.catalogSyncedAt);
      const canInfer = Boolean(
        novel.sourceNovelUrl || novel.inferredBookUrl
      );
      if (!hasCatalog && canInfer) {
        await syncToc(
          novel.sourceNovelUrl || novel.inferredBookUrl || undefined
        );
      }
    })();
  }, [autoSyncAttempted, load, syncToc]);

  const translatedCount = useMemo(
    () => chapters.filter((c) => c.hasTranslation).length,
    [chapters]
  );

  const fetchedCount = useMemo(
    () => chapters.filter((c) => c.hasContent).length,
    [chapters]
  );

  const imported = isWikicvHost(sourceHost) || isWikicvUrl(bookUrl);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(chapters.length / TOC_PAGE_SIZE)),
    [chapters.length]
  );

  const currentPage = Math.min(Math.max(1, page), totalPages);

  const visibleChapters = useMemo(() => {
    const start = (currentPage - 1) * TOC_PAGE_SIZE;
    return chapters.slice(start, start + TOC_PAGE_SIZE);
  }, [chapters, currentPage]);

  const pageRangeLabel = useMemo(() => {
    if (!chapters.length) return "";
    const start = (currentPage - 1) * TOC_PAGE_SIZE + 1;
    const end = Math.min(currentPage * TOC_PAGE_SIZE, chapters.length);
    return `Chương ${start}–${end} / ${chapters.length}`;
  }, [chapters.length, currentPage]);

  useEffect(() => {
    if (!fromChapterId || !chapters.length) return;
    const idx = chapters.findIndex((c) => c.id === fromChapterId);
    if (idx >= 0) setPage(pageForChapterIndex(idx));
  }, [chapters, fromChapterId]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = useCallback((next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onPrevPage = useCallback(() => {
    goToPage(Math.max(1, currentPage - 1));
  }, [currentPage, goToPage]);

  const onNextPage = useCallback(() => {
    goToPage(Math.min(totalPages, currentPage + 1));
  }, [currentPage, goToPage, totalPages]);

  const toggleOne = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectUntranslated = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleChapters) {
        if (!c.hasTranslation) next.add(chapterKey(c));
      }
      return next;
    });
  }, [visibleChapters]);

  const selectUnfetched = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleChapters) {
        if (imported) {
          if (!c.hasContent && !c.hasTranslation) next.add(chapterKey(c));
        } else if (!c.hasContent) {
          next.add(chapterKey(c));
        }
      }
      return next;
    });
  }, [imported, visibleChapters]);

  const selectFetched = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleChapters) {
        if (c.hasContent || c.hasTranslation) next.add(chapterKey(c));
      }
      return next;
    });
  }, [visibleChapters]);

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleChapters) next.add(chapterKey(c));
      return next;
    });
  }, [visibleChapters]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedFetchedCount = useMemo(
    () =>
      chapters.filter(
        (c) =>
          selected.has(chapterKey(c)) && (c.hasContent || c.hasTranslation)
      ).length,
    [chapters, selected]
  );

  const onProcessSelected = useCallback(async () => {
    const picked = chapters.filter((c) => selected.has(chapterKey(c)));
    if (!picked.length) return;

    setBusy(true);
    setError("");
    let failed = 0;

    try {
      for (let i = 0; i < picked.length; i++) {
        const chapter = picked[i];
        const label = chapter.chapterNumber
          ? `Chương ${chapter.chapterNumber}`
          : chapter.title;
        const alreadySaved = chapter.hasContent || chapter.hasTranslation;
        setProgress(
          `${
            imported
              ? alreadySaved
                ? "Đang tải lại"
                : "Đang tải"
              : "Đang xử lý"
          } ${i + 1}/${picked.length}: ${label}…`
        );

        if (chapter.sourceUrl && (imported || !chapter.hasContent)) {
          const res = await fetch("/api/chapters/open-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: chapter.sourceUrl,
              novelId,
              genre,
              autoTranslate: !imported,
              updateProgress: false,
              force: imported && alreadySaved,
            }),
          });
          const data = (await res.json()) as {
            message?: string;
            chapterId?: string;
          };
          if (!res.ok) {
            failed += 1;
            continue;
          }
          setChapters((prev) =>
            prev.map((c) =>
              chapterKey(c) === chapterKey(chapter)
                ? {
                    ...c,
                    id: data.chapterId ?? c.id,
                    hasContent: true,
                    hasTranslation: true,
                  }
                : c
            )
          );
          continue;
        }

        if (chapter.id && chapter.hasContent && !chapter.hasTranslation) {
          const res = await fetch(`/api/chapters/${chapter.id}/translate`, {
            method: "POST",
          });
          const data = (await res.json()) as { message?: string };
          if (!res.ok) {
            failed += 1;
            setError(data.message || "Một chương dịch thất bại");
            continue;
          }
          setChapters((prev) =>
            prev.map((c) =>
              c.id === chapter.id ? { ...c, hasTranslation: true } : c
            )
          );
        }
      }
      if (failed) {
        setError(
          imported
            ? `Đã bỏ qua ${failed} chương (trống, khóa, hoặc lỗi tải).`
            : `Có ${failed} chương không xử lý được.`
        );
      } else {
        setError("");
      }
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }, [chapters, genre, imported, novelId, selected]);

  const backHref = fromChapterId ? `/doc/${fromChapterId}` : "/thu-vien";
  const hasCatalog = Boolean(catalogSyncedAt);
  const showPagination = chapters.length > TOC_PAGE_SIZE;

  const paginationBar = showPagination ? (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm text-slate-400">
      <span>{pageRangeLabel}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost px-2 py-1 text-xs"
          disabled={busy || syncing || currentPage <= 1}
          onClick={onPrevPage}
        >
          ← Trước
        </button>
        <span className="px-2 tabular-nums">
          Trang {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-ghost px-2 py-1 text-xs"
          disabled={busy || syncing || currentPage >= totalPages}
          onClick={onNextPage}
        >
          Sau →
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mục lục</p>
          <h1 className="font-serif text-2xl text-amber-100">
            {title || "Đang tải…"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {imported
              ? hasCatalog
                ? `${chapters.length} chương trên site · đã tải ${fetchedCount}`
                : `Đã tải ${fetchedCount} chương. Tải mục lục để xem toàn bộ.`
              : hasCatalog
                ? `${chapters.length} chương trên site · đã lấy ${fetchedCount} · đã dịch ${translatedCount}`
                : `Đã lấy ${fetchedCount} chương · đã dịch ${translatedCount}. Tải mục lục để xem toàn bộ.`}
          </p>
        </div>
        <Link href={backHref} className="btn btn-ghost">
          Quay lại
        </Link>
      </div>

      <div className="panel mb-4 space-y-3 p-4">
        <p className="text-sm text-slate-300">Tải mục lục từ site gốc</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            className="input flex-1"
            placeholder="https://www.69shuba.com/book/84165/"
            value={bookUrl}
            disabled={syncing || busy}
            onChange={(e) => setBookUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary shrink-0"
            disabled={syncing || busy || !bookUrl.trim()}
            onClick={() => void syncToc(bookUrl)}
          >
            {syncing ? "Đang tải…" : "Tải mục lục"}
          </button>
        </div>
        {catalogSyncedAt ? (
          <p className="text-xs text-slate-500">
            Cập nhật lúc {new Date(catalogSyncedAt).toLocaleString("vi-VN")}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Để trống URL sẽ tự đoán từ chương đã mở (vd. /txt/84165/… →
            /book/84165/).
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || syncing || !chapters.length}
          onClick={selectUnfetched}
        >
          {imported ? "Chọn chưa tải (trang)" : "Chọn chưa lấy (trang)"}
        </button>
        {imported ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || syncing || !chapters.length}
            onClick={selectFetched}
          >
            Chọn đã tải (trang)
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || syncing || !chapters.length}
            onClick={selectUntranslated}
          >
            Chọn chưa dịch (trang)
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || syncing || !chapters.length}
          onClick={selectAll}
        >
          Chọn tất cả (trang)
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || syncing || selected.size === 0}
          onClick={clearSelection}
        >
          Bỏ chọn
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || syncing || selected.size === 0}
          onClick={onProcessSelected}
        >
          {imported
            ? selectedFetchedCount > 0 &&
              selectedFetchedCount === selected.size
              ? "Tải lại"
              : selectedFetchedCount > 0
                ? "Tải về / Tải lại"
                : "Tải về"
            : "Lấy & dịch"}{" "}
          {selected.size} chương
        </button>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {progress ? (
        <p className="mb-3 text-sm text-slate-400">{progress}</p>
      ) : null}

      {loading || syncing ? (
        <p className="text-slate-400">
          {syncing ? "Đang tải mục lục từ site…" : "Đang tải mục lục…"}
        </p>
      ) : chapters.length === 0 ? (
        <p className="panel p-6 text-sm text-slate-400">
          Chưa có mục lục. Dán URL trang truyện (vd. …/book/84165/) rồi bấm Tải
          mục lục.
        </p>
      ) : (
        <div className="panel overflow-hidden">
          {paginationBar}
          <ul className="divide-y divide-[color:var(--border)]">
          {visibleChapters.map((chapter, index) => {
            const globalIndex = (currentPage - 1) * TOC_PAGE_SIZE + index;
            const key = chapterKey(chapter);
            const checked = selected.has(key);
            const current = chapter.id === fromChapterId;
            const label = chapter.chapterNumber
              ? `Chương ${chapter.chapterNumber}`
              : `Chương ${globalIndex + 1}`;
            const status = imported
              ? chapter.hasTranslation || chapter.hasContent
                ? "Đã tải"
                : "Chưa tải"
              : chapter.hasTranslation
                ? "Đã dịch"
                : chapter.hasContent
                  ? "Đã lấy"
                  : "Chưa lấy";
            const dotClass = imported
              ? chapter.hasTranslation || chapter.hasContent
                ? "bg-emerald-400"
                : "bg-slate-500"
              : chapter.hasTranslation
                ? "bg-emerald-400"
                : chapter.hasContent
                  ? "bg-amber-400"
                  : "bg-slate-500";

            return (
              <li
                key={key}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  current ? "bg-white/5" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  checked={checked}
                  disabled={busy || syncing}
                  onChange={() => toggleOne(key)}
                  aria-label={`Chọn ${chapter.title}`}
                />
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                  title={status}
                  aria-hidden
                />
                {chapter.id ? (
                  <Link
                    href={`/doc/${chapter.id}`}
                    className="min-w-0 flex-1 text-sm text-slate-100 hover:text-amber-100"
                  >
                    <span className="mr-2 text-xs text-slate-500">{label}</span>
                    {chapter.title}
                    {current ? (
                      <span className="ml-2 text-xs text-amber-200">
                        đang đọc
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 text-sm text-slate-300">
                    <span className="mr-2 text-xs text-slate-500">{label}</span>
                    {chapter.title}
                  </span>
                )}
                <span className="shrink-0 text-xs text-slate-500">{status}</span>
              </li>
            );
          })}
          </ul>
          {paginationBar}
        </div>
      )}
    </div>
  );
}
