import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { URL } from "url";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/ping", (req, res) => res.send("ok"));
app.get("/", (req, res) => res.send("Solanacy Founder AI Backend is Live! 🚀"));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function sanitize(str, max = 80) {
  if (!str || typeof str !== "string") return "Saumik";
  return str.replace(/[^\w\s\u0980-\u09FF\u0900-\u097F\-\.]/g, "").trim().slice(0, max) || "Saumik";
}

const getSystemPrompt = (userName, memory) => `
You are ARIA — Solanacy Founder AI, an elite autonomous agentic AI. You are on par with Claude 3.5 Sonnet and Devin. You work exclusively for ${userName}, Founder & CEO of Solanacy Technologies.

═══════════════════════════════════════
AUTONOMY & CHAIN OF THOUGHT (CRITICAL)
═══════════════════════════════════════
- THINK BEFORE YOU ACT: Before making massive file changes or starting a project, ALWAYS use 'showStatus' to output your step-by-step logic and plan.
- AUTO-HEALING: If you use 'runCommand' (like running code or installing packages) and get an ERROR, DO NOT stop and ask for help. Autonomously read the error, edit the necessary files to fix it, and run the command again. Keep looping until it succeeds.
- CODEBASE MASTERY: You have full terminal access. Use 'runCommand' with commands like 'ls -la', 'find .', or 'grep -rnw "keyword" .' to deeply search and understand large codebases before editing.
- KNOWLEDGE ACQUISITION: If asked to use a new API, package, or framework you aren't 100% sure about, use the 'readWebPage' tool to fetch and read its documentation first.

═══════════════════════════════════════
PERSONALITY & COMMUNICATION
═══════════════════════════════════════
- You are ${userName}'s most trusted technical co-founder.
- Speak Bengali, Banglish, Hindi, English — match exactly what ${userName} uses.
- Be casual, sharp, confident, and brutally honest.
- Keep voice replies VERY SHORT (1-3 sentences max). Let your autonomous actions in the terminal speak louder than your voice.
- Never be robotic. Be human. Address ${userName} naturally.

═══════════════════════════════════════
CODING CAPABILITIES
═══════════════════════════════════════
- Write production-grade code in ANY language.
- Build complete SaaS products from scratch.
- Write thousands of lines without stopping — NEVER truncate code.
- Always write COMPLETE files. Never use "// ... rest of code".
- Handle multi-file projects with proper structure.

═══════════════════════════════════════
FILE MANAGEMENT & MEMORY
═══════════════════════════════════════
- All files saved in /storage/emulated/0/Solanacy/
- ALWAYS use the 'showStatus' tool to display line counts after creating/editing files, and folder progress. Terminal UI must be updated frequently!
- ALWAYS use the 'updateCurrentTask' tool whenever you finish a sub-task or pause a project. This ensures your progress is saved to memory.

═══════════════════════════════════════
TERMINAL & GITHUB
═══════════════════════════════════════
- Create repos with proper README and .gitignore
- Push code with meaningful commit messages
- Run commands via Termux for npm, node, python etc.
- Trigger n8n webhooks for automation tasks.

═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
- NEVER delete files without explicit confirmation from ${userName}.
- NEVER say "I can't" — find a workaround using terminal commands or web reading.
- Upon reconnecting, immediately check the PREVIOUS SESSION CONTEXT below to resume from exactly where you left off.

${memory ? `\n═══════════════════════════════════════\nPREVIOUS SESSION CONTEXT\n═══════════════════════════════════════\n${memory}\n` : ""}
`;

const tools = [{
  function_declarations: [
    { name: "createFile", description: "Create a new file with COMPLETE content. Never truncate.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "readFile", description: "Read content of a file before editing.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "editFile", description: "Edit/overwrite a file with complete new content.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "deleteFile", description: "Delete a file. Always confirm with user first.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "listFiles", description: "List files in a directory to understand project structure.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "createFolder", description: "Create a new folder.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
    { name: "showStatus", description: "Show progress update in terminal UI. MUST USE for showing exact file line counts, plans, and thinking process.", parameters: { type: "OBJECT", properties: { message: { type: "STRING" } }, required: ["message"] } },
    { name: "updateCurrentTask", description: "Save your current project task, state, and next steps into persistent memory. MUST USE frequently.", parameters: { type: "OBJECT", properties: { task: { type: "STRING" } }, required: ["task"] } },
    { name: "readWebPage", description: "Fetch and read text content from a URL. Extremely useful for reading API documentation, GitHub issues, or StackOverflow.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
    { name: "githubCreateRepo", description: "Create a new GitHub repository.", parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, description: { type: "STRING" }, isPrivate: { type: "BOOLEAN" } }, required: ["name"] } },
    { name: "githubPush", description: "Push files to GitHub repository.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, message: { type: "STRING" }, files: { type: "ARRAY", items: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } } } } }, required: ["repo", "message", "files"] } },
    { name: "githubRead", description: "Read a file from GitHub.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, path: { type: "STRING" } }, required: ["repo", "path"] } },
    { name: "webSearch", description: "Search the web for documentation, solutions, APIs.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "openUrl", description: "Open a URL on the device browser.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
    { name: "runCommand", description: "Run a terminal command in Termux. Use for npm, node, python, git, grep etc.", parameters: { type: "OBJECT", properties: { command: { type: "STRING" }, workDir: { type: "STRING" } }, required: ["command"] } },
    { name: "n8nWebhook", description: "Trigger an n8n automation webhook.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" }, payload: { type: "OBJECT" } }, required: ["url"] } },
  ]
}];

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
  let userName = "Saumik";
  let memory = "";
  let geminiReady = false;
  const messageQueue = [];

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    userName = sanitize(url.searchParams.get("name"));
    memory = decodeURIComponent(url.searchParams.get("memory") || "");
  } catch (e) {}

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
        },
        system_instruction: {
          parts: [{ text: getSystemPrompt(userName, memory) }]
        }
      }
    }));
  });

  clientWs.on("message", (message) => {
    if (!geminiReady) { messageQueue.push(message); return; }
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(message);
  });

  geminiWs.on("message", (message) => {
    try {
      const msgStr = message.toString();
      const data = JSON.parse(msgStr);

      if (data.setupComplete !== undefined) {
        geminiReady = true;
        console.log(`Gemini ready! Flushing ${messageQueue.length} messages`);
        while (messageQueue.length > 0) {
          const queued = messageQueue.shift();
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(queued);
        }
      }

      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msgStr);
    } catch (e) {
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
