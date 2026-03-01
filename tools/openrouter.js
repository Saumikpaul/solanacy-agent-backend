/**
 * ARIA v4.0 — OpenRouter Tool
 * Fallback LLM when Groq limit hit. 30+ free models available.
 */

import { markSuccess, markFailed } from './fallback.js';

const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_URL  = 'https://openrouter.ai/api/v1/chat/completions';

// Free models ranked by quality
const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'qwen/qwen-2-7b-instruct:free',
];

export async function openrouterGenerate({ prompt, type = 'text', maxTokens = 2048, modelIndex = 0 }) {
  if (!OR_KEY) return { error: 'OPENROUTER_API_KEY not set' };

  const model = FREE_MODELS[modelIndex] || FREE_MODELS[0];

  const systemPrompt = type === 'code'
    ? 'You are an elite software engineer. Output ONLY code, no markdown fences.'
    : 'You are ARIA, an elite AI assistant.';

  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://solanacy.com',
        'X-Title': 'ARIA v4.0',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      markFailed('openrouter', `HTTP ${res.status}`);

      // Try next model if available
      if (modelIndex < FREE_MODELS.length - 1) {
        console.log(`[OpenRouter] Trying next model (index ${modelIndex + 1})`);
        return openrouterGenerate({ prompt, type, maxTokens, modelIndex: modelIndex + 1 });
      }
      return { error: `OpenRouter error: ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { error: 'Empty response from OpenRouter' };

    markSuccess('openrouter');
    return { result: content, model };

  } catch (e) {
    markFailed('openrouter', e.message);
    return { error: `OpenRouter error: ${e.message}` };
  }
}
