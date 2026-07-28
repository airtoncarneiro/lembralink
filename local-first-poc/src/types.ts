export type ExtractedPage = { title: string; url: string; description: string | null; author: string | null; language: string; content: string };
export type Bookmark = ExtractedPage & { id: string; embedding: number[]; createdAt: string; lastAccessedAt: string | null };
export type BookmarkView = Omit<Bookmark, "embedding" | "content"> & { similarity?: number };
export type ImportCandidate = { title: string; url: string };
export type ImportItem = ImportCandidate & { id: string; status: "pending" | "processing" | "saved" | "failed"; error: string | null };
export type ImportProgress = { status: "idle" | "running" | "done"; total: number; pending: number; processing: number; saved: number; failed: number; currentUrl: string | null; items: ImportItem[] };
export type RequestMessage =
  | { type: "page.extract"; tabId: number }
  | { type: "bookmark.save"; bookmark: Bookmark }
  | { type: "bookmark.search"; embedding: number[]; limit: number }
  | { type: "bookmark.access"; id: string }
  | { type: "bookmark.delete"; id: string }
  | { type: "import.start"; items: ImportCandidate[] }
  | { type: "import.status" };
export type ResponseMessage<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
