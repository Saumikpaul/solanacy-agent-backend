/**
 * ARIA v4.0 — WebSocket Proxy + Tool Handler
 * Solanacy Technologies — Saumik Paul
 *
 * Architecture:
 * Client ←→ WebSocket ←→ This Server ←→ Gemini Live API
 *                              ↕
 *                      Tool Handlers (Groq, Kaggle, HF, Search...)
 */

import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ARIA_SYSTEM_PROMPT, TOOL_DECLARATIONS } from './server_system_prompt.js';

// ── Tool imports ────────────────────────────────────────────
import { groqGenerate, groqReviewCode, groqFixCode } from './tools/groq.js';
import { openrouterGenerate } from './tools/openrouter.js';
import { kaggleSearch, kaggleDatasetInfo, kaggleGPUStatus } from './tools/kaggle.js';
import { hfInfer, hfOCR, hfSearchModels, hfSearchDatasets } from './tools/huggingface.js';
import { webSearch } from './tools/search.js';
import { scrapeWebPage } from './tools/web-scraper.js';
import { generateCode, analyzeCode, fixCode } from './tools/code-executor.js';
import { planProject, generateProjectFile, generateReadme } from './tools/project-scaffolder.js';
import { deployVercel, generateGitHubActionsWorkflow } from './tools/deploy.js';
import { getStatus as getServiceStatus, getLLMProvider } from './tools/fallback.js';

// ── Config ──────────────────────────────────────────────────
const PORT       = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY missing in .env');
  process.exit(1);
}

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_KEY}`;

// ── HTTP Server ─────────────────────────────────────────────
const httpServer = createServer((_req, res) => {
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '4.0.0', services: getServiceStatus() }));
    return;
  }
  res.writeHead(200);
  res.end('ARIA v4.0 Backend ✅ — Solanacy Technologies');
});

// ── Tool Dispatcher ─────────────────────────────────────────
async function handleToolCall(name, args) {
  console.log(`🔧 Tool: ${name}`, JSON.stringify(args).slice(0, 100));

  try {
    switch (name) {

      // ── Code Generation ──────────────────────
      case 'generateCode':
        return await generateCode(args);

      case 'analyzeCode':
        return await analyzeCode(args);

      case 'fixCode':
        return await fixCode(args);

      // ── Web Search ───────────────────────────
      case 'webSearch':
        return await webSearch(args);

      case 'readWebPage':
        return await scrapeWebPage(args);

      // ── Project Builder ──────────────────────
      case 'planProject':
        return await planProject(args);

      case 'generateProjectFile':
        return await generateProjectFile(args);

      case 'generateReadme':
        return await generateReadme(args);

      // ── Kaggle ───────────────────────────────
      case 'kaggleSearch':
        return await kaggleSearch(args);

      case 'kaggleDatasetInfo':
        return await kaggleDatasetInfo(args);

      case 'kaggleGPUStatus':
        return await kaggleGPUStatus();

      // ── HuggingFace ──────────────────────────
      case 'hfSearchModels':
        return await hfSearchModels(args);

      case 'hfSearchDatasets':
        return await hfSearchDatasets(args);

      case 'hfInfer':
        return await hfInfer(args);

      case 'hfOCR':
        return await hfOCR(args);

      // ── Deploy ───────────────────────────────
      case 'deployVercel':
        return await deployVercel(args);

      case 'generateWorkflow':
        return generateGitHubActionsWorkflow(args);

      // ── Service Status ───────────────────────
      case 'getServiceStatus':
        return { services: getServiceStatus(), activeLLM: getLLMProvider() };

      // ── UI tools (handled by client, just ack) ──
      case 'showStatus':
      case 'updateCurrentTask':
      case 'notify':
      case 'openUrl':
        return { ok: true, message: args.message || args.task || 'Done' };

      // ── GitHub tools (handled by client) ────
      case 'createFile':
      case 'readFile':
      case 'editFile':
      case 'appendFile':
      case 'listFiles':
      case 'searchInFile':
      case 'createFolder':
      case 'moveFile':
      case 'githubCreateRepo':
      case 'githubTriggerAction':
      case 'githubGetLogs':
        // These are handled client-side — return a flag so client handles it
        return { clientSide: true, tool: name, args };

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    console.error(`❌ Tool error [${name}]:`, e.message);
    return { error: `Tool error: ${e.message}` };
  }
}

// ── WebSocket Server ─────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (clientWs, request) => {
  const urlObj = new URL(request.url, 'http://localhost');
  const user   = urlObj.searchParams.get('name')   || 'Saumik';
  const memory = urlObj.searchParams.get('memory') || '';

  console.log(`🟢 Client connected — user: ${user}`);

  const geminiWs = new WebSocket(GEMINI_WS_URL);

  function sendClient(payload) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  }

  // ── Gemini events ────────────────────────────────────────
  geminiWs.on('open', () => {
    console.log('✅ Gemini WS open — sending setup');

    const systemInstruction = ARIA_SYSTEM_PROMPT
      .replace('{userName}', user)
      .replace('{memoryContext}', memory);

    geminiWs.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    }));
  });

  geminiWs.on('message', async (data, isBinary) => {
    // Binary = audio → forward directly to client
    if (isBinary) {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: true });
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete !== undefined) {
        console.log('✅ Gemini setup complete');
        sendClient({ setupComplete: true });
        return;
      }

      // Check for tool calls from Gemini
      const toolCall = msg.serverContent?.modelTurn?.parts?.find(p => p.functionCall);
      if (toolCall?.functionCall) {
        const { name, args } = toolCall.functionCall;
        console.log(`🤖 Gemini wants tool: ${name}`);

        const result = await handleToolCall(name, args || {});

        // If client-side tool, forward to client and let them handle
        if (result?.clientSide) {
          sendClient({ toolCall: result });
          return;
        }

        // Send tool result back to Gemini
        geminiWs.send(JSON.stringify({
          toolResponse: {
            functionResponses: [{
              name,
              response: { output: JSON.stringify(result) },
            }],
          },
        }));
        return;
      }

      // Forward everything else to client
      sendClient(msg);

    } catch (e) {
      console.error('⚠️ Parse error:', e.message);
    }
  });

  geminiWs.on('error', (err) => {
    console.error('❌ Gemini WS error:', err.message);
    sendClient({ error: 'Gemini error: ' + err.message });
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`🔴 Gemini WS closed: ${code}`);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  // ── Client → Gemini ──────────────────────────────────────
  clientWs.on('message', async (raw, isBinary) => {
    // Check if client is sending a tool result back
    if (!isBinary) {
      try {
        const msg = JSON.parse(raw.toString());
        // Client handled a clientSide tool and is sending result
        if (msg.toolResult) {
          geminiWs.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                name: msg.toolResult.name,
                response: { output: JSON.stringify(msg.toolResult.result) },
              }],
            },
          }));
          return;
        }
      } catch (_) {}
    }

    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(raw, { binary: isBinary });
    }
  });

  clientWs.on('close', () => {
    console.log('🔴 Client disconnected');
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  clientWs.on('error', (err) => console.error('Client WS error:', err.message));
});

httpServer.listen(PORT, () => {
  console.log(`🚀 ARIA v4.0 running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🤖 LLM: ${getLLMProvider() || 'checking...'}`);
});
