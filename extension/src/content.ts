import { Readability } from "@mozilla/readability";
import type { ExtractedPage } from "./types";

const MAX_CHARS = 24_000;

function normalize(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("URL nao suportada");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['gclid', 'fbclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function extractPage(): ExtractedPage {
  if (!/^https?:$/.test(location.protocol)) throw new Error("Esta pagina nao pode ser salva");
  const clone = document.cloneNode(true) as Document;
  clone.querySelectorAll("script,style,noscript,iframe,nav,footer,aside,form,[aria-hidden='true']").forEach((node) => node.remove());
  const article = new Readability(clone, { charThreshold: 200 }).parse();
  const fallback = clone.querySelector("main, article, [role='main']")?.textContent ?? clone.body?.innerText ?? "";
  const content = normalize(article?.textContent ?? fallback).slice(0, MAX_CHARS);
  if (content.length < 200) throw new Error("A pagina nao possui texto util suficiente para salvar");
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  return {
    title: (article?.title || document.title).trim().slice(0, 500),
    url: normalizeUrl(canonical || location.href),
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() ?? null,
    author: article?.byline?.trim() ?? null,
    language: document.documentElement.lang || "und",
    content,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "content.ping") {
    sendResponse({ ok: true });
    return;
  }
  if (message?.type !== "content.extract") return;
  try { sendResponse({ ok: true, data: extractPage() }); }
  catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Falha ao extrair pagina" }); }
});
