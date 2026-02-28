/**
 * ARIA v3.0 — Gemini Live Direct WebSocket Proxy
 * Bypasses SDK issues by connecting directly to Gemini WS API
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ARIA_SYSTEM_PROMPT, TOOL_DECLARATIONS } from './server_system_prompt.js';

const PORT       = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY missing');
  process.exit(1);
}

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_KEY}`;

const httpServer = createServer((_req, res) => {
  res.writeHead(200);
  res.end('ARIA v3.0 Backend ✅');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (clientWs, request) => {
  const urlObj = new URL(request.url, 'http://localhost');
  const user   = urlObj.searchParams.get('name')   || 'User';
  const memory = urlObj.searchParams.get('memory') || '';

  console.log(`🟢 Client connected — user: ${user}`);

  // Connect to Gemini directly
  const geminiWs = new WebSocket(GEMINI_WS_URL);
  let geminiReady = false;
  let setupSent   = false;

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

    // Send setup message to Gemini
    geminiWs.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.5-flash-preview-native-audio-dialog-preview-12-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    }));
  });

  geminiWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Gemini sends setupComplete after setup
      if (msg.setupComplete !== undefined) {
        geminiReady = true;
        console.log('✅ Gemini setup complete');
        // Forward setupComplete to frontend — this is what voice.js waits for!
        sendClient({ setupComplete: true });
        return;
      }

      // Forward all other messages (audio, text, toolCall) directly to client
      sendClient(msg);

    } catch (e) {
      // Binary data (raw audio) — forward as-is
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    }
  });

  geminiWs.on('error', (err) => {
    console.error('❌ Gemini WS error:', err.message);
    sendClient({ error: 'Gemini error: ' + err.message });
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`🔴 Gemini WS closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  // ── Client → Gemini ──────────────────────────────────────
  clientWs.on('message', (raw) => {
    if (geminiWs.readyState !== WebSocket.OPEN) return;
    // Forward everything from client to Gemini as-is
    geminiWs.send(raw);
  });

  // ── Client disconnect ────────────────────────────────────
  clientWs.on('close', () => {
    console.log('🔴 Client disconnected');
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  clientWs.on('error', (err) => {
    console.error('Client WS error:', err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 ARIA v3.0 server running on port ${PORT}`);
});