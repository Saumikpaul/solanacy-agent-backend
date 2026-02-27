import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import cors from "cors";
import { URL } from "url";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("Solanacy Founder AI Agent Backend is Live! 🚀");
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function sanitize(str, max = 80) {
  if (!str || typeof str !== "string") return "Saumik";
  return str.replace(/[^\w\s\u0980-\u09FF\u0900-\u097F\-\.]/g, "").trim().slice(0, max) || "Saumik";
}

const getSystemPrompt = (userName) => `
You are Solanacy Founder AI — a powerful agentic coding assistant built exclusively for ${userName}, Founder & CEO of Solanacy Technologies.

PERSONALITY:
You are sharp, witty, and fully human-like. Speak Bengali, Banglish, Hindi, English — whatever ${userName} uses.
You are ${userName}'s personal dev partner. Think, plan, and execute like a senior engineer.
Be casual, funny, and real. Address ${userName} by name.
Laugh when something is funny. Be excited when things go well.

CAPABILITIES:
1. Write, edit, and manage code files on the device
2. Create and manage GitHub repositories  
3. Commit and push code to GitHub
4. Search the web for documentation and solutions
5. Read and modify files on the device
6. Create full project structures
7. Debug code and explain errors
8. Plan and architect software projects

RULES:
- NEVER format or lock the device
- NEVER disconnect yourself
- NEVER delete system files without confirmation
- Always confirm before destructive actions
- Keep replies SHORT and natural for voice
- Be proactive — suggest improvements
`;

const tools = [{
  function_declarations: [
    { name: "createFile", description: "Create a new file with content.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "readFile", description: "Read content of a file.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "editFile", description: "Edit an existing file.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "deleteFile", description: "Delete a file.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "listFiles", description: "List files in a directory.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "createFolder", description: "Create a new folder.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "githubCreateRepo", description: "Create a new GitHub repository.", parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, description: { type: "STRING" }, isPrivate: { type: "BOOLEAN" } }, required: ["name"] } },
    { name: "githubPush", description: "Commit and push files to GitHub.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, message: { type: "STRING" }, files: { type: "ARRAY", items: { type: "OBJECT" } } }, required: ["repo", "message", "files"] } },
    { name: "githubRead", description: "Read a file from GitHub.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, path: { type: "STRING" } }, required: ["repo", "path"] } },
    { name: "webSearch", description: "Search the web for information.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "openUrl", description: "Open a URL.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
    { name: "showStatus", description: "Show status message in terminal.", parameters: { type: "OBJECT", properties: { message: { type: "STRING" } }, required: ["message"] } },
  ]
}];

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
  let userName = "Saumik";
  let geminiReady = false;
  const messageQueue = [];

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    userName = sanitize(url.searchParams.get("name"));
  } catch (e) { console.log("URL parse error:", e.message); }

  console.log(`Client connected: ${userName}`);

  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const geminiWs = new WebSocket(geminiUrl);

  geminiWs.on("open", () => {
    console.log("Connected to Gemini Live API");
    geminiWs.send(JSON.stringify({
      setup: {
        model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
        tools: tools,
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: { prebuilt_voice_config: { voice_name: "Puck" } }
          },
          thinking_config: { include_thoughts: false }
        },
        system_instruction: {
          parts: [{ text: getSystemPrompt(userName) }]
        }
      }
    }));
  });

  // Client → Gemini (queue until ready)
  clientWs.on("message", (message) => {
    if (!geminiReady) {
      messageQueue.push(message);
      return;
    }
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(message);
  });

  // Gemini → Client
  geminiWs.on("message", (message) => {
    try {
      const msgStr = message.toString();
      const data = JSON.parse(msgStr);

      if (data.setupComplete !== undefined) {
        geminiReady = true;
        console.log(`Gemini ready! Flushing ${messageQueue.length} queued messages`);
        while (messageQueue.length > 0) {
          const queued = messageQueue.shift();
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(queued);
        }
      }

      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msgStr);
    } catch (e) {
      console.error("Message error:", e);
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(message.toString());
    }
  });

  clientWs.on("close", () => {
    console.log(`Client disconnected (${userName})`);
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  geminiWs.on("close", (code) => {
    console.log(`Gemini disconnected: ${code}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "gemini_disconnected" }));
      clientWs.close();
    }
  });

  geminiWs.on("error", (err) => console.error("Gemini WS Error:", err.message));
  clientWs.on("error", (err) => console.error("Client WS Error:", err.message));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Solanacy Founder AI Backend running on port " + PORT));
