"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type TocChapter = {
  id: string;
  title: string;
  chapterNumber: number | null;
  hasTranslation: boolean;
};

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
  const [chapters, setChapters] = useState<TocChapter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/novels/${novelId}`);
      const data = (await res.json()) as {
        novel?: { title?: string; chapters?: TocChapter[] };
        message?: string;
      };
      if (!res.ok || !data.novel) {
        setError(data.message || "Không tải được mục lục");
        return;
      }
      setTitle(data.novel.title || "");
      setChapters(data.novel.chapters || []);
      setError("");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const translatedCount = useMemo(
    () => chapters.filter((c) => c.hasTranslation).length,
    [chapters]
  );

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectUntranslated = useCallback(() => {
    setSelected(
      new Set(chapters.filter((c) => !c.hasTranslation).map((c) => c.id))
    );
  }, [chapters]);

  const selectAll = useCallback(() => {
    setSelected(new Set(chapters.map((c) => c.id)));
  }, [chapters]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const onTranslateSelected = useCallback(async () => {
    const ids = chapters.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (!ids.length) return;
    setBusy(true);
    setError("");
    let failed = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setProgress(`Đang dịch ${i + 1}/${ids.length}…`);
        const res = await fetch(`/api/chapters/${id}/translate`, {
          method: "POST",
        });
        const data = (await res.json()) as { message?: string };
        if (!res.ok) {
          failed += 1;
          setError(data.message || "Một chương dịch thất bại");
          continue;
        }
        setChapters((prev) =>
          prev.map((c) => (c.id === id ? { ...c, hasTranslation: true } : c))
        );
      }
      if (!failed) setError("");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }, [chapters, selected]);

  const backHref = fromChapterId ? `/doc/${fromChapterId}` : "/thu-vien";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mục lục</p>
          <h1 className="font-serif text-2xl text-amber-100">
            {title || "Đang tải…"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Đã dịch {translatedCount}/{chapters.length} chương. Chỉ hiện chương
            đã lấy từ site gốc.
          </p>
        </div>
        <Link href={backHref} className="btn btn-ghost">
          Quay lại
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapters.length}
          onClick={selectUntranslated}
        >
          Chọn chưa dịch
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapters.length}
          onClick={selectAll}
        >
          Chọn tất cả
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || selected.size === 0}
          onClick={clearSelection}
        >
          Bỏ chọn
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || selected.size === 0}
          onClick={onTranslateSelected}
        >
          Dịch {selected.size} chương
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

      {loading ? (
        <p className="text-slate-400">Đang tải mục lục…</p>
      ) : chapters.length === 0 ? (
        <p className="panel p-6 text-sm text-slate-400">
          Chưa có chương nào. Mở URL hoặc bấm Chương sau để lấy thêm.
        </p>
      ) : (
        <ul className="panel divide-y divide-[color:var(--border)]">
          {chapters.map((chapter, index) => {
            const checked = selected.has(chapter.id);
            const current = chapter.id === fromChapterId;
            const label = chapter.chapterNumber
              ? `Chương ${chapter.chapterNumber}`
              : `Chương ${index + 1}`;
            return (
              <li
                key={chapter.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  current ? "bg-white/5" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  checked={checked}
                  disabled={busy}
                  onChange={() => toggleOne(chapter.id)}
                  aria-label={`Chọn ${chapter.title}`}
                />
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    chapter.hasTranslation ? "bg-emerald-400" : "bg-slate-500"
                  }`}
                  title={chapter.hasTranslation ? "Đã dịch" : "Chưa dịch"}
                  aria-hidden
                />
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
                <span className="shrink-0 text-xs text-slate-500">
                  {chapter.hasTranslation ? "Đã dịch" : "Chưa dịch"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
