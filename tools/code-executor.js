/**
 * ARIA v4.0 — Code Executor Tool
 * Validates and analyzes code using Groq AI
 * (Sandboxed: no actual execution, AI-based analysis)
 */

import { groqGenerate } from './groq.js';
import { openrouterGenerate } from './openrouter.js';
import { getLLMProvider } from './fallback.js';

/**
 * Analyze code for bugs, errors, and improvements
 */
export async function analyzeCode({ code, language = 'javascript', task = 'review' }) {
  const taskPrompts = {
    review: `Review this ${language} code. Find bugs, security issues, and improvements. Be concise.`,
    validate: `Check if this ${language} code is syntactically valid and logically sound. Say VALID or list issues.`,
    test: `Write test cases for this ${language} code. Use the appropriate test framework.`,
    optimize: `Optimize this ${language} code for performance. Output optimized version only.`,
    document: `Add JSDoc/docstring comments to this ${language} code. Output full commented code.`,
  };

  const prompt = `${taskPrompts[task] || taskPrompts.review}

\`\`\`${language}
${code.slice(0, 8000)}
\`\`\``;

  const provider = getLLMProvider();

  if (provider === 'groq') {
    return groqGenerate({ prompt, type: task === 'optimize' ? 'code' : 'text' });
  }
  if (provider === 'openrouter') {
    return openrouterGenerate({ prompt, type: task === 'optimize' ? 'code' : 'text' });
  }

  return { error: 'No LLM provider available' };
}

/**
 * Generate code from description
 */
export async function generateCode({ description, language = 'javascript', context = '' }) {
  const prompt = `Write production-ready ${language} code for:

${description}

${context ? `Context/Requirements:\n${context}` : ''}

Rules:
- Output ONLY the code, no explanations
- Use modern syntax and best practices
- Include error handling
- Add brief inline comments for complex logic`;

  const provider = getLLMProvider();

  if (provider === 'groq') {
    return groqGenerate({ prompt, type: 'code', language, maxTokens: 4096 });
  }
  if (provider === 'openrouter') {
    return openrouterGenerate({ prompt, type: 'code', maxTokens: 3000 });
  }

  return { error: 'No LLM provider available' };
}

/**
 * Fix broken code
 */
export async function fixCode({ code, error, language = 'javascript' }) {
  const prompt = `Fix this ${language} code.

ERROR: ${error}

CODE:
\`\`\`${language}
${code.slice(0, 6000)}
\`\`\`

Output ONLY the fixed code, nothing else.`;

  const provider = getLLMProvider();

  if (provider === 'groq') {
    return groqGenerate({ prompt, type: 'code', language, maxTokens: 4096 });
  }
  if (provider === 'openrouter') {
    return openrouterGenerate({ prompt, type: 'code', maxTokens: 3000 });
  }

  return { error: 'No LLM provider available' };
}
