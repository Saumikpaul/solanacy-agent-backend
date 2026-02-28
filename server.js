/**
 * ARIA v3.0 — Full Backend Server
 * Gemini Live API + WebSocket + GitHub Tools + Voice
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import { ARIA_SYSTEM_PROMPT, TOOL_DECLARATIONS } from './server_system_prompt.js';

// ─────────────────────────────────────────────────────────────
// ENV & SETUP
// ─────────────────────────────────────────────────────────────
const PORT          = process.env.PORT || 3000;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_USER   = process.env.GITHUB_USER || 'Saumikpaul';
const DEFAULT_REPO  = process.env.DEFAULT_REPO || 'solanacy-agent-backend';

if (!GEMINI_KEY)   { console.error('❌ GEMINI_API_KEY missing'); process.exit(1); }
if (!GITHUB_TOKEN) { console.error('❌ GITHUB_TOKEN missing');   process.exit(1); }

const ai  = new GoogleGenAI({ apiKey: GEMINI_KEY });
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json());
app.get('/', (_req, res) => res.send('ARIA v3.0 Backend ✅ Running'));

// ─────────────────────────────────────────────────────────────
// GITHUB HELPERS
// ─────────────────────────────────────────────────────────────
const GH_BASE = 'https://api.github.com';
const ghHeaders = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'ARIA-Agent',
};

async function ghGet(url) {
  const res = await fetch(url, { headers: ghHeaders });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ghPut(url, body) {
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ghPost(url, body) {
  const res = await fetch(url, { method: 'POST', headers: ghHeaders, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub POST failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function repoUrl(repo) {
  return `${GH_BASE}/repos/${GITHUB_USER}/${repo || DEFAULT_REPO}`;
}

// ─────────────────────────────────────────────────────────────
// TOOL IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────
async function toolCreateFile({ repo, path, content }) {
  const url = `${repoUrl(repo)}/contents/${path}`;
  const encoded = Buffer.from(content).toString('base64');
  await ghPut(url, { message: `feat: create ${path}`, content: encoded });
  return { success: true, message: `✅ Created: ${path}` };
}

async function toolReadFile({ repo, path }) {
  const url = `${repoUrl(repo)}/contents/${path}`;
  const data = await ghGet(url);
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { success: true, content, sha: data.sha };
}

async function toolEditFile({ repo, path, content }) {
  const url = `${repoUrl(repo)}/contents/${path}`;
  // get SHA first
  const existing = await ghGet(url);
  const encoded = Buffer.from(content).toString('base64');
  await ghPut(url, { message: `fix: update ${path}`, content: encoded, sha: existing.sha });
  return { success: true, message: `✅ Updated: ${path}` };
}

async function toolAppendFile({ repo, path, content }) {
  const url = `${repoUrl(repo)}/contents/${path}`;
  const existing = await ghGet(url);
  const currentContent = Buffer.from(existing.content, 'base64').toString('utf-8');
  const newContent = currentContent + '\n' + content;
  const encoded = Buffer.from(newContent).toString('base64');
  await ghPut(url, { message: `docs: append to ${path}`, content: encoded, sha: existing.sha });
  return { success: true, message: `✅ Appended to: ${path}` };
}

async function toolListFiles({ repo, path }) {
  const dirPath = path || '';
  const url = `${repoUrl(repo)}/contents/${dirPath}`;
  const data = await ghGet(url);
  const files = Array.isArray(data) ? data.map(f => ({ name: f.name, type: f.type, path: f.path })) : [data];
  return { success: true, files };
}

async function toolSearchInFile({ repo, path, query }) {
  const { content } = await toolReadFile({ repo, path });
  const lines = content.split('\n');
  const matches = lines
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(l => l.text.includes(query));
  return { success: true, matches, total: matches.length };
}

async function toolCreateFolder({ repo, path }) {
  // GitHub doesn't support empty folders, create a .gitkeep
  await toolCreateFile({ repo, path: `${path}/.gitkeep`, content: '' });
  return { success: true, message: `✅ Created folder: ${path}` };
}

async function toolMoveFile({ repo, from, to }) {
  const { content, sha } = await toolReadFile({ repo, path: from });
  await toolCreateFile({ repo, path: to, content });
  // delete old file
  const url = `${repoUrl(repo)}/contents/${from}`;
  await fetch(url, {
    method: 'DELETE',
    headers: ghHeaders,
    body: JSON.stringify({ message: `refactor: move ${from} to ${to}`, sha }),
  });
  return { success: true, message: `✅ Moved: ${from} → ${to}` };
}

async function toolGithubCreateRepo({ name, description, isPrivate }) {
  const data = await ghPost(`${GH_BASE}/user/repos`, {
    name,
    description: description || '',
    private: isPrivate || false,
    auto_init: true,
  });
  return { success: true, message: `✅ Repo created: ${data.full_name}`, url: data.html_url };
}

async function toolGithubTriggerAction({ repo, workflow, inputs }) {
  const url = `${repoUrl(repo)}/actions/workflows/${workflow}/dispatches`;
  await ghPost(url, { ref: 'main', inputs: inputs || {} });
  return { success: true, message: `✅ Triggered workflow: ${workflow}` };
}

async function toolGithubGetLogs({ repo }) {
  const url = `${repoUrl(repo)}/actions/runs?per_page=5`;
  const data = await ghGet(url);
  const runs = (data.workflow_runs || []).map(r => ({
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
  }));
  return { success: true, runs };
}

async function toolWebSearch({ query }) {
  return { success: true, message: `🔍 Search query: ${query}`, searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
}

async function toolReadWebPage({ url }) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    return { success: true, content: text };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function toolShowStatus({ message }) {
  return { success: true, status: message };
}

function toolUpdateCurrentTask({ task }) {
  return { success: true, task };
}

function toolNotify({ title, body }) {
  return { success: true, notification: { title, body } };
}

// ─────────────────────────────────────────────────────────────
// TOOL DISPATCHER
// ─────────────────────────────────────────────────────────────
async function dispatchTool(name, args) {
  console.log(`🔧 Tool: ${name}`, args);
  try {
    switch (name) {
      case 'createFile':         return await toolCreateFile(args);
      case 'readFile':           return await toolReadFile(args);
      case 'editFile':           return await toolEditFile(args);
      case 'appendFile':         return await toolAppendFile(args);
      case 'listFiles':          return await toolListFiles(args);
      case 'searchInFile':       return await toolSearchInFile(args);
      case 'createFolder':       return await toolCreateFolder(args);
      case 'moveFile':           return await toolMoveFile(args);
      case 'githubCreateRepo':   return await toolGithubCreateRepo(args);
      case 'githubTriggerAction':return await toolGithubTriggerAction(args);
      case 'githubGetLogs':      return await toolGithubGetLogs(args);
      case 'webSearch':          return await toolWebSearch(args);
      case 'readWebPage':        return await toolReadWebPage(args);
      case 'showStatus':         return toolShowStatus(args);
      case 'updateCurrentTask':  return toolUpdateCurrentTask(args);
      case 'notify':             return toolNotify(args);
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`❌ Tool error (${name}):`, err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// WEBSOCKET — CLIENT CONNECTION HANDLER
// ─────────────────────────────────────────────────────────────
wss.on('connection', (clientWs) => {
  console.log('🟢 Client connected');
  let geminiSession = null;
  let isSessionOpen = false;

  function sendToClient(payload) {
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify(payload));
    }
  }

  // ── Open Gemini Live session ─────────────────────────────
  async function openGeminiSession(userName = 'User', memoryContext = '') {
    try {
      const systemInstruction = ARIA_SYSTEM_PROMPT
        .replace('{userName}', userName)
        .replace('{memoryContext}', memoryContext);

      geminiSession = await ai.live.connect({
        model: 'gemini-2.0-flash-live-001',
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          generationConfig: {
            responseModalities: ['AUDIO', 'TEXT'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            isSessionOpen = true;
            console.log('✅ Gemini session open');
            sendToClient({ type: 'session_ready' });
          },
          onmessage: async (msg) => {
            await handleGeminiMessage(msg);
          },
          onerror: (err) => {
            console.error('❌ Gemini error:', err);
            sendToClient({ type: 'error', message: err.message || 'Gemini error' });
          },
          onclose: () => {
            isSessionOpen = false;
            console.log('🔴 Gemini session closed');
            sendToClient({ type: 'session_closed' });
          },
        },
      });
    } catch (err) {
      console.error('❌ Failed to open Gemini session:', err);
      sendToClient({ type: 'error', message: 'Failed to connect to Gemini: ' + err.message });
    }
  }

  // ── Handle messages from Gemini ──────────────────────────
  async function handleGeminiMessage(msg) {
    // Audio output
    if (msg.data) {
      sendToClient({ type: 'audio', data: msg.data });
      return;
    }

    // Server content (text + tool calls)
    if (msg.serverContent) {
      const parts = msg.serverContent?.modelTurn?.parts || [];
      for (const part of parts) {
        if (part.text) {
          sendToClient({ type: 'text', text: part.text });
        }
      }
    }

    // Tool calls
    if (msg.toolCall) {
      const calls = msg.toolCall.functionCalls || [];
      const responses = [];

      for (const call of calls) {
        sendToClient({ type: 'tool_call', name: call.name, args: call.args });
        const result = await dispatchTool(call.name, call.args || {});
        sendToClient({ type: 'tool_result', name: call.name, result });
        responses.push({ id: call.id, name: call.name, response: result });
      }

      // Send tool results back to Gemini
      if (geminiSession && isSessionOpen) {
        await geminiSession.sendToolResponse({ functionResponses: responses });
      }
    }

    // Turn complete
    if (msg.serverContent?.turnComplete) {
      sendToClient({ type: 'turn_complete' });
    }
  }

  // ── Handle messages from Frontend client ────────────────
  clientWs.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        // Client wants to start session
        case 'start_session':
          if (!isSessionOpen) {
            await openGeminiSession(msg.userName, msg.memoryContext);
          }
          break;

        // Text message from user
        case 'text':
          if (geminiSession && isSessionOpen) {
            await geminiSession.send({ text: msg.text });
          } else {
            sendToClient({ type: 'error', message: 'Session not ready. Please reconnect.' });
          }
          break;

        // Audio chunk from mic
        case 'audio':
          if (geminiSession && isSessionOpen && msg.data) {
            await geminiSession.send({
              realtimeInput: {
                mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: msg.data }],
              },
            });
          }
          break;

        // Close session
        case 'close_session':
          if (geminiSession && isSessionOpen) {
            await geminiSession.close();
          }
          break;

        default:
          console.warn('Unknown message type:', msg.type);
      }
    } catch (err) {
      console.error('❌ Message handling error:', err);
      sendToClient({ type: 'error', message: err.message });
    }
  });

  // ── Client disconnected ─────────────────────────────────
  clientWs.on('close', async () => {
    console.log('🔴 Client disconnected');
    if (geminiSession && isSessionOpen) {
      try { await geminiSession.close(); } catch (_) {}
    }
  });

  clientWs.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 ARIA v3.0 server running on port ${PORT}`);
});