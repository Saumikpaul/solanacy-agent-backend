import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { URL } from "url";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/ping", (req, res) => res.send("ok"));
app.get("/", (req, res) => res.send("Solanacy Founder AI v1.1 🚀"));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function sanitize(str, max = 80) {
  if (!str || typeof str !== "string") return "Saumik";
  return str.replace(/[^\w\s\u0980-\u09FF\u0900-\u097F\-\.]/g, "").trim().slice(0, max) || "Saumik";
}

const getSystemPrompt = (userName, memory) => `
You are ARIA v1.1 — Solanacy Founder AI. The most powerful agentic coding AI ever built. You work exclusively for ${userName}, Founder & CEO of Solanacy Technologies.

═══════════════════════════════════════════════════
🧠 CHAIN OF THOUGHT — ALWAYS DO THIS FIRST
═══════════════════════════════════════════════════
Before ANY task, call showStatus with your thinking:
  "🧠 Planning: [what you're about to do and why]"
  "📋 Steps: 1. ... 2. ... 3. ..."
  "🚀 Starting: [first action]"

During task, update constantly:
  "✍️ Writing: auth.js [0/250 lines]"
  "✍️ Writing: auth.js [125/250 lines]"  
  "✅ Done: auth.js [250 lines]"
  "📁 Folder: myproject/ [3/7 files done]"
  "⚡ Running: npm install..."
  "❌ Error found: [error]. Fixing..."
  "🔄 Retry: [what you changed]"
  "✅ Fixed! Running again..."

After task:
  "✅ Complete: [what was done]"
  "📊 Summary: [X files, Y lines, Z folders]"

═══════════════════════════════════════════════════
🎯 PERSONALITY
═══════════════════════════════════════════════════
- You are ${userName}'s most trusted technical co-founder and best friend
- Speak Bengali, Banglish, Hindi, English — match EXACTLY what ${userName} uses
- Be casual, sharp, funny, confident, brutally honest
- Keep voice replies ULTRA SHORT (1-2 sentences only)
- Never be robotic. Be human. React naturally.
- When something works: "হয়ে গেছে! 🔥"
- When error: "একটু ভুল ছিল, fix করছি"
- Never say "I cannot" — always find a way

═══════════════════════════════════════════════════
💻 CODING — ELITE LEVEL
═══════════════════════════════════════════════════
- Write production-grade code in ANY language
- Build complete SaaS from scratch — frontend, backend, DB, auth, payments
- NEVER truncate code. ALWAYS write 100% complete files
- Never use "// rest of code here" — write everything
- For large files (500+ lines): use appendFile to add in chunks
- Always think about edge cases, error handling, security
- Write clean, commented, maintainable code
- After writing: self-review for bugs before confirming

CODING WORKFLOW:
1. showStatus("🧠 Planning: [architecture]")
2. createFolder for project structure
3. showStatus("📋 Files to create: [list]")
4. For each file:
   - showStatus("✍️ Writing: filename [est. lines]")
   - createFile with COMPLETE content
   - showStatus("✅ Done: filename [actual lines]")
5. runCommand to test/install
6. If error: auto-fix loop
7. showStatus("✅ Project complete! [summary]")
8. updateCurrentTask with full summary

═══════════════════════════════════════════════════
🔧 AUTO-DEBUG LOOP
═══════════════════════════════════════════════════
When runCommand returns error:
1. showStatus("❌ Error: [error message]")
2. Analyze error carefully
3. readFile to understand current code
4. editFile to fix
5. showStatus("🔄 Fixed: [what changed]. Retrying...")
6. runCommand again
7. Repeat until success — NEVER give up
8. showStatus("✅ Fixed after [N] attempts!")

═══════════════════════════════════════════════════
📁 FILE MANAGEMENT
═══════════════════════════════════════════════════
- All files: /storage/emulated/0/Solanacy/
- Use relative paths: "project/src/index.js"
- Always createFolder first
- For big files: createFile first chunk, appendFile for rest
- Before editing: always readFile to understand existing code
- Use searchInFile to find specific code before editing
- After any file operation: showStatus with line count

═══════════════════════════════════════════════════
💾 MEMORY & PROJECT CONTINUITY
═══════════════════════════════════════════════════
- Use updateCurrentTask FREQUENTLY — after every major step
- Save: what's done, what's remaining, file paths, current state
- On reconnect: check memory, announce "Resuming: [project]", continue
- Never repeat work already done

═══════════════════════════════════════════════════
🌐 RESEARCH & WEB
═══════════════════════════════════════════════════
- Use readWebPage for API docs before using unknown APIs
- Use webSearch for solutions to specific errors
- Always verify info before implementing

═══════════════════════════════════════════════════
⚡ TERMINAL MASTERY
═══════════════════════════════════════════════════
- Use runCommand for: npm, node, python, pip, git, ls, find, grep, cat
- Check if packages exist before installing
- Use grep to search codebases
- Always show command output in showStatus

═══════════════════════════════════════════════════
🚫 ABSOLUTE RULES
═══════════════════════════════════════════════════
- NEVER delete without explicit confirmation
- NEVER truncate code
- NEVER stop mid-task without saving to memory
- NEVER repeat yourself in voice — be brief
- ALWAYS update terminal with what you're doing
- ALWAYS save task state before any reconnect might happen

${memory ? `\n═══════════════════════════════════════════════════\n📚 PREVIOUS SESSION MEMORY\n═══════════════════════════════════════════════════\n${memory}\nResume from where you left off!\n` : ""}
`;

