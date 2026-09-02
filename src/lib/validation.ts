import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(4).max(100),
});

export const registerSchema = loginSchema.extend({
  inviteCode: z.string().trim().min(1).max(100),
});

export const openUrlSchema = z.object({
  url: z.string().url(),
  novelId: z.string().optional(),
  title: z.string().optional(),
  genre: z.string().default("kiem_hiep"),
  autoTranslate: z.boolean().default(true),
});

export const pasteChapterSchema = z.object({
  novelId: z.string().optional(),
  title: z.string().min(1),
  novelTitle: z.string().optional(),
  genre: z.string().default("kiem_hiep"),
  originalText: z.string().min(1),
  autoTranslate: z.boolean().default(true),
});

export const fromPageSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  originalText: z.string().min(20),
  nextUrl: z.string().url().nullable().optional(),
  prevUrl: z.string().url().nullable().optional(),
  novelTitle: z.string().optional().nullable(),
  novelId: z.string().optional(),
  genre: z.string().default("kiem_hiep"),
  autoTranslate: z.boolean().default(true),
});

export const glossarySchema = z.object({
  novelId: z.string(),
  original: z.string().min(1),
  translated: z.string().min(1),
  type: z
    .enum(["character", "term", "location", "skill", "sect", "item", "other"])
    .default("other"),
});
