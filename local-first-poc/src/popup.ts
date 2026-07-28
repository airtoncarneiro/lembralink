import { embeddingFor, type EmbeddingProgress } from "./embeddings";
import type { Bookmark, BookmarkView, ExtractedPage, ImportCandidate, ImportProgress, RequestMessage, ResponseMessage } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
let bookmarks: BookmarkView[] = [];
let importCandidates: ImportCandidate[] = [];
const escape = (text: string) => { const element = document.createElement("span"); element.textContent = text; return element.innerHTML; };
const notice = (message = "", kind: "error" | "success" = "success", percentage?: number) => `<div class="notice ${kind}"><span>${escape(message)}</span>${percentage === undefined ? "" : `<progress max="100" value="${percentage}">${percentage}%</progress>`}</div>`;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "nunca";
async function call<T>(message: RequestMessage): Promise<T> { const response = await chrome.runtime.sendMessage(message) as ResponseMessage<T>; if (!response.ok) throw new Error(response.error); return response.data; }
function setStatus(message: string, kind: "error" | "success", percentage?: number) { document.querySelector<HTMLDivElement>("#status")!.innerHTML = notice(message, kind, percentage); }
function showEmbeddingProgress({ message, percentage }: EmbeddingProgress) { setStatus(message, "success", percentage); }

function normalizeImportUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("URL não suportada");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ["gclid", "fbclid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  return url.toString();
}
function parseBookmarkHtml(html: string): ImportCandidate[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    try {
      const url = normalizeImportUrl(link.href);
      if (!seen.has(url)) { seen.add(url); candidates.push({ url, title: link.textContent?.trim() || new URL(url).hostname }); }
    } catch { /* Ignora URLs não HTTP, como pastas e comandos do navegador. */ }
  });
  return candidates;
}
function renderResults() {
  const host = document.querySelector<HTMLDivElement>("#results")!;
  host.innerHTML = bookmarks.map((bookmark) => `<article class="bookmark"><header><a href="${escape(bookmark.url)}" data-open="${bookmark.id}">${escape(bookmark.title)}</a><button class="danger" data-delete="${bookmark.id}">Excluir</button></header><p>${escape(bookmark.description ?? "Sem descrição")}</p><small>Criação: ${formatDate(bookmark.createdAt)} · Similaridade: ${(bookmark.similarity ?? 0).toFixed(2)}</small></article>`).join("") || "<p>Nenhum resultado ainda.</p>";
  host.querySelectorAll<HTMLAnchorElement>("[data-open]").forEach((link) => link.addEventListener("click", async (event) => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); await call({ type: "bookmark.access", id: link.dataset.open! }); await chrome.tabs.create({ url: link.href }); }));
  host.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => button.addEventListener("click", async () => { if (!confirm("Excluir este favorito permanentemente?")) return; await call({ type: "bookmark.delete", id: button.dataset.delete! }); bookmarks = bookmarks.filter((bookmark) => bookmark.id !== button.dataset.delete); renderResults(); }));
}
function renderImportProgress(progress: ImportProgress) {
  const host = document.querySelector<HTMLDivElement>("#import-status")!;
  if (!progress.total) { host.innerHTML = ""; return; }
  const completed = progress.saved + progress.failed;
  const percentage = Math.round((completed / progress.total) * 100);
  const failures = progress.items.filter((item) => item.status === "failed").slice(0, 3).map((item) => `<li>${escape(item.title)}: ${escape(item.error ?? "falha desconhecida")}</li>`).join("");
  host.innerHTML = `<div class="notice ${progress.failed ? "error" : "success"}"><span>${progress.status === "done" ? "Importação concluída." : "Importando em segundo plano…"} ${completed}/${progress.total} processados; ${progress.saved} salvos; ${progress.failed} falharam.</span><progress max="100" value="${percentage}">${percentage}%</progress>${progress.currentUrl ? `<small>${escape(progress.currentUrl)}</small>` : ""}${failures ? `<details><summary>Ver falhas</summary><ul>${failures}</ul></details>` : ""}</div>`;
}
async function refreshImportProgress() { try { renderImportProgress(await call<ImportProgress>({ type: "import.status" })); } catch { /* O popup pode ser fechado enquanto o service worker reinicia. */ } }

function render() {
  app.innerHTML = `<h1>LembraLink Local-first</h1><p>Seus favoritos e vetores ficam neste navegador. No primeiro uso, um modelo local será baixado.</p><h2>Página atual</h2><button id="save">Salvar esta página</button><div id="status"></div><h2>Importar favoritos</h2><p>Exporte seus favoritos pelo Chrome em HTML. O lote abre uma página por vez e só acessa os sites após sua autorização.</p><form id="import-form"><label>Arquivo de favoritos HTML<input id="bookmark-file" type="file" accept=".html,text/html" required /></label><small id="import-preview"></small><label>Máximo de links neste lote<input id="import-limit" type="number" min="1" max="500" value="50" required /></label><button id="import-button">Autorizar e importar</button></form><div id="import-status"></div><h2>Buscar favoritos</h2><form id="search" class="row"><input id="query" required placeholder="Ex.: reduzir leituras no Spark" /><button>Buscar</button></form><div id="results"></div>`;
  document.querySelector<HTMLButtonElement>("#save")!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#save")!; button.disabled = true;
    try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab.id) throw new Error("Aba ativa indisponível."); const page = await call<ExtractedPage>({ type: "page.extract", tabId: tab.id }); const embedding = await embeddingFor(`${page.title}\n${page.description ?? ""}\n${page.content}`, showEmbeddingProgress); const bookmark: Bookmark = { ...page, id: crypto.randomUUID(), embedding, createdAt: new Date().toISOString(), lastAccessedAt: null }; await call({ type: "bookmark.save", bookmark }); setStatus("Favorito salvo localmente.", "success", 100); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Falha ao salvar.", "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector<HTMLInputElement>("#bookmark-file")!.addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = (input.files ?? [])[0]; if (!file) return;
    importCandidates = parseBookmarkHtml(await file.text());
    document.querySelector<HTMLDivElement>("#import-preview")!.textContent = `${importCandidates.length} links HTTP(S) únicos encontrados.`;
  });
  document.querySelector<HTMLFormElement>("#import-form")!.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = document.querySelector<HTMLButtonElement>("#import-button")!; button.disabled = true;
    try {
      if (!importCandidates.length) throw new Error("Selecione um arquivo HTML de favoritos válido.");
      const limit = Number(document.querySelector<HTMLInputElement>("#import-limit")!.value);
      const permitted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      if (!permitted) throw new Error("A autorização para acessar os links é necessária para importar o lote.");
      await call<ImportProgress>({ type: "import.start", items: importCandidates.slice(0, limit) });
      await refreshImportProgress();
    } catch (error) { document.querySelector<HTMLDivElement>("#import-status")!.innerHTML = notice(error instanceof Error ? error.message : "Não foi possível iniciar a importação.", "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector<HTMLFormElement>("#search")!.addEventListener("submit", async (event) => { event.preventDefault(); const query = document.querySelector<HTMLInputElement>("#query")!.value.trim(); try { const embedding = await embeddingFor(query, showEmbeddingProgress); bookmarks = await call<BookmarkView[]>({ type: "bookmark.search", embedding, limit: 10 }); renderResults(); } catch (error) { setStatus(error instanceof Error ? error.message : "Falha na busca.", "error"); } });
  renderResults();
  void refreshImportProgress();
  window.setInterval(() => void refreshImportProgress(), 1_500);
}
render();
