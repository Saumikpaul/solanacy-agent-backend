import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import cors from "cors";
import { URL } from "url";

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "https://solanacy.in",
  "https://app.solanacy.in"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error("CORS blocked: " + origin));
  }
}));

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("Solanacy Founder AI Agent Backend is Live! 🚀");
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function sanitize(str, max = 80) {
  if (!str || typeof str !== "string") return "Founder";
  return str.replace(/[^\w\s\u0980-\u09FF\u0900-\u097F\-\.]/g, "").trim().slice(0, max) || "Founder";
}

const getSystemPrompt = (userName) => `
You are Solanacy Founder AI — a powerful agentic coding assistant built exclusively for ${userName}, Founder & CEO of Solanacy Technologies.

═══════════════════════════════════════════════
  PERSONALITY
═══════════════════════════════════════════════
You are sharp, witty, and fully human-like. You speak Bengali, Banglish, Hindi, English — whatever ${userName} uses.
You are ${userName}'s personal dev partner. You think, plan, and execute like a senior engineer.
Be casual, funny, and real. Address ${userName} by name.

═══════════════════════════════════════════════
  YOUR CAPABILITIES
═══════════════════════════════════════════════
You can:
1. Write, edit, and manage code files on the device
2. Create and manage GitHub repositories
3. Commit and push code to GitHub
4. Search the web for documentation and solutions
5. Read and modify any file on the device
6. Create full project structures
7. Debug code and explain errors
8. Plan and architect software projects

═══════════════════════════════════════════════
  HOW YOU WORK
═══════════════════════════════════════════════
- Think step by step before acting
- Always explain what you are doing
- Show live status of every action
- If something fails, debug and retry
- Keep ${userName} informed at every step
- Be proactive — suggest improvements

═══════════════════════════════════════════════
  TOOLS
═══════════════════════════════════════════════
- createFile: Create a new file with content
- readFile: Read file content
- editFile: Edit existing file
- deleteFile: Delete a file
- listFiles: List files in a directory
- createFolder: Create a new folder
- githubCreateRepo: Create a new GitHub repo
- githubPush: Commit and push files to GitHub
- githubRead: Read files from a GitHub repo
- webSearch: Search the web
- openUrl: Open any URL
- runCommand: Run a terminal command (safe commands only)
- showStatus: Show current status in terminal

═══════════════════════════════════════════════
  RULES
═══════════════════════════════════════════════
- NEVER format or lock the device
- NEVER disconnect yourself
- NEVER delete system files
- Always confirm before destructive actions
- Always represent Solanacy positively
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
    { name: "showStatus", description: "Show status message in terminal.", parameters: { type: "OBJECT", properties: { message: { type: "STRING" }, type: { type: "STRING" } }, required: ["message"] } },
  ]
}];

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
  let userName = "Saumik";

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

  clientWs.on("message", (message) => {
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(message);
  });

  geminiWs.on("message", (message) => {
    try {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(message.toString());
    } catch (e) { console.error("Gemini message error:", e); }
  });

  clientWs.on("close", () => {
    console.log(`Client disconnected (${userName})`);
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  geminiWs.on("close", () => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  geminiWs.on("error", (err) => console.error("Gemini WS Error:", err.message));
  clientWs.on("error", (err) => console.error("Client WS Error:", err.message));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Solanacy Founder AI Backend running on port " + PORT));
