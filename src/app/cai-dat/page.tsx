"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { GENRES } from "@/lib/types";
import { buildBookmarkletHref } from "@/lib/bookmarklet";
import {
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  type ReaderPrefs,
} from "@/lib/prefs";

export default function CaiDatPage() {
  const { setTheme, theme } = useTheme();
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [bookmarkletHref, setBookmarkletHref] = useState("");
  const [copied, setCopied] = useState(false);
  const bookmarkletHostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
    setReady(true);
    const href = buildBookmarkletHref(window.location.origin);
    setBookmarkletHref(href);
  }, []);

  useEffect(() => {
    if (!bookmarkletHref || !bookmarkletHostRef.current) return;
    const host = bookmarkletHostRef.current;
    host.replaceChildren();
    const a = document.createElement("a");
    a.setAttribute("href", bookmarkletHref);
    a.textContent = "Dịch Truyện";
    a.className = "btn btn-primary inline-block";
    a.addEventListener("click", (e) => e.preventDefault());
    host.appendChild(a);
    return () => {
      host.replaceChildren();
    };
  }, [bookmarkletHref, ready]);

  const onCopyBookmarklet = useCallback(async () => {
    if (!bookmarkletHref) return;
    try {
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [bookmarkletHref]);

  const persist = useCallback(
    (next: ReaderPrefs) => {
      setPrefs(next);
      savePrefs(next);
      setTheme(next.theme);
    },
    [setTheme]
  );

  const onAutoTranslate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      persist({ ...prefs, autoTranslate: e.target.checked });
    },
    [prefs, persist]
  );

  const onFontSize = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      persist({ ...prefs, fontSize: Number(e.target.value) });
    },
    [prefs, persist]
  );

  const onTheme = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as ReaderPrefs["theme"];
      persist({ ...prefs, theme: value });
    },
    [prefs, persist]
  );

  const onGenre = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      persist({ ...prefs, defaultGenre: e.target.value });
    },
    [prefs, persist]
  );

  if (!ready) {
    return <p className="text-slate-400">Đang tải cài đặt…</p>;
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-amber-100">Cài đặt</h1>
      <p className="mt-1 text-sm text-slate-400">
        Lưu trên trình duyệt này (localStorage), không đồng bộ server.
      </p>

      <div className="panel mt-6 space-y-5 p-5">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Tự động dịch khi mở chương / Next</span>
          <input
            type="checkbox"
            checked={prefs.autoTranslate}
            onChange={onAutoTranslate}
          />
        </label>

        <div>
          <label className="label" htmlFor="fontSize">
            Cỡ chữ đọc: {prefs.fontSize}px
          </label>
          <input
            id="fontSize"
            type="range"
            min={14}
            max={28}
            value={prefs.fontSize}
            onChange={onFontSize}
            className="w-full"
          />
        </div>

        <div>
          <label className="label" htmlFor="theme">
            Giao diện {theme ? `(hiện: ${theme})` : ""}
          </label>
          <select
            id="theme"
            className="select"
            value={prefs.theme}
            onChange={onTheme}
          >
            <option value="dark">Tối</option>
            <option value="light">Sáng</option>
            <option value="system">Theo hệ thống</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="genre">
            Thể loại mặc định
          </label>
          <select
            id="genre"
            className="select"
            value={prefs.defaultGenre}
            onChange={onGenre}
          >
            {GENRES.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel mt-6 space-y-3 p-5">
        <h2 className="text-lg font-medium">Site có Cloudflare / CAPTCHA</h2>
        <p className="text-sm text-slate-400">
          Server không vượt được Cloudflare. Cài bookmarklet một lần, rồi khi đang
          đọc chương trên twkan / 69shuba.tw thì bấm bookmark đó.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span ref={bookmarkletHostRef} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCopyBookmarklet}
            disabled={!bookmarkletHref}
          >
            {copied ? "Đã copy" : "Copy mã bookmarklet"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Cách 1: kéo nút «Dịch Truyện» lên thanh bookmark (đừng click trong app).
          <br />
          Cách 2: Copy mã → Bookmarks → Add bookmark → dán vào ô URL. Không dán
          javascript: vào thanh địa chỉ của trang này.
        </p>
      </div>
    </div>
  );
}
