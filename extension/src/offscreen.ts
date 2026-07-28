import { embeddingFor } from "./embeddings";
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "local.embed") return;
  void embeddingFor(message.text).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Falha ao preparar o modelo local." }));
  return true;
});
