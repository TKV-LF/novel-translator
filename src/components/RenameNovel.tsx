"use client";

import { useCallback, useEffect, useState } from "react";

type RenameNovelProps = {
  novelId: string;
  title: string;
  onRenamed: (title: string) => void;
  disabled?: boolean;
  titleAs?: "h1" | "h2" | "none";
  titleClassName?: string;
};

export function RenameNovel({
  novelId,
  title,
  onRenamed,
  disabled = false,
  titleAs = "none",
  titleClassName,
}: RenameNovelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const onStart = useCallback(() => {
    setDraft(title);
    setError("");
    setEditing(true);
  }, [title]);

  const onCancel = useCallback(() => {
    setDraft(title);
    setError("");
    setEditing(false);
  }, [title]);

  const onDraftChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  }, []);

  const onSave = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const next = draft.trim();
      if (!next) {
        setError("Tên truyện không được trống");
        return;
      }
      if (next === title) {
        setEditing(false);
        return;
      }
      setSaving(true);
      setError("");
      try {
        const res = await fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        const data = (await res.json()) as {
          novel?: { title?: string };
          message?: string;
        };
        if (!res.ok) {
          setError(data.message || "Không đổi được tên");
          return;
        }
        onRenamed(data.novel?.title || next);
        setEditing(false);
      } catch {
        setError("Không kết nối được máy chủ");
      } finally {
        setSaving(false);
      }
    },
    [draft, novelId, onRenamed, title]
  );

  const renameButton = (
    <button
      type="button"
      className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
      disabled={disabled}
      onClick={onStart}
    >
      Đổi tên
    </button>
  );

  if (!editing) {
    if (titleAs === "none") {
      return renameButton;
    }
    const Heading = titleAs;
    return (
      <div className="flex flex-wrap items-baseline gap-3">
        <Heading className={titleClassName}>{title || "Đang tải…"}</Heading>
        {title ? renameButton : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="input"
          value={draft}
          onChange={onDraftChange}
          disabled={saving}
          aria-label="Tên truyện"
          autoFocus
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !draft.trim()}
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={onCancel}
          >
            Hủy
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
