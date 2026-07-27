import { DEFAULT_MAX_RESULTS, DEFAULT_MIN_SIMILARITY, normalizeSupabaseUrl, type RuntimeConfig } from "./config";
import type { Bookmark, RequestMessage, ResponseMessage } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
let email = "";
let bookmarks: Bookmark[] = [];
let runtimeConfig: RuntimeConfig | null = null;
let resultsMessage = "";
const PENDING_EMAIL_KEY = "smartBookmarks.pendingLoginEmail";

function brand(title = "LembraLink", subtitle = "") {
  return `<div class="brand-title"><img class="brand-icon" src="icons/icon.svg" alt="" /><div><h1>${escape(title)}</h1>${subtitle ? `<small>${escape(subtitle)}</small>` : ""}</div></div>`;
}

async function call<T>(message: RequestMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as ResponseMessage<T>;
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
function escape(text: string) { const element = document.createElement("span"); element.textContent = text; return element.innerHTML; }
function notice(message = "", kind: "error" | "success" = "success") { return `<p class="notice ${kind}">${escape(message)}</p>`; }
function formatDate(value: string | null | undefined) {
  if (!value) return "nunca";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "indisponivel" : new Intl.DateTimeFormat("pt-BR").format(date);
}

function renderConfig(config = runtimeConfig, message = "") {
  app.innerHTML = `${brand("Configurar POC", "Seu ambiente permanece isolado.")}<p>Informe os valores publicos do seu proprio projeto Supabase.</p>
    <form id="config-form"><label>URL do Supabase<input id="supabase-url" type="url" placeholder="https://abc.supabase.co" value="${escape(config?.supabaseUrl ?? "")}" required /></label>
    <label>Chave publishable<input id="publishable-key" type="text" placeholder="sb_publishable_..." value="${escape(config?.publishableKey ?? "")}" required /></label>
    <label>Similaridade minima (0 a 1)<input id="min-similarity" type="number" min="0" max="1" step="0.05" value="${config?.minSimilarity ?? DEFAULT_MIN_SIMILARITY}" required /></label>
    <label>Maximo de resultados (1 a 20)<input id="max-results" type="number" min="1" max="20" step="1" value="${config?.maxResults ?? DEFAULT_MAX_RESULTS}" required /></label>
    <button>Autorizar e salvar</button></form>${notice(message, "error")}`;
  document.querySelector<HTMLFormElement>("#config-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = document.querySelector<HTMLButtonElement>("#config-form button")!; button.disabled = true;
    try {
      const supabaseUrl = normalizeSupabaseUrl(document.querySelector<HTMLInputElement>("#supabase-url")!.value);
      const publishableKey = document.querySelector<HTMLInputElement>("#publishable-key")!.value.trim();
      const minSimilarity = Number(document.querySelector<HTMLInputElement>("#min-similarity")!.value);
      const maxResults = Number(document.querySelector<HTMLInputElement>("#max-results")!.value);
      const granted = await chrome.permissions.request({ origins: [`${supabaseUrl}/*`] });
      if (!granted) throw new Error("Sem essa permissao, a extensao nao consegue acessar seu Supabase.");
      runtimeConfig = await call<RuntimeConfig>({ type: "settings.save", supabaseUrl, publishableKey, minSimilarity, maxResults });
      renderLogin();
    } catch (error) { renderConfig(config, error instanceof Error ? error.message : "Configuracao invalida."); }
  });
}

function renderLogin(message = "", codeRequested = false) {
  app.innerHTML = `<div class="row">${brand("LembraLink", "Salve agora. Encontre quando precisar.")}<button class="secondary" id="settings">Configurar</button></div>
    <form id="login-form"><label>Email<input id="email" type="email" autocomplete="email" required value="${escape(email)}" /></label>
    ${codeRequested ? '<label>Codigo ou link recebido<input id="otp" autocomplete="one-time-code" required placeholder="Cole o codigo ou o link do email" /></label><small>Se o email trouxer um link, copie o link inteiro e cole aqui sem abri-lo.</small>' : ''}
    <button>${codeRequested ? "Entrar" : "Enviar link de acesso"}</button></form>${notice(message, "error")}`;
  document.querySelector<HTMLButtonElement>("#settings")!.addEventListener("click", () => renderConfig(runtimeConfig));
  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = document.querySelector<HTMLButtonElement>("#login-form button")!; button.disabled = true;
    email = document.querySelector<HTMLInputElement>("#email")!.value.trim();
    try {
      if (!codeRequested) {
        await call({ type: "auth.sendOtp", email });
        await chrome.storage.session.set({ [PENDING_EMAIL_KEY]: email });
        renderLogin("", true);
      } else {
        const credential = document.querySelector<HTMLInputElement>("#otp")!.value.trim();
        if (/^https:\/\//i.test(credential)) await call({ type: "auth.verifyMagicLink", link: credential });
        else await call({ type: "auth.verifyOtp", email, token: credential });
        await chrome.storage.session.remove(PENDING_EMAIL_KEY);
        renderApp();
      }
    } catch (error) { renderLogin(error instanceof Error ? error.message : "Falha no login", codeRequested); }
  });
}