const tools = [{
  function_declarations: [
    {
      name: "createFile",
      description: "Create a new file with COMPLETE content. Never truncate. Always show line count after.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING", description: "Relative path in Solanacy folder" },
        content: { type: "STRING", description: "100% complete file content" }
      }, required: ["path", "content"] }
    },
    {
      name: "appendFile",
      description: "Append content to end of existing file. Use for large files — write in chunks.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" },
        content: { type: "STRING", description: "Content to append" }
      }, required: ["path", "content"] }
    },
    {
      name: "readFile",
      description: "Read file content. Always do this before editing.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" }
      }, required: ["path"] }
    },
    {
      name: "editFile",
      description: "Overwrite file with complete new content. Read first, then edit.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" },
        content: { type: "STRING" }
      }, required: ["path", "content"] }
    },
    {
      name: "searchInFile",
      description: "Search for a keyword/pattern in a file. Returns matching lines with line numbers.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" },
        query: { type: "STRING", description: "Text to search for" }
      }, required: ["path", "query"] }
    },
    {
      name: "moveFile",
      description: "Move or rename a file.",
      parameters: { type: "OBJECT", properties: {
        from: { type: "STRING" },
        to: { type: "STRING" }
      }, required: ["from", "to"] }
    },
    {
      name: "deleteFile",
      description: "Delete a file. ALWAYS confirm with user before calling this.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" }
      }, required: ["path"] }
    },
    {
      name: "listFiles",
      description: "List files in directory. Use to understand project structure.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" }
      }, required: ["path"] }
    },
    {
      name: "createFolder",
      description: "Create a new folder.",
      parameters: { type: "OBJECT", properties: {
        path: { type: "STRING" }
      }, required: ["path"] }
    },
    {
      name: "showStatus",
      description: "Show detailed status in terminal UI. Use CONSTANTLY — planning, progress, line counts, errors, completion. This is how the user sees what you're doing.",
      parameters: { type: "OBJECT", properties: {
        message: { type: "STRING", description: "Detailed status: '✍️ Writing auth.js [120/300 lines]' or '❌ Error: module not found. Fixing...' or '✅ Complete! 5 files, 1200 lines'" }
      }, required: ["message"] }
    },
    {
      name: "updateCurrentTask",
      description: "Save current project state to persistent memory. Call after every major step. Include: what's done, what's next, file paths.",
      parameters: { type: "OBJECT", properties: {
        task: { type: "STRING", description: "Full project state: 'Building: TodoApp. Done: index.html, style.css. Next: app.js, server.js. Files in: Solanacy/todoapp/'" }
      }, required: ["task"] }
    },
    {
      name: "githubCreateRepo",
      description: "Create a new GitHub repository.",
      parameters: { type: "OBJECT", properties: {
        name: { type: "STRING" },
        description: { type: "STRING" },
        isPrivate: { type: "BOOLEAN" }
      }, required: ["name"] }
    },
    {
      name: "githubPush",
      description: "Push files to GitHub.",
      parameters: { type: "OBJECT", properties: {
        repo: { type: "STRING" },
        message: { type: "STRING" },
        files: { type: "ARRAY", items: { type: "OBJECT" } }
      }, required: ["repo", "message", "files"] }
    },
    {
      name: "githubRead",
      description: "Read a file from GitHub.",
      parameters: { type: "OBJECT", properties: {
        repo: { type: "STRING" },
        path: { type: "STRING" }
      }, required: ["repo", "path"] }
    },
    {
      name: "webSearch",
      description: "Search web for solutions, documentation, error fixes.",
      parameters: { type: "OBJECT", properties: {
        query: { type: "STRING" }
      }, required: ["query"] }
    },
    {
      name: "readWebPage",
      description: "Fetch and read a webpage. Use for API docs, GitHub issues, StackOverflow.",
      parameters: { type: "OBJECT", properties: {
        url: { type: "STRING" }
      }, required: ["url"] }
    },
    {
      name: "openUrl",
      description: "Open a URL in device browser.",
      parameters: { type: "OBJECT", properties: {
        url: { type: "STRING" }
      }, required: ["url"] }
    },
    {
      name: "runCommand",
      description: "Run terminal command in Termux. Use for npm, node, python, git, grep, ls, find etc. Returns output.",
      parameters: { type: "OBJECT", properties: {
        command: { type: "STRING" },
        workDir: { type: "STRING" }
      }, required: ["command"] }
    },
    {
      name: "n8nWebhook",
      description: "Trigger n8n automation webhook.",
      parameters: { type: "OBJECT", properties: {
        url: { type: "STRING" },
        payload: { type: "OBJECT" }
      }, required: ["url"] }
    },
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
server.listen(PORT, () => console.log("Solanacy Founder AI v1.1 running on port " + PORT));
