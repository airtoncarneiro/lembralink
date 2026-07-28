import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
let extractor: Promise<FeatureExtractionPipeline> | undefined;
export type EmbeddingProgress = { message: string; percentage?: number };

export async function embeddingFor(text: string, onProgress: (progress: EmbeddingProgress) => void) {
  env.allowLocalModels = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = chrome.runtime.getURL("ort/");
    wasm.proxy = false;
  }
  extractor ??= pipeline("feature-extraction", MODEL, { dtype: "q8", progress_callback: (event) => onProgress(progressFrom(event)) }) as unknown as Promise<FeatureExtractionPipeline>;
  onProgress({ message: "Preparando o modelo local…" });
  const model = await extractor;
  const output = await model(text.slice(0, 8_000), { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
function progressFrom(event: { status?: string; file?: string; progress?: number }): EmbeddingProgress {
  if (event.status === "progress" && typeof event.progress === "number") {
    const percentage = Math.max(0, Math.min(100, Math.round(event.progress)));
    return { message: `Baixando modelo local: ${percentage}%`, percentage };
  }
  if (event.status === "ready") return { message: "Modelo local pronto.", percentage: 100 };
  return { message: event.file ? `Preparando ${event.file}…` : "Preparando o modelo local…" };
}
