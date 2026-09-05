import {
  shubaAdapter,
  twkanAdapter,
  uukanshuAdapter,
  uureadAdapter,
} from "./adapters";
import type { ParsedChapter, SiteAdapter } from "./types";
import { wikicvAdapter } from "./wikicv";

const adapters: SiteAdapter[] = [
  shubaAdapter,
  uukanshuAdapter,
  twkanAdapter,
  uureadAdapter,
  wikicvAdapter,
];

export function resolveAdapter(urlOrHost: string): SiteAdapter | null {
  let hostname = urlOrHost;
  try {
    hostname = new URL(urlOrHost).hostname;
  } catch {
    // treat as hostname
  }
  return adapters.find((a) => a.matches(hostname)) ?? null;
}

export function parseWithAdapter(url: string, html: string): ParsedChapter {
  const adapter = resolveAdapter(url);
  if (!adapter) {
    throw new Error("UNSUPPORTED_SITE");
  }
  return adapter.parseChapter(html, url);
}

export { adapters };
