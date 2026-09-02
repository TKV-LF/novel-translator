"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const TYPES = [
  "character",
  "term",
  "location",
  "skill",
  "sect",
  "item",
  "other",
] as const;

type Entry = {
  id: string;
  original: string;
  translated: string;
  type: string;
};

const TYPE_LABEL: Record<string, string> = {
  character: "Nhân vật",
  term: "Thuật ngữ",
  location: "Địa danh",
  skill: "Công pháp",
  sect: "Môn phái",
  item: "Vật phẩm",
  other: "Khác",
};

export default function ThuatNguPage() {
  const params = useParams<{ novelId: string }>();
  const novelId = params.novelId;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [original, setOriginal] = useState("");
  const [translated, setTranslated] = useState("");
  const [type, setType] = useState<string>("character");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `&type=${filter}` : "";
      const res = await fetch(`/api/glossary?novelId=${novelId}${q}`);
      const data = (await res.json()) as { entries?: Entry[]; message?: string };
      if (!res.ok) {
        setError(data.message || "Không tải được thuật ngữ");
        return;
      }
      setEntries(data.entries || []);
      setError("");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }, [novelId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, original, translated, type }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message || "Không thêm được");
        return;
      }
      setOriginal("");
      setTranslated("");
      await load();
    },
    [novelId, original, translated, type, load]
  );

  const onDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/glossary/${id}`, { method: "DELETE" });
      await load();
    },
    [load]
  );

  const onEdit = useCallback(
    async (entry: Entry) => {
      const nextOriginal = window.prompt("Gốc (Hán)", entry.original);
      if (nextOriginal === null) return;
      const nextTranslated = window.prompt("Dịch", entry.translated);
      if (nextTranslated === null) return;
      await fetch(`/api/glossary/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: nextOriginal.trim() || entry.original,
          translated: nextTranslated.trim() || entry.translated,
        }),
      });
      await load();
    },
    [load]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-serif text-2xl text-amber-100">Thuật ngữ</h1>
        <Link href="/thu-vien" className="btn btn-ghost">
          ← Thư viện
        </Link>
      </div>

      <div className="mb-4">
        <label className="label" htmlFor="filter">
          Lọc theo loại
        </label>
        <select
          id="filter"
          className="select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tất cả</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={onAdd} className="panel mb-6 space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-300">Thêm mục</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            placeholder="Gốc (Hán)"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Dịch Việt"
            value={translated}
            onChange={(e) => setTranslated(e.target.value)}
            required
          />
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Thêm
        </button>
      </form>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-slate-400">Đang tải…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500">Chưa có thuật ngữ.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div>
                <span className="font-medium text-slate-100">
                  {entry.original}
                </span>
                <span className="mx-2 text-slate-500">→</span>
                <span className="text-amber-100">{entry.translated}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {TYPE_LABEL[entry.type] || entry.type}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onEdit(entry)}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onDelete(entry.id)}
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
