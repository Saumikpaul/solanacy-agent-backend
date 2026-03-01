/**
 * ARIA v4.0 — HuggingFace Tool
 * Model inference, model search, dataset access
 */

import { markSuccess, markFailed } from './fallback.js';

const HF_TOKEN = process.env.HF_TOKEN;
const HF_API   = 'https://api-inference.huggingface.co/models';

/**
 * Run inference on any HuggingFace model
 */
export async function hfInfer({ model, inputs, parameters = {} }) {
  if (!HF_TOKEN) return { error: 'HF_TOKEN not set' };

  try {
    const res = await fetch(`${HF_API}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs, parameters }),
    });

    if (res.status === 503) {
      // Model is loading
      return { error: 'Model loading, try again in 20 seconds', loading: true };
    }

    if (!res.ok) {
      markFailed('huggingface', `HTTP ${res.status}`);
      return { error: `HF inference error: ${res.status}` };
    }

    const data = await res.json();
    markSuccess('huggingface');
    return { result: data };

  } catch (e) {
    markFailed('huggingface', e.message);
    return { error: `HF inference error: ${e.message}` };
  }
}

/**
 * Text generation using free HF models
 */
export async function hfTextGenerate({ prompt, maxTokens = 500 }) {
  return hfInfer({
    model: 'mistralai/Mistral-7B-Instruct-v0.3',
    inputs: prompt,
    parameters: { max_new_tokens: maxTokens, temperature: 0.7, return_full_text: false },
  });
}

/**
 * Image classification
 */
export async function hfClassifyImage({ imageUrl }) {
  // Fetch image as base64
  try {
    const imgRes = await fetch(imageUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return hfInfer({
      model: 'google/vit-base-patch16-224',
      inputs: base64,
    });
  } catch (e) {
    return { error: `Image fetch error: ${e.message}` };
  }
}

/**
 * OCR — extract text from image (handwriting, printed)
 */
export async function hfOCR({ imageUrl }) {
  try {
    const imgRes = await fetch(imageUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return hfInfer({
      model: 'microsoft/trocr-base-handwritten',
      inputs: base64,
    });
  } catch (e) {
    return { error: `OCR error: ${e.message}` };
  }
}

/**
 * Search for models on HuggingFace
 */
export async function hfSearchModels({ query, task = '', limit = 10 }) {
  try {
    const params = new URLSearchParams({ search: query, limit });
    if (task) params.set('filter', task);

    const res = await fetch(`https://huggingface.co/api/models?${params}`, {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
    });

    if (!res.ok) return { error: `HF search error: ${res.status}` };

    const data = await res.json();
    markSuccess('huggingface');

    return {
      models: data.slice(0, limit).map(m => ({
        id: m.id,
        task: m.pipeline_tag,
        downloads: m.downloads,
        likes: m.likes,
        url: `https://huggingface.co/${m.id}`,
      })),
    };

  } catch (e) {
    return { error: `HF search error: ${e.message}` };
  }
}

/**
 * Search for datasets on HuggingFace
 */
export async function hfSearchDatasets({ query, limit = 10 }) {
  try {
    const res = await fetch(`https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
    });

    if (!res.ok) return { error: `HF dataset search error: ${res.status}` };

    const data = await res.json();
    return {
      datasets: data.slice(0, limit).map(d => ({
        id: d.id,
        downloads: d.downloads,
        likes: d.likes,
        url: `https://huggingface.co/datasets/${d.id}`,
      })),
    };

  } catch (e) {
    return { error: `HF dataset search error: ${e.message}` };
  }
}
