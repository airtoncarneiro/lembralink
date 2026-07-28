export type RuntimeConfig = {
  supabaseUrl: string;
  publishableKey: string;
  minSimilarity: number;
  maxResults: number;
};

import type { UsageMode } from "./types";

const CONFIG_KEY = "smartBookmarks.runtimeConfig";
const MODE_KEY = "smartBookmarks.usageMode";
export const DEFAULT_MIN_SIMILARITY = 0.55;
export const DEFAULT_MAX_RESULTS = 10;

export function normalizeSupabaseUrl(raw: string) {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.pathname !== "/") {
    throw new Error("Informe a URL HTTPS raiz de um projeto Supabase.");
  }
  return url.origin;
}

export function validateConfig(value: RuntimeConfig): RuntimeConfig {
  const supabaseUrl = normalizeSupabaseUrl(value.supabaseUrl);
  const publishableKey = value.publishableKey.trim();
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Informe uma chave publishable do Supabase.");
  }
  const minSimilarity = Number(value.minSimilarity);
  if (!Number.isFinite(minSimilarity) || minSimilarity < 0 || minSimilarity > 1) {
    throw new Error("A similaridade minima deve estar entre 0 e 1.");
  }
  const maxResults = Number(value.maxResults);
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
    throw new Error("A quantidade de resultados deve ser um numero inteiro entre 1 e 20.");
  }
  return { supabaseUrl, publishableKey, minSimilarity, maxResults };
}

export async function getRuntimeConfig(): Promise<RuntimeConfig | null> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const value = stored[CONFIG_KEY] as Partial<RuntimeConfig> | undefined;
  if (!value) return null;
  try {
    return validateConfig({
      supabaseUrl: value.supabaseUrl ?? "",
      publishableKey: value.publishableKey ?? "",
      minSimilarity: value.minSimilarity ?? DEFAULT_MIN_SIMILARITY,
      maxResults: value.maxResults ?? DEFAULT_MAX_RESULTS,
    });
  }
  catch { return null; }
}

export async function saveRuntimeConfig(value: RuntimeConfig) {
  const config = validateConfig(value);
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  return config;
}

export async function getUsageMode(): Promise<UsageMode> {
  const stored = await chrome.storage.local.get(MODE_KEY);
  return stored[MODE_KEY] === "online" ? "online" : "local";
}
export async function saveUsageMode(mode: UsageMode) { await chrome.storage.local.set({ [MODE_KEY]: mode }); return mode; }
