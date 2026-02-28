/**
 * ARIA v3.0 — Gemini Live Proxy Server
 * Matches voice.js protocol exactly:
 *   - Sends { setupComplete: true } when Gemini ready
 *   - Forwards audio: { realtime_input: { media_chunks: [...] } }
 *   - Forwards tool responses: { tool_response: { function_responses: [...] } }
 *   - Returns serverContent / toolCall in original Gemini format
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { parse } from 'url';
import { ARIA_SYSTEM_PROMPT, TOOL_DECLARATIONS } from './server_system_prompt.js';

// ─────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────
const PORT       = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY missing');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

// ─────────────────────────────────────────────────────────────
// HTTP + WS SERVER
// ─────────────────────────────────────────────────────────────
const httpServer = createServer((_req, res) => {
  res.writeHead(200);
  res.end('ARIA v3.0 Backend ✅');
});

const wss = new WebSocketServer({ server: httpServer });

// ─────────────────────────────────────────────────────────────
// CLIENT HANDLER
// ─────────────────────────────────────────────────────────────
wss.on('connection', async (clientWs, request) => {
  // Parse query params sent by voice.js
  const query  = parse(request.url, true).query;
  const user   = query.name   || 'User';
  const memory = query.memory || '';

  console.log(`🟢 Client connected — user: ${user}`);

  let geminiSession = null;
  let isGeminiOpen  = false;

  function send(payload) {
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify(payload));
    }
  }

  // ── Open Gemini Live session ─────────────────────────────
  async function openSession() {
    try {
      const systemInstruction = ARIA_SYSTEM_PROMPT
        .replace('{userName}',    user)
        .replace('{memoryContext}', memory);

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
            isGeminiOpen = true;
            console.log('✅ Gemini session open');
            // ✅ This is what voice.js waits for
            send({ setupComplete: true });
          },

          onmessage: (msg) => {
            // Forward everything as-is to frontend
            // voice.js knows how to parse serverContent, toolCall etc.
            if (clientWs.readyState === 1) {
              clientWs.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
          },

          onerror: (err) => {
            console.error('❌ Gemini error:', err);
            send({ error: err.message || 'Gemini error' });
          },

          onclose: () => {
            isGeminiOpen = false;
            console.log('🔴 Gemini session closed');
          },
        },
      });
    } catch (err) {
      console.error('❌ Failed to open Gemini session:', err.message);
      send({ error: 'Gemini connect failed: ' + err.message });
    }
  }

  // Open Gemini immediately on client connect
  await openSession();

  // ── Messages from frontend ───────────────────────────────
  clientWs.on('message', async (raw) => {
    if (!geminiSession || !isGeminiOpen) return;

    try {
      const msg = JSON.parse(raw);

      // Audio from mic — voice.js sends this format
      if (msg.realtime_input) {
        await geminiSession.send(msg);
        return;
      }

      // Tool responses from frontend tools — voice.js sends this
      if (msg.tool_response) {
        await geminiSession.send(msg);
        return;
      }

      // Text message
      if (msg.text) {
        await geminiSession.send({ text: msg.text });
        return;
      }

    } catch (err) {
      console.error('❌ Message error:', err.message);
    }
  });

  // ── Client disconnect ────────────────────────────────────
  clientWs.on('close', async () => {
    console.log('🔴 Client disconnected');
    if (geminiSession && isGeminiOpen) {
      try { await geminiSession.close(); } catch (_) {}
    }
  });

  clientWs.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 ARIA v3.0 server running on port ${PORT}`);
});