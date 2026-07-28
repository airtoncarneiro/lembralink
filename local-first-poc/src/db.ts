import type { Bookmark, BookmarkView, ImportCandidate, ImportItem, ImportProgress } from "./types";

const DB_NAME = "lembralink-local-first";
const STORE = "bookmarks";
const IMPORT_STORE = "import-items";
const IMPORT_STATUS_STORE = "import-status";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IMPORT_STORE)) db.createObjectStore(IMPORT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IMPORT_STATUS_STORE)) db.createObjectStore(IMPORT_STATUS_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const cosine = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
const view = (bookmark: Bookmark, similarity?: number): BookmarkView => { const { embedding: _embedding, content: _content, ...result } = bookmark; return { ...result, similarity }; };

export async function saveBookmark(bookmark: Bookmark) {
  const existing = (await transaction<Bookmark[]>("readonly", (store) => store.getAll())).find((item) => item.url === bookmark.url);
  const stored = existing ? { ...bookmark, id: existing.id, createdAt: existing.createdAt, lastAccessedAt: existing.lastAccessedAt } : bookmark;
  await transaction("readwrite", (store) => store.put(stored));
  return view(stored);
}
export async function searchBookmarks(embedding: number[], limit: number) {
  const entries = await transaction<Bookmark[]>("readonly", (store) => store.getAll());
  return entries.map((bookmark) => view(bookmark, cosine(embedding, bookmark.embedding))).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, limit);
}
export async function accessBookmark(id: string) {
  const bookmark = await transaction<Bookmark | undefined>("readonly", (store) => store.get(id));
  if (!bookmark) throw new Error("Favorito não encontrado.");
  bookmark.lastAccessedAt = new Date().toISOString();
  await transaction("readwrite", (store) => store.put(bookmark));
  return { lastAccessedAt: bookmark.lastAccessedAt };
}
export async function deleteBookmark(id: string) { await transaction("readwrite", (store) => store.delete(id)); }

async function importTransaction<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function allImportItems() { return importTransaction<ImportItem[]>(IMPORT_STORE, "readonly", (store) => store.getAll()); }
export async function startImport(candidates: ImportCandidate[]) {
  const db = await openDb();
  const now = new Date().toISOString();
  const items: ImportItem[] = candidates.map((candidate) => ({ ...candidate, id: crypto.randomUUID(), status: "pending", error: null }));
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([IMPORT_STORE, IMPORT_STATUS_STORE], "readwrite");
    transaction.objectStore(IMPORT_STORE).clear();
    transaction.objectStore(IMPORT_STATUS_STORE).clear();
    for (const item of items) transaction.objectStore(IMPORT_STORE).put(item);
    transaction.objectStore(IMPORT_STATUS_STORE).put({ id: "current", status: "running", currentUrl: null, startedAt: now });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  return getImportProgress();
}
export async function getNextImportItem() {
  const items = await allImportItems();
  const item = items.find((candidate) => candidate.status === "pending");
  if (!item) return null;
  item.status = "processing";
  await importTransaction(IMPORT_STORE, "readwrite", (store) => store.put(item));
  await importTransaction(IMPORT_STATUS_STORE, "readwrite", (store) => store.put({ id: "current", status: "running", currentUrl: item.url }));
  return item;
}
export async function completeImportItem(id: string, error: string | null) {
  const item = await importTransaction<ImportItem | undefined>(IMPORT_STORE, "readonly", (store) => store.get(id));
  if (!item) return;
  item.status = error ? "failed" : "saved";
  item.error = error;
  await importTransaction(IMPORT_STORE, "readwrite", (store) => store.put(item));
}
export async function resumeImport() {
  const interrupted = (await allImportItems()).filter((item) => item.status === "processing");
  await Promise.all(interrupted.map((item) => importTransaction(IMPORT_STORE, "readwrite", (store) => store.put({ ...item, status: "pending" }))));
  return getImportProgress();
}
export async function getImportProgress(): Promise<ImportProgress> {
  const [items, state] = await Promise.all([allImportItems(), importTransaction<{ id: string; status: ImportProgress["status"]; currentUrl: string | null } | undefined>(IMPORT_STATUS_STORE, "readonly", (store) => store.get("current"))]);
  const count = (status: ImportItem["status"]) => items.filter((item) => item.status === status).length;
  const pending = count("pending"); const processing = count("processing");
  const status = state?.status === "running" && pending + processing === 0 ? "done" : state?.status ?? "idle";
  if (state?.status === "running" && status === "done") await importTransaction(IMPORT_STATUS_STORE, "readwrite", (store) => store.put({ ...state, status, currentUrl: null }));
  return { status, total: items.length, pending, processing, saved: count("saved"), failed: count("failed"), currentUrl: state?.currentUrl ?? null, items };
}
