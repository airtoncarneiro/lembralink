import { accessBookmark, completeImportItem, deleteBookmark, getImportProgress, getNextImportItem, resumeImport, saveBookmark, searchBookmarks, startImport } from "./db";
import type { Bookmark, ExtractedPage, ImportItem, RequestMessage, ResponseMessage } from "./types";

const IMPORT_ALARM = "lembralink-next-import";

async function respond<T>(operation: () => Promise<T>): Promise<ResponseMessage<T>> { try { return { ok: true, data: await operation() }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Operação não concluída" }; } }
async function extractFromTab(tabId: number): Promise<ExtractedPage> {
  try { await chrome.tabs.sendMessage(tabId, { type: "content.extract" }); }
  catch { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); }
  const response = await chrome.tabs.sendMessage(tabId, { type: "content.extract" }) as ResponseMessage<ExtractedPage>;
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
function scheduleNextImport(delayMs = 750) { chrome.alarms.create(IMPORT_ALARM, { when: Date.now() + delayMs }); }
async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: [chrome.offscreen.Reason.WORKERS], justification: "Gerar embeddings locais durante a importação em lote." });
}
async function embeddingFromOffscreen(text: string) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "offscreen.embed", text }) as ResponseMessage<number[]>;
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
async function waitForTabLoad(tabId: number, timeoutMs = 30_000) {
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const done = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => done(new Error("Tempo esgotado ao carregar a página.")), timeoutMs);
    const listener = (updatedId: number, changeInfo: chrome.tabs.TabChangeInfo) => { if (updatedId === tabId && changeInfo.status === "complete") done(); };
    chrome.tabs.onUpdated.addListener(listener);
    void chrome.tabs.get(tabId).then((tab) => { if (tab.status === "complete") done(); }).catch(() => done(new Error("A aba de importação foi fechada.")));
  });
}
async function importItem(item: ImportItem) {
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: item.url, active: false });
    if (!tab.id) throw new Error("Não foi possível abrir a página.");
    tabId = tab.id;
    await waitForTabLoad(tabId);
    const page = await extractFromTab(tabId);
    const embedding = await embeddingFromOffscreen(`${page.title}\n${page.description ?? ""}\n${page.content}`);
    const bookmark: Bookmark = { ...page, id: crypto.randomUUID(), embedding, createdAt: new Date().toISOString(), lastAccessedAt: null };
    await saveBookmark(bookmark);
    await completeImportItem(item.id, null);
  } catch (error) {
    await completeImportItem(item.id, error instanceof Error ? error.message : "Falha ao importar a página.");
  } finally {
    if (tabId !== undefined) await chrome.tabs.remove(tabId).catch(() => undefined);
  }
}
async function processNextImport() {
  const item = await getNextImportItem();
  if (!item) { await getImportProgress(); return; }
  await importItem(item);
  scheduleNextImport();
}
async function handle(message: RequestMessage): Promise<ResponseMessage> {
  if (message.type === "page.extract") return respond(() => extractFromTab(message.tabId));
  if (message.type === "bookmark.save") return respond(() => saveBookmark(message.bookmark));
  if (message.type === "bookmark.search") return respond(() => searchBookmarks(message.embedding, message.limit));
  if (message.type === "bookmark.access") return respond(() => accessBookmark(message.id));
  if (message.type === "bookmark.delete") return respond(() => deleteBookmark(message.id));
  if (message.type === "import.status") return respond(() => getImportProgress());
  if (message.type === "import.start") return respond(async () => { const progress = await startImport(message.items); scheduleNextImport(50); return progress; });
  return { ok: false, error: "Mensagem desconhecida." };
}
chrome.runtime.onMessage.addListener((message: RequestMessage, _sender, sendResponse) => { void handle(message).then(sendResponse); return true; });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === IMPORT_ALARM) void processNextImport(); });
void resumeImport().then((progress) => { if (progress.status === "running") scheduleNextImport(); });
