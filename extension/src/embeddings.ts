import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let model: Promise<FeatureExtractionPipeline> | undefined;
export async function embeddingFor(text: string) {
  env.allowLocalModels = false;
  if (env.backends.onnx.wasm) { env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("ort/"); env.backends.onnx.wasm.proxy = false; }
  model ??= pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", { dtype: "q8" }) as unknown as Promise<FeatureExtractionPipeline>;
  const output = await (await model)(text.slice(0, 8_000), { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
