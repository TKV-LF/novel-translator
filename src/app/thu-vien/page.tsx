"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GENRES } from "@/lib/types";

type NovelRow = {
  id: string;
  title: string;
  author: string | null;
  genre: string;
  sourceHost: string | null;
  chapterCount: number;
  progress: {
    chapterId: string;
    chapterTitle: string;
    updatedAt: string;
  } | null;
};

export default function ThuVienPage() {
  const [novels, setNovels] = useState<NovelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/novels");
        const data = (await res.json()) as {
          novels?: NovelRow[];
          message?: string;
        };
        if (!res.ok) {
          if (!cancelled) setError(data.message || "Không tải được thư viện");
          return;
        }
        if (!cancelled) setNovels(data.novels || []);
      } catch {
        if (!cancelled) setError("Không kết nối được máy chủ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const genreLabel = (key: string) =>
    GENRES.find((g) => g.key === key)?.label || key;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-amber-100">Thư viện</h1>
          <p className="mt-1 text-sm text-slate-400">
            Truyện dùng chung; tiến độ đọc là của riêng bạn.
          </p>
        </div>
        <Link href="/them" className="btn btn-primary">
          Thêm chương
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-400">Đang tải…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : novels.length === 0 ? (
        <div className="panel p-8 text-center text-slate-400">
          <p>Chưa có truyện nào.</p>
          <Link href="/them" className="mt-3 inline-block text-amber-200 underline">
            Dán URL hoặc văn bản để bắt đầu
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {novels.map((novel) => (
            <li key={novel.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-serif text-lg text-slate-100">
                    {novel.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {genreLabel(novel.genre)}
                    {novel.author ? ` · ${novel.author}` : ""}
                    {` · ${novel.chapterCount} chương`}
                    {novel.sourceHost ? ` · ${novel.sourceHost}` : ""}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/muc-luc/${novel.id}`}
                    className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                  >
                    Mục lục
                  </Link>
                  <Link
                    href={`/thuat-ngu/${novel.id}`}
                    className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                  >
                    Thuật ngữ
                  </Link>
                </div>
              </div>
              {novel.progress ? (
                <Link
                  href={`/doc/${novel.progress.chapterId}`}
                  className="mt-3 block rounded-md bg-slate-900/60 px-3 py-2 text-sm text-amber-100 hover:bg-slate-800"
                >
                  Đang đọc: {novel.progress.chapterTitle}
                </Link>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Chưa có tiến độ — mở một chương từ Thêm.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