function renderBookmarks() {
  const host = document.querySelector<HTMLDivElement>("#results")!;
  const summary = resultsMessage ? `<p><small>${escape(resultsMessage)}</small></p>` : "";
  const cards = bookmarks.map((bookmark) => `<article class="bookmark" data-id="${bookmark.id}"><header><a href="${escape(bookmark.original_url)}" data-open="${bookmark.id}">${escape(bookmark.title)}</a><button class="danger" title="Excluir" data-delete="${bookmark.id}">Excluir</button></header><p>${escape(bookmark.summary)}</p><small>Criação: ${formatDate(bookmark.created_at)} · Últ. acesso: ${formatDate(bookmark.last_accessed_at)}</small><small>Similaridade: ${(bookmark.similarity ?? 0).toFixed(2)}</small><div class="tags">${bookmark.tags.map((tag) => `<span class="tag">${escape(tag)}</span>`).join("")}</div></article>`).join("") || "<p>Nenhum resultado ainda.</p>";
  host.innerHTML = summary + cards;
  host.querySelectorAll<HTMLAnchorElement>("[data-open]").forEach((link) => link.addEventListener("click", async (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const id = link.dataset.open!;
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) return;
    try {
      const result = await call<{ lastAccessedAt: string }>({ type: "bookmark.access", id });
      bookmark.last_accessed_at = result.lastAccessedAt;
      await chrome.tabs.create({ url: bookmark.original_url });
      renderBookmarks();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Nao foi possivel registrar o acesso.", "error"); }
  }));
  host.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.delete!; if (!confirm("Excluir este favorito permanentemente?")) return;
    try { await call({ type: "bookmark.delete", id }); bookmarks = bookmarks.filter((bookmark) => bookmark.id !== id); resultsMessage = ""; renderBookmarks(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Nao foi possivel excluir.", "error"); }
  }));
}
function setStatus(message: string, kind: "error" | "success") { document.querySelector<HTMLDivElement>("#status")!.outerHTML = `<div id="status">${notice(message, kind)}</div>`; }
function renderApp() {
  app.innerHTML = `<div class="row">${brand("LembraLink", email)}<button class="secondary" id="settings">Configurar</button><button class="secondary" id="logout">Sair</button></div>
    <h2>Pagina atual</h2><button id="save">Salvar esta pagina</button><div id="status"></div>
    <h2>Buscar favoritos</h2><form id="search-form" class="row"><input id="query" required placeholder="Ex.: reduzir leituras no Spark" /><button>Buscar</button></form><div id="results"></div>`;
  document.querySelector<HTMLButtonElement>("#settings")!.addEventListener("click", () => renderConfig(runtimeConfig));
  document.querySelector<HTMLButtonElement>("#logout")!.addEventListener("click", async () => { await call({ type: "auth.signOut" }); await chrome.storage.session.remove(PENDING_EMAIL_KEY); email = ""; bookmarks = []; resultsMessage = ""; renderLogin(); });
  document.querySelector<HTMLButtonElement>("#save")!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#save")!; button.disabled = true;
    try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab.id) throw new Error("Aba ativa indisponivel."); await call({ type: "bookmark.save", tabId: tab.id }); setStatus("Favorito salvo com sucesso.", "success"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Falha ao salvar.", "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector<HTMLFormElement>("#search-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const query = document.querySelector<HTMLInputElement>("#query")!.value.trim();
    try {
      if (!runtimeConfig) throw new Error("Configuracao nao encontrada.");
      const config = runtimeConfig;
      const result = await call<{ results: Bookmark[] }>({ type: "bookmark.search", query, limit: config.maxResults });
      const received = result.results;
      bookmarks = received.filter((bookmark) => (bookmark.similarity ?? 0) >= config.minSimilarity);
      resultsMessage = `${bookmarks.length} de ${received.length} resultados atendem a similaridade minima de ${config.minSimilarity.toFixed(2)}.`;
      renderBookmarks();
    }
    catch (error) { setStatus(error instanceof Error ? error.message : "Falha na busca.", "error"); }
  });
  renderBookmarks();
}

void call<RuntimeConfig | null>({ type: "settings.get" }).then((config) => {
  if (!config) { renderConfig(null); return; }
  runtimeConfig = config;
  void call<{ email: string }>({ type: "auth.session" }).then(({ email: activeEmail }) => { email = activeEmail; renderApp(); }).catch(async () => {
    const stored = await chrome.storage.session.get(PENDING_EMAIL_KEY);
    const pendingEmail = stored[PENDING_EMAIL_KEY] as string | undefined;
    if (pendingEmail) { email = pendingEmail; renderLogin("", true); }
    else renderLogin();
  });
}).catch(() => renderConfig(null));
