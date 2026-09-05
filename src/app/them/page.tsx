"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GENRES } from "@/lib/types";
import { loadPrefs } from "@/lib/prefs";
import { urlInputHint } from "@/lib/scrape-hints";
import { isWikicvTocUrl, isWikicvUrl } from "@/lib/sites/types";

type NovelOption = { id: string; title: string; genre: string };

export default function ThemPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [novels, setNovels] = useState<NovelOption[]>([]);
  const [novelId, setNovelId] = useState("");
  const [newNovelTitle, setNewNovelTitle] = useState("");
  const [genre, setGenre] = useState("kiem_hiep");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [urlHint, setUrlHint] = useState<string | null>(null);

  const onUrlChange = useCallback((value: string) => {
    setUrl(value);
    setUrlHint(value.trim() ? urlInputHint(value) : null);
  }, []);

  useEffect(() => {
    const prefs = loadPrefs();
    setAutoTranslate(prefs.autoTranslate);
    setGenre(prefs.defaultGenre);
    (async () => {
      const res = await fetch("/api/novels");
      if (res.ok) {
        const data = (await res.json()) as { novels: NovelOption[] };
        setNovels(data.novels || []);
      }
    })();
  }, []);

  const setUrlMode = useCallback(() => setMode("url"), []);
  const setPasteMode = useCallback(() => setMode("paste"), []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      try {
        if (mode === "url" && isWikicvTocUrl(url)) {
          const res = await fetch("/api/novels/open-book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookUrl: url,
              novelId: novelId || undefined,
              title: newNovelTitle || undefined,
              genre,
            }),
          });
          const data = (await res.json()) as {
            novelId?: string;
            message?: string;
          };
          if (!res.ok || !data.novelId) {
            setError(data.message || "Không tải được mục lục");
            return;
          }
          router.push(`/muc-luc/${data.novelId}`);
          return;
        }

        const endpoint =
          mode === "url" ? "/api/chapters/open-url" : "/api/chapters/paste";
        const body =
          mode === "url"
            ? {
                url,
                novelId: novelId || undefined,
                title: newNovelTitle || undefined,
                genre,
                autoTranslate: isWikicvUrl(url) ? false : autoTranslate,
              }
            : {
                novelId: novelId || undefined,
                title: title || "Chương dán tay",
                novelTitle: newNovelTitle || undefined,
                genre,
                originalText,
                autoTranslate,
              };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          chapterId?: string;
          message?: string;
        };
        if (!res.ok || !data.chapterId) {
          setError(data.message || "Không thể thêm chương");
          return;
        }
        router.push(`/doc/${data.chapterId}`);
      } catch {
        setError("Không kết nối được máy chủ");
      } finally {
        setLoading(false);
      }
    },
    [
      mode,
      url,
      novelId,
      newNovelTitle,
      genre,
      autoTranslate,
      title,
      originalText,
      router,
    ]
  );

  return (
    <div>
      <h1 className="font-serif text-2xl text-amber-100">Thêm chương</h1>
      <p className="mt-1 text-sm text-slate-400">
        Dán URL site hỗ trợ hoặc dán văn bản Trung.
      </p>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className={`btn ${mode === "url" ? "btn-primary" : "btn-ghost"}`}
          onClick={setUrlMode}
        >
          Dán URL
        </button>
        <button
          type="button"
          className={`btn ${mode === "paste" ? "btn-primary" : "btn-ghost"}`}
          onClick={setPasteMode}
        >
          Dán văn bản
        </button>
      </div>

      <form onSubmit={onSubmit} className="panel mt-5 space-y-4 p-5">
        <div>
          <label className="label" htmlFor="novel">
            Truyện có sẵn
          </label>
          <select
            id="novel"
            className="select"
            value={novelId}
            onChange={(e) => setNovelId(e.target.value)}
          >
            <option value="">— Tạo truyện mới —</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </div>

        {!novelId ? (
          <>
            <div>
              <label className="label" htmlFor="newTitle">
                Tên truyện mới
              </label>
              <input
                id="newTitle"
                className="input"
                value={newNovelTitle}
                onChange={(e) => setNewNovelTitle(e.target.value)}
                placeholder="Tùy chọn — có thể lấy từ site"
              />
            </div>
            <div>
              <label className="label" htmlFor="genre">
                Thể loại
              </label>
              <select
                id="genre"
                className="select"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {GENRES.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {mode === "url" ? (
          <div>
            <label className="label" htmlFor="url">
              URL chương hoặc mục lục Wikicv
            </label>
            <input
              id="url"
              className="input"
              type="url"
              required
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://www.69shuba.com/txt/..."
            />
            <p className="mt-1 text-xs text-slate-500">
              URL ổn định: <strong className="text-slate-400">69shuba.com</strong>,{" "}
              <strong className="text-slate-400">uuread.tw</strong>,{" "}
              <strong className="text-slate-400">uukanshu.cc</strong>,{" "}
              <strong className="text-slate-400">wikicv.org</strong>
            </p>
            <p className="mt-0.5 text-xs text-amber-700/90">
              69shuba.tw / twkan.com: không dán URL — mở chương trên site rồi
              bấm bookmarklet «Dịch Truyện» (trang Cài đặt), hoặc tab «Dán văn bản».
            </p>
            {urlHint ? (
              <p className="mt-2 text-sm text-amber-400" role="status">
                {urlHint}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="chTitle">
                Tiêu đề chương
              </label>
              <input
                id="chTitle"
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="text">
                Văn bản Trung
              </label>
              <textarea
                id="text"
                className="textarea"
                required
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
              />
            </div>
          </>
        )}

        {mode === "url" && isWikicvUrl(url) ? null : (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
            />
            Tự động dịch sau khi lấy nội dung
          </label>
        )}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Đang xử lý…" : mode === "url" ? "Mở URL" : "Lưu & đọc"}
        </button>
      </form>
    </div>
  );
}
