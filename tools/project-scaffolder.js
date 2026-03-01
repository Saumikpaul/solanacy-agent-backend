/**
 * ARIA v4.0 — Project Scaffolder Tool
 * Generates full project structure with all files
 * Given an idea → outputs complete file tree + code
 */

import { groqGenerate } from './groq.js';
import { openrouterGenerate } from './openrouter.js';
import { getLLMProvider } from './fallback.js';

/**
 * Generate a complete project plan from an idea
 */
export async function planProject({ idea, techStack = 'auto', type = 'web' }) {
  const prompt = `You are an elite software architect. Create a complete project plan.

PROJECT IDEA: "${idea}"
PROJECT TYPE: ${type}
TECH STACK: ${techStack === 'auto' ? 'Choose the best modern stack' : techStack}

Respond ONLY with valid JSON:
{
  "name": "project-name",
  "description": "one line description",
  "techStack": { "frontend": "", "backend": "", "database": "", "other": [] },
  "structure": {
    "files": [
      { "path": "src/index.js", "description": "what this file does", "priority": 1 },
      { "path": "package.json", "description": "dependencies", "priority": 1 }
    ]
  },
  "installCommands": ["npm install"],
  "startCommand": "npm start",
  "envVariables": ["API_KEY", "PORT"],
  "estimatedFiles": 5,
  "estimatedTime": "30 minutes"
}`;

  const provider = getLLMProvider();
  let result;

  if (provider === 'groq') result = await groqGenerate({ prompt, type: 'json' });
  else if (provider === 'openrouter') result = await openrouterGenerate({ prompt });
  else return { error: 'No LLM available' };

  if (result.error) return result;

  try {
    const jsonMatch = result.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: 'Invalid JSON from LLM' };
    return { plan: JSON.parse(jsonMatch[0]) };
  } catch (e) {
    return { error: `JSON parse error: ${e.message}` };
  }
}

/**
 * Generate code for a specific file in a project
 */
export async function generateProjectFile({ filePath, description, projectContext, language = '' }) {
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = { js: 'javascript', ts: 'typescript', py: 'python', jsx: 'react jsx', tsx: 'react tsx', css: 'css', html: 'html', json: 'json', md: 'markdown' };
  const lang = language || langMap[ext] || 'text';

  const prompt = `Generate production-ready ${lang} code for: ${filePath}

PURPOSE: ${description}

PROJECT CONTEXT:
${projectContext?.slice(0, 1000) || 'No context provided'}

Rules:
- Output ONLY the code/content
- No markdown fences
- Include proper imports
- Add error handling
- Production-quality code`;

  const provider = getLLMProvider();

  if (provider === 'groq') return groqGenerate({ prompt, type: 'code', language: lang, maxTokens: 4096 });
  if (provider === 'openrouter') return openrouterGenerate({ prompt, type: 'code', maxTokens: 3000 });
  return { error: 'No LLM available' };
}

/**
 * Generate README for a project
 */
export async function generateReadme({ projectName, description, techStack, features = [] }) {
  const prompt = `Write a professional README.md for:

Project: ${projectName}
Description: ${description}
Tech Stack: ${JSON.stringify(techStack)}
Features: ${features.join(', ')}

Include: title, description, tech stack, installation, usage, features, license (MIT).
Use proper markdown.`;

  const provider = getLLMProvider();

  if (provider === 'groq') return groqGenerate({ prompt, type: 'text', maxTokens: 2000 });
  if (provider === 'openrouter') return openrouterGenerate({ prompt, maxTokens: 1500 });
  return { error: 'No LLM available' };
}
