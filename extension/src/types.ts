export type ExtractedPage = {
  title: string;
  url: string;
  description: string | null;
  author: string | null;
  language: string;
  content: string;
};

export type Bookmark = {
  id: string;
  title: string;
  original_url: string;
  summary: string;
  category: string | null;
  page_type: string | null;
  tags: string[];
  similarity?: number;
  created_at?: string;
  last_accessed_at?: string | null;
  indexed_at?: string;
};

export type RequestMessage =
  | { type: "settings.get" }
  | { type: "settings.save"; supabaseUrl: string; publishableKey: string; minSimilarity: number; maxResults: number }
  | { type: "auth.sendOtp"; email: string }
  | { type: "auth.verifyOtp"; email: string; token: string }
  | { type: "auth.verifyMagicLink"; link: string }
  | { type: "auth.session" }
  | { type: "auth.signOut" }
  | { type: "bookmark.save"; tabId: number }
  | { type: "bookmark.search"; query: string; limit: number }
  | { type: "bookmark.access"; id: string }
  | { type: "bookmark.delete"; id: string };

export type ResponseMessage<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
