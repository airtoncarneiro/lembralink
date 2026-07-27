import { getRuntimeConfig, normalizeSupabaseUrl, saveRuntimeConfig } from "./config";
import { createSupabaseClient } from "./supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { ExtractedPage, RequestMessage, ResponseMessage } from "./types";

async function respond<T>(operation: () => Promise<T>): Promise<ResponseMessage<T>> {
  try { return { ok: true, data: await operation() }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Operacao nao concluida" }; }
}

async function getSupabase() {
  const config = await getRuntimeConfig();
  if (!config) throw new Error("Configure seu projeto Supabase antes de entrar.");
  return createSupabaseClient(config);
}

async function requireSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sessao expirada; entre novamente.");
  return { supabase, session: data.session };
}

async function invoke<T>(body: Record<string, unknown>) {
  const { supabase } = await requireSession();
  const { data, error } = await supabase.functions.invoke("bookmark-service", { body });
  if (error) throw new Error("O servico de favoritos nao respondeu. Tente novamente.");
  return data as T;
}

async function extractFromTab(tabId: number): Promise<ExtractedPage> {
  try { await chrome.tabs.sendMessage(tabId, { type: "content.ping" }); }
  catch { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); }
  const response = await chrome.tabs.sendMessage(tabId, { type: "content.extract" }) as ResponseMessage<ExtractedPage>;
  if (!response?.ok) throw new Error(response?.error ?? "Nao foi possivel ler esta pagina.");
  return response.data;
}

async function handle(message: RequestMessage): Promise<ResponseMessage> {
  if (message.type === "settings.get") return respond(async () => getRuntimeConfig());
  if (message.type === "settings.save") return respond(async () => {
    const origin = normalizeSupabaseUrl(message.supabaseUrl);
    const allowed = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (!allowed) throw new Error("Autorize o acesso ao dominio do seu Supabase para continuar.");
    const previous = await getRuntimeConfig();
    const config = await saveRuntimeConfig({
      supabaseUrl: origin,
      publishableKey: message.publishableKey,
      minSimilarity: message.minSimilarity,
      maxResults: message.maxResults,
    });
    if (previous && previous.supabaseUrl !== origin) {
      await chrome.permissions.remove({ origins: [`${previous.supabaseUrl}/*`] });
    }
    return config;
  });

  if (message.type === "auth.sendOtp") return respond(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOtp({ email: message.email, options: { shouldCreateUser: false } });
    if (error) throw error;
    return null;
  });
  if (message.type === "auth.verifyOtp") return respond(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ email: message.email, token: message.token, type: "email" });
    if (error || !data.session) throw error ?? new Error("Codigo invalido ou expirado.");
    return { email: data.user?.email ?? message.email };
  });
  if (message.type === "auth.verifyMagicLink") return respond(async () => {
    const config = await getRuntimeConfig();
    if (!config) throw new Error("Configure seu projeto Supabase antes de entrar.");
    const link = new URL(message.link.trim());
    if (link.origin !== config.supabaseUrl || link.pathname !== "/auth/v1/verify") {
      throw new Error("Cole o link de login enviado pelo seu projeto Supabase.");
    }
    const tokenHash = link.searchParams.get("token");
    const type = link.searchParams.get("type");
    if (!tokenHash || !type) throw new Error("O link nao contem um token de login valido.");
    const supabase = createSupabaseClient(config);
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (error || !data.session) throw error ?? new Error("Link invalido ou expirado.");
    return { email: data.user?.email ?? "" };
  });
  if (message.type === "auth.session") return respond(async () => {
    const { session } = await requireSession();
    return { email: session.user.email ?? "" };
  });
  if (message.type === "auth.signOut") return respond(async () => { const supabase = await getSupabase(); await supabase.auth.signOut(); return null; });
  if (message.type === "bookmark.save") return respond(async () => invoke({ action: "save", ...await extractFromTab(message.tabId) }));
  if (message.type === "bookmark.search") return respond(async () => invoke({ action: "search", query: message.query, limit: message.limit }));
  if (message.type === "bookmark.access") return respond(async () => invoke({ action: "access", id: message.id }));
  if (message.type === "bookmark.delete") return respond(async () => invoke({ action: "delete", id: message.id }));
  return { ok: false, error: "Mensagem desconhecida." };
}

chrome.runtime.onMessage.addListener((message: RequestMessage, _sender, sendResponse) => {
  void handle(message).then(sendResponse);
  return true;
});
