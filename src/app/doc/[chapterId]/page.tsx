"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadPrefs } from "@/lib/prefs";
import { setPendingNovel } from "@/lib/pending-novel";
import { isBrowserAssistedUrl } from "@/lib/scrape-hints";
import { GENRES } from "@/lib/types";

type ChapterPayload = {
  id: string;
  title: string;
  originalText: string;
  translatedText: string | null;
  nextSourceUrl: string | null;
  prevSourceUrl: string | null;
  sourceUrl: string | null;
  novel: { id: string; title: string; genre: string };
};

export default function DocPage() {
  const params = useParams<{ chapterId: string }>();
  const chapterId = params.chapterId;
  const router = useRouter();
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);
  const [showChinese, setShowChinese] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefs = loadPrefs();
    setFontSize(prefs.fontSize);
    setAutoTranslate(prefs.autoTranslate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/chapters/${chapterId}`);
        const data = (await res.json()) as {
          chapter?: ChapterPayload;
          message?: string;
        };
        if (!res.ok || !data.chapter) {
          if (!cancelled) setError(data.message || "Không tải được chương");
          return;
        }
        if (!cancelled) setChapter(data.chapter);
        if (!cancelled && data.chapter) {
          setPendingNovel({
            novelId: data.chapter.novel.id,
            genre: data.chapter.novel.genre,
          });
        }
      } catch {
        if (!cancelled) setError("Không kết nối được máy chủ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const toggleChinese = useCallback(() => {
    setShowChinese((v) => !v);
  }, []);

  const onGenreChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!chapter) return;
      const genre = e.target.value;
      try {
        const res = await fetch(`/api/novels/${chapter.novel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ genre }),
        });
        if (!res.ok) {
          setError("Không đổi được thể loại");
          return;
        }
        setChapter((c) =>
          c ? { ...c, novel: { ...c.novel, genre } } : c
        );
        setPendingNovel({ novelId: chapter.novel.id, genre });
      } catch {
        setError("Không đổi được thể loại");
      }
    },
    [chapter]
  );

  const onRetranslate = useCallback(async () => {
    if (!chapter) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/chapters/${chapter.id}/translate`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        translatedText?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message || "Dịch lại thất bại");
        return;
      }
      setChapter((c) =>
        c ? { ...c, translatedText: data.translatedText || null } : c
      );
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }, [chapter]);

  const navigate = useCallback(
    async (direction: "next" | "prev") => {
      if (!chapter || busy) return;
      const targetUrl =
        direction === "next" ? chapter.nextSourceUrl : chapter.prevSourceUrl;
      if (!targetUrl) return;

      if (isBrowserAssistedUrl(targetUrl)) {
        setPendingNovel({
          novelId: chapter.novel.id,
          genre: chapter.novel.genre,
        });
        window.open(targetUrl, "_blank", "noopener");
        setError(
          "Đã mở chương trên site gốc. Khi nội dung hiện ra, bấm bookmarklet «Dịch Truyện» (kéo từ trang Cài đặt)."
        );
        return;
      }

      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/chapters/navigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId: chapter.id,
            direction,
            autoTranslate,
          }),
        });
        const data = (await res.json()) as {
          chapterId?: string;
          message?: string;
        };
        if (!res.ok || !data.chapterId) {
          setError(data.message || "Không chuyển được chương");
          return;
        }
        router.push(`/doc/${data.chapterId}`);
      } catch {
        setError("Không kết nối được máy chủ");
      } finally {
        setBusy(false);
      }
    },
    [chapter, autoTranslate, router, busy]
  );

  const onPrev = useCallback(() => navigate("prev"), [navigate]);
  const onNext = useCallback(() => navigate("next"), [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNext, onPrev]);

  if (loading) {
    return <p className="text-slate-400">Đang tải chương…</p>;
  }

  if (!chapter) {
    return <p className="text-red-400">{error || "Không tìm thấy chương"}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">{chapter.novel.title}</p>
          <h1 className="font-serif text-xl text-amber-100">{chapter.title}</h1>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            Thể loại
            <select
              className="select py-1 text-xs"
              value={chapter.novel.genre}
              onChange={onGenreChange}
            >
              {GENRES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/thuat-ngu/${chapter.novel.id}`}
            className="btn btn-ghost"
          >
            Thuật ngữ
          </Link>
          <Link href="/cai-dat" className="btn btn-ghost">
            Cài đặt
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapter.prevSourceUrl}
          onClick={onPrev}
        >
          ← Chương trước
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapter.nextSourceUrl}
          onClick={onNext}
        >
          Chương sau →
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onRetranslate}
        >
          Dịch lại
        </button>
        <button type="button" className="btn btn-ghost" onClick={toggleChinese}>
          {showChinese ? "Ẩn Trung" : "Hiện Trung"}
        </button>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? (
        <p className="mb-3 text-sm text-slate-400">Đang xử lý…</p>
      ) : null}

      <article
        className="reader-body text-slate-100"
        style={{ fontSize: `${fontSize}px` }}
      >
        {chapter.translatedText || (
          <span className="text-slate-500">
            Chưa có bản dịch. Bấm &quot;Dịch lại&quot; hoặc bật tự động dịch.
          </span>
        )}
      </article>

      {showChinese ? (
        <aside className="panel mt-8 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-400">
            Bản gốc Trung
          </h2>
          <div
            className="reader-body text-slate-300"
            style={{ fontSize: `${Math.max(14, fontSize - 2)}px` }}
          >
            {chapter.originalText}
          </div>
        </aside>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapter.prevSourceUrl}
          onClick={onPrev}
        >
          ← Chương trước
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !chapter.nextSourceUrl}
          onClick={onNext}
        >
          Chương sau →
        </button>
      </div>
    </div>
  );
}
