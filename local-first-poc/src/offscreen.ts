import { embeddingFor } from "./embeddings";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "offscreen.embed") return;
  void embeddingFor(message.text, () => {}).then((embedding) => sendResponse({ ok: true, data: embedding })).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Falha ao gerar embedding local." }));
  return true;
});
