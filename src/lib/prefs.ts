export type ReaderPrefs = {
  autoTranslate: boolean;
  fontSize: number;
  theme: "dark" | "light" | "system";
  defaultGenre: string;
};

const STORAGE_KEY = "novel-translator-prefs";

export const DEFAULT_PREFS: ReaderPrefs = {
  autoTranslate: true,
  fontSize: 18,
  theme: "dark",
  defaultGenre: "kiem_hiep",
};

export function loadPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      autoTranslate:
        typeof parsed.autoTranslate === "boolean"
          ? parsed.autoTranslate
          : DEFAULT_PREFS.autoTranslate,
      fontSize:
        typeof parsed.fontSize === "number"
          ? parsed.fontSize
          : DEFAULT_PREFS.fontSize,
      theme:
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
          ? parsed.theme
          : DEFAULT_PREFS.theme,
      defaultGenre:
        typeof parsed.defaultGenre === "string"
          ? parsed.defaultGenre
          : DEFAULT_PREFS.defaultGenre,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ReaderPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function updatePrefs(partial: Partial<ReaderPrefs>): ReaderPrefs {
  const next = { ...loadPrefs(), ...partial };
  savePrefs(next);
  return next;
}
