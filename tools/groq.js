/**
 * ARIA v4.0 — Groq Tool
 * Fast code generation & text tasks using Groq (free, 14,400 req/day)
 * Models: llama-3.3-70b-versatile, mixtral-8x7b-32768
 */

import { markSuccess, markFailed } from './fallback.js';

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Generate code or text using Groq
 * @param {string} prompt - What to generate
 * @param {string} type - 'code' | 'text' | 'json'
 * @param {string} language - For code: 'javascript', 'python', etc.
 */
export async function groqGenerate({ prompt, type = 'text', language = 'javascript', maxTokens = 4096 }) {
  if (!GROQ_KEY) return { error: 'GROQ_API_KEY not set' };

  const systemPrompt = type === 'code'
    ? `You are an elite software engineer. Generate clean, production-ready ${language} code. 
       Output ONLY the code, no explanations, no markdown fences.`
    : type === 'json'
    ? `You are a data generator. Respond ONLY with valid JSON, no markdown, no explanation.`
    : `You are ARIA, an elite AI assistant for Solanacy Technologies.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: type === 'code' ? 0.2 : 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      markFailed('groq', `HTTP ${res.status}: ${err.slice(0, 100)}`);
      return { error: `Groq error: ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { error: 'Empty response from Groq' };

    markSuccess('groq');
    return { result: content, model: data.model, tokens: data.usage?.total_tokens };

  } catch (e) {
    markFailed('groq', e.message);
    return { error: `Groq fetch error: ${e.message}` };
  }
}

/**
 * Review code for bugs using Groq
 */
export async function groqReviewCode({ code, language = 'javascript' }) {
  const prompt = `Review this ${language} code for bugs, security issues, and improvements.
Be concise. List issues only if found. Format: [ISSUE TYPE]: description

CODE:
${code.slice(0, 8000)}`;

  return groqGenerate({ prompt, type: 'text', maxTokens: 1000 });
}

/**
 * Fix code using Groq
 */
export async function groqFixCode({ code, error, language = 'javascript' }) {
  const prompt = `Fix this ${language} code. The error is: "${error}"

BROKEN CODE:
${code.slice(0, 6000)}

Output ONLY the fixed code, nothing else.`;

  return groqGenerate({ prompt, type: 'code', language, maxTokens: 4096 });
}
