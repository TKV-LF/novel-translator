export const PENDING_NOVEL_KEY = "nt-pending-novel";

export type PendingNovel = {
  novelId: string;
  genre: string;
};

export function setPendingNovel(pending: PendingNovel): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(pending);
  sessionStorage.setItem(PENDING_NOVEL_KEY, raw);
  localStorage.setItem(PENDING_NOVEL_KEY, raw);
}

export function getPendingNovel(): PendingNovel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(PENDING_NOVEL_KEY) ||
      localStorage.getItem(PENDING_NOVEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingNovel>;
    if (!parsed.novelId || !parsed.genre) return null;
    return { novelId: parsed.novelId, genre: parsed.genre };
  } catch {
    return null;
  }
}
