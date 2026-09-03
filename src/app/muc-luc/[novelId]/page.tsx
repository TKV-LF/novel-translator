"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${novelId}`);
      const data = (await res.json()) as {
        novel?: {
          title?: string;
          genre?: string;
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

  const toggleOne = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectUntranslated = useCallback(() => {
    setSelected(
      new Set(
        chapters
          .filter((c) => !c.hasTranslation)
          .map((c) => chapterKey(c))
      )
    );
  }, [chapters]);

  const selectUnfetched = useCallback(() => {
    setSelected(
      new Set(
        chapters.filter((c) => !c.hasContent).map((c) => chapterKey(c))
      )
    );
  }, [chapters]);

  const selectAll = useCallback(() => {
    setSelected(new Set(chapters.map((c) => chapterKey(c))));
  }, [chapters]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

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
        setProgress(`Đang xử lý ${i + 1}/${picked.length}: ${label}…`);

        if (!chapter.hasContent && chapter.sourceUrl) {
          const res = await fetch("/api/chapters/open-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: chapter.sourceUrl,
              novelId,
              genre,
              autoTranslate: true,
            }),
          });
          const data = (await res.json()) as {
            message?: string;
            chapterId?: string;
          };
          if (!res.ok) {
            failed += 1;
            setError(data.message || "Không lấy được chương");
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
      if (!failed) setError("");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }, [chapters, genre, novelId, selected]);

  const backHref = fromChapterId ? `/doc/${fromChapterId}` : "/thu-vien";
  const hasCatalog = Boolean(catalogSyncedAt);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mục lục</p>
          <h1 className="font-serif text-2xl text-amber-100">
            {title || "Đang tải…"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {hasCatalog
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
          Chọn chưa lấy
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || syncing || !chapters.length}
          onClick={selectUntranslated}
        >
          Chọn chưa dịch
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || syncing || !chapters.length}
          onClick={selectAll}
        >
          Chọn tất cả
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
          Lấy & dịch {selected.size} chương
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
        <ul className="panel divide-y divide-[color:var(--border)]">
          {chapters.map((chapter, index) => {
            const key = chapterKey(chapter);
            const checked = selected.has(key);
            const current = chapter.id === fromChapterId;
            const label = chapter.chapterNumber
              ? `Chương ${chapter.chapterNumber}`
              : `Chương ${index + 1}`;
            const status = chapter.hasTranslation
              ? "Đã dịch"
              : chapter.hasContent
                ? "Đã lấy"
                : "Chưa lấy";
            const dotClass = chapter.hasTranslation
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
      )}
    </div>
  );
}
