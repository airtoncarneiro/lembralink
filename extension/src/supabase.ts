import { createClient } from "@supabase/supabase-js";
import type { RuntimeConfig } from "./config";

const storage = {
  async getItem(key: string) {
    const value = await chrome.storage.local.get(key);
    return (value[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string) {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key: string) {
    await chrome.storage.local.remove(key);
  },
};

export function createSupabaseClient(config: RuntimeConfig) {
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
