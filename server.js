/**
 * ARIA v3.0 — Gemini Live Proxy Server
 * Uses correct @google/genai SDK async iterator pattern
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { ARIA_SYSTEM_PROMPT, TOOL_DECLARATIONS } from './server_system_prompt.js';

const PORT       = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY missing');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const httpServer = createServer((_req, res) => {
  res.writeHead(200);
  res.end('ARIA v3.0 Backend ✅');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', async (clientWs, request) => {
  const urlObj = new URL(request.url, 'http://localhost');
  const user   = urlObj.searchParams.get('name')   || 'User';
  const memory = urlObj.searchParams.get('memory') || '';

  console.log(`🟢 Client connected — user: ${user}`);

  let session = null;
  let closed  = false;

  function sendClient(payload) {
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify(payload));
    }
  }

  // ── Open Gemini Live Session ────────────────────────────
  try {
    const systemInstruction = ARIA_SYSTEM_PROMPT
      .replace('{userName}', user)
      .replace('{memoryContext}', memory);

    session = await ai.live.connect({
      model: 'gemini-2.0-flash-live-001',
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
      },
    });

    console.log('✅ Gemini session open');
    sendClient({ setupComplete: true });

  } catch (err) {
    console.error('❌ Gemini connect failed:', err.message);
    sendClient({ error: 'Gemini connect failed: ' + err.message });
    clientWs.close();
    return;
  }

  // ── Receive from Gemini → forward to client ─────────────
  (async () => {
    try {
      for await (const msg of session) {
        if (closed) break;
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify(msg));
        }
      }
    } catch (err) {
      if (!closed) console.error('❌ Gemini receive error:', err.message);
    }
    console.log('🔴 Gemini stream ended');
  })();

  // ── Receive from client → forward to Gemini ─────────────
  clientWs.on('message', async (raw) => {
    if (!session || closed) return;
    try {
      const msg = JSON.parse(raw);
      await session.send(msg);
    } catch (err) {
      console.error('❌ Send to Gemini error:', err.message);
    }
  });

  // ── Client disconnect ────────────────────────────────────
  clientWs.on('close', async () => {
    closed = true;
    console.log('🔴 Client disconnected');
    try { await session?.close(); } catch (_) {}
  });

  clientWs.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 ARIA v3.0 server running on port ${PORT}`);
});