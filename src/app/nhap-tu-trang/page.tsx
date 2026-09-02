"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadPrefs } from "@/lib/prefs";
import { getPendingNovel, setPendingNovel } from "@/lib/pending-novel";

type PagePayload = {
  sourceUrl: string;
  title: string;
  originalText: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  novelTitle?: string | null;
};

function parsePayload(raw: string): PagePayload | null {
  try {
    const data = JSON.parse(raw) as PagePayload;
    if (!data.sourceUrl || !data.title || !data.originalText) return null;
    return data;
  } catch {
    return null;
  }
}

function NhapTuTrangInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Đang đọc chương từ bookmarklet…");
  const [error, setError] = useState("");

  const importPayload = useCallback(
    async (payload: PagePayload) => {
      const prefs = loadPrefs();
      const pending = getPendingNovel();
      const res = await fetch("/api/chapters/from-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          novelId: pending?.novelId,
          genre: pending?.genre || prefs.defaultGenre,
          autoTranslate: prefs.autoTranslate,
        }),
      });
      const data = (await res.json()) as {
        chapterId?: string;
        novelId?: string;
        novel?: { genre?: string };
        message?: string;
      };
      if (!res.ok || !data.chapterId) {
        throw new Error(data.message || "Không nhập được chương");
      }
      if (data.novelId) {
        setPendingNovel({
          novelId: data.novelId,
          genre: data.novel?.genre || pending?.genre || prefs.defaultGenre,
        });
      }
      router.replace(`/doc/${data.chapterId}`);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let raw = "";
        if (searchParams.get("clipboard") === "1") {
          raw = await navigator.clipboard.readText();
        } else if (window.location.hash.length > 1) {
          raw = decodeURIComponent(window.location.hash.slice(1));
        }
        const payload = parsePayload(raw);
        if (!payload) {
          if (!cancelled) {
            setError(
              "Không có dữ liệu chương. Mở trang chương trên site gốc rồi bấm bookmarklet «Dịch Truyện»."
            );
          }
          return;
        }
        if (!cancelled) setStatus("Đang lưu và dịch…");
        await importPayload(payload);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Không nhập được chương"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importPayload, searchParams]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-2xl text-amber-100">Nhập từ trình duyệt</h1>
      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-400">{status}</p>
      )}
    </div>
  );
}

export default function NhapTuTrangPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Đang tải…</p>}>
      <NhapTuTrangInner />
    </Suspense>
  );
}
