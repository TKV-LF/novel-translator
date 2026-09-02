import type { GlossaryType } from "@prisma/client";
import { db } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { DEFAULT_PROMPTS, GLOSSARY_EXTRACT_PROMPT } from "@/lib/prompts";
import type { GenreKey } from "@/lib/types";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 8192;
const RETRIES = 2;

type GlossaryItem = {
  original: string;
  translated: string;
  type?: string;
};

type ChatResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
};

function buildGlossaryBlock(glossary: GlossaryItem[]): string {
  if (!glossary.length) return "";
  const lines = glossary.map(
    (g) => `- ${g.original} → ${g.translated}${g.type ? ` (${g.type})` : ""}`
  );
  return `\n\nTHUẬT NGỮ / TÊN RIÊNG CỦA TRUYỆN (bắt buộc nhất quán):\n${lines.join("\n")}`;
}

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const inCost = (inputTokens / 1_000_000) * 0.14;
  const outCost = (outputTokens / 1_000_000) * 0.28;
  return Number((inCost + outCost).toFixed(6));
}

export function userFacingTranslateError(code: string): string {
  switch (code) {
    case "MISSING_API_KEY":
      return "Chưa cấu hình DEEPSEEK_API_KEY trên server.";
    case "INVALID_API_KEY":
      return "API key DeepSeek không hợp lệ.";
    case "INSUFFICIENT_BALANCE":
      return "Tài khoản DeepSeek hết credit / chưa nạp tiền. Nạp thêm rồi thử lại.";
    case "RATE_LIMIT":
      return "DeepSeek đang giới hạn tốc độ. Thử lại sau.";
    case "TIMEOUT":
      return "Dịch quá lâu (timeout). Thử lại sau.";
    case "CHAPTER_NOT_FOUND":
      return "Không tìm thấy chương.";
    default:
      return "Không thể dịch chương lúc này.";
  }
}

async function callDeepSeek(
  system: string,
  user: string,
  attempt = 0
): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("INVALID_API_KEY");
    }
    if (res.status === 402) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
    if (res.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (!res.ok) {
      throw new Error(`DEEPSEEK_${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new Error("EMPTY_TRANSLATION");
    }

    return {
      content,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      if (attempt < RETRIES) {
        return callDeepSeek(system, user, attempt + 1);
      }
      throw new Error("TIMEOUT");
    }
    if (
      err instanceof Error &&
      (err.message === "RATE_LIMIT" || err.message.startsWith("DEEPSEEK_5")) &&
      attempt < RETRIES
    ) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return callDeepSeek(system, user, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseGlossaryJson(raw: string): GlossaryItem[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is GlossaryItem =>
          !!x &&
          typeof x === "object" &&
          typeof (x as GlossaryItem).original === "string" &&
          typeof (x as GlossaryItem).translated === "string"
      )
      .map((x) => ({
        original: x.original.trim(),
        translated: x.translated.trim(),
        type: typeof x.type === "string" ? x.type : "other",
      }))
      .filter((x) => x.original && x.translated);
  } catch {
    return [];
  }
}

const VALID_TYPES = new Set([
  "character",
  "term",
  "location",
  "skill",
  "sect",
  "item",
  "other",
]);

async function mergeGlossary(
  novelId: string,
  chapterId: string | undefined,
  items: GlossaryItem[]
) {
  for (const item of items) {
    const type = (
      item.type && VALID_TYPES.has(item.type) ? item.type : "other"
    ) as GlossaryType;
    try {
      await db.glossaryEntry.upsert({
        where: {
          novelId_original: {
            novelId,
            original: item.original,
          },
        },
        create: {
          novelId,
          original: item.original,
          translated: item.translated,
          type,
          firstChapterId: chapterId ?? null,
        },
        update: {},
      });
    } catch {
      // skip duplicates / race
    }
  }
}

export type TranslateInput = {
  originalText: string;
  genre: string;
  glossary: GlossaryItem[];
  chapterId?: string;
  novelId?: string;
};

export type TranslateResult = {
  translatedText: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export async function translateChapter(
  input: TranslateInput
): Promise<TranslateResult> {
  const genre = (input.genre in DEFAULT_PROMPTS
    ? input.genre
    : "kiem_hiep") as GenreKey;

  let systemPrompt =
    (await db.systemPrompt.findUnique({ where: { genre } }))?.promptText ??
    DEFAULT_PROMPTS[genre];

  systemPrompt += buildGlossaryBlock(input.glossary);

  const chunks = chunkText(input.originalText, 3000);
  const parts: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const userMsg =
      chunks.length > 1
        ? `Dịch đoạn ${i + 1}/${chunks.length} sau đây sang tiếng Việt:\n\n${chunks[i]}`
        : `Dịch đoạn sau sang tiếng Việt:\n\n${chunks[i]}`;
    const result = await callDeepSeek(systemPrompt, userMsg);
    parts.push(result.content);
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
  }

  const translatedText = parts.join("\n\n");
  const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);

  await db.apiUsage.create({
    data: {
      chapterId: input.chapterId ?? null,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    },
  });

  if (input.novelId) {
    try {
      const extract = await callDeepSeek(
        GLOSSARY_EXTRACT_PROMPT,
        `GỐC:\n${input.originalText.slice(0, 6000)}\n\nDỊCH:\n${translatedText.slice(0, 6000)}`
      );
      const items = parseGlossaryJson(extract.content);
      await mergeGlossary(input.novelId, input.chapterId, items);
      await db.apiUsage.create({
        data: {
          chapterId: input.chapterId ?? null,
          inputTokens: extract.inputTokens,
          outputTokens: extract.outputTokens,
          estimatedCostUsd: estimateCostUsd(
            extract.inputTokens,
            extract.outputTokens
          ),
        },
      });
    } catch {
      // glossary extract is optional
    }
  }

  return {
    translatedText,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
  };
}

export async function retranslate(
  chapterId: string
): Promise<TranslateResult & { chapterId: string }> {
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: {
      novel: true,
    },
  });
  if (!chapter) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  const glossary = await db.glossaryEntry.findMany({
    where: { novelId: chapter.novelId },
    select: { original: true, translated: true, type: true },
  });

  const result = await translateChapter({
    originalText: chapter.originalText,
    genre: chapter.novel.genre,
    glossary: glossary.map((g) => ({
      original: g.original,
      translated: g.translated,
      type: g.type,
    })),
    chapterId: chapter.id,
    novelId: chapter.novelId,
  });

  await db.chapter.update({
    where: { id: chapter.id },
    data: { translatedText: result.translatedText },
  });

  return { ...result, chapterId: chapter.id };
}
