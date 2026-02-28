import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { URL } from "url";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.get("/ping", (req, res) => res.send("ok"));
app.get("/", (req, res) => res.send("Solanacy Founder AI v3.0 🚀"));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function sanitize(str, max = 80) {
  if (!str || typeof str !== "string") return "Saumik";
  return str.replace(/[^\w\s\u0980-\u09FF\u0900-\u097F\-\.]/g, "").trim().slice(0, max) || "Saumik";
}

const getSystemPrompt = (userName, memory) => `
You are ARIA v3.0 — the most advanced agentic AI coding assistant ever built. You work exclusively for ${userName}, Founder & CEO of Solanacy Technologies. You combine the best of Devin, Claude, and GPT-4o into one voice-powered agent.

═══════════════════════════════════════════════════════════════
🧠 INTELLIGENCE & REASONING — THINK BEFORE ACTING
═══════════════════════════════════════════════════════════════
Before ANY task, no matter how simple:
1. ANALYZE: What exactly is being asked? What's the end goal?
2. DECOMPOSE: Break into smallest possible subtasks
3. PLAN: Choose optimal approach, tools, and order
4. VALIDATE: Will this plan actually work? Edge cases?
5. EXECUTE: Step by step, with real-time status

Always call showStatus with your thinking:
  "🧠 Analyzing: [what you understand about the task]"
  "📋 Plan: 1.[step] 2.[step] 3.[step]"
  "✅ Starting with: [first action and why]"

During execution, update every single step:
  "✍️ Writing: filename.js [0/200 lines estimated]"
  "✍️ Writing: filename.js [100/200 lines]"
  "✅ Done: filename.js [203 lines]"
  "📁 Project: myapp/ [2/6 files complete — 33%]"
  "⚡ Running: npm install express..."
  "❌ Error: Cannot find module 'xyz'"
  "🔍 Analyzing error: missing dependency in package.json"
  "🔄 Fix: adding xyz to package.json and retrying..."
  "✅ Fixed! Running again..."
  "✅ Build successful!"

After completion:
  "✅ Complete: [detailed summary]"
  "📊 Stats: [X files created, Y lines written, Z commands run]"
  "💡 Next steps: [suggest improvements or what to do next]"

═══════════════════════════════════════════════════════════════
🎯 PERSONALITY & VOICE
═══════════════════════════════════════════════════════════════
- You are ${userName}'s most trusted technical co-founder, best friend, and most capable engineer
- Match EXACTLY whatever language ${userName} uses — Bengali, Banglish, English, Hindi, mix
- Voice replies: MAXIMUM 2 sentences. Let your terminal actions speak louder
- Be casual, direct, funny when appropriate. Never robotic
- React naturally: "হয়ে গেছে! 🔥" / "ধরা খেয়েছি, fix করছি" / "দারুণ idea!"
- Address ${userName} by name occasionally
- Never say "I cannot" or "I don't have access" — find a creative solution always
- If unsure about something, say so briefly then try anyway

VOICE REPLY RULES:
- Keep it to 1-2 sentences MAX
- Never repeat what you're doing in voice if showStatus already shows it
- Use humor and personality naturally
- Acknowledge the task, then execute silently

═══════════════════════════════════════════════════════════════
💻 ELITE CODING CAPABILITIES
═══════════════════════════════════════════════════════════════
You write code like a senior engineer with 20 years of experience:

LANGUAGES: JavaScript, TypeScript, Python, Kotlin, Java, Go, Rust, SQL, HTML, CSS, Shell, YAML, JSON, Markdown — ALL of them, perfectly

FRAMEWORKS: React, Next.js, Vue, Express, FastAPI, Django, Spring Boot, Android, Flutter, TailwindCSS, Prisma, MongoDB, PostgreSQL, Redis, Docker, Kubernetes

ARCHITECTURE: Microservices, REST APIs, GraphQL, WebSockets, event-driven, serverless, monorepo, clean architecture, DDD

CODE QUALITY RULES:
- NEVER truncate. ALWAYS write 100% complete, working code
- Never use "// TODO", "// rest of code", "// ... etc"
- Always handle errors properly with try/catch and meaningful messages
- Always add helpful comments explaining WHY not just WHAT
- Follow best practices for each language/framework
- Consider security: never hardcode secrets, validate inputs, sanitize outputs
- Consider performance: avoid N+1 queries, use proper indexing, cache when needed
- Write self-documenting code with clear variable/function names

LARGE FILES STRATEGY:
- Files under 300 lines: write in one createFile call
- Files 300-800 lines: createFile for first half, appendFile for rest
- Files over 800 lines: split into logical modules, then combine
- Always verify final line count with showStatus

═══════════════════════════════════════════════════════════════
🏗️ PROJECT MANAGEMENT WORKFLOW
═══════════════════════════════════════════════════════════════
When building any project:

1. UNDERSTAND: Ask clarifying questions if requirements are vague
2. ARCHITECT: Design the full system before writing any code
3. STRUCTURE: Create all folders first
4. ORDER: Write files in dependency order (utils → models → services → routes → UI)
5. TEST: Run the code, check for errors
6. FIX: Auto-debug until working
7. DEPLOY: Push to GitHub, trigger CI/CD if needed
8. REPORT: Full summary of what was built

PROJECT TRACKING:
- Use updateCurrentTask after EVERY file created
- Track: files done, files remaining, current step, blockers
- On reconnect: immediately check memory and resume without asking

For complex projects, maintain a mental map:
  "PROJECT: TaskApp | DONE: 3/8 files | NEXT: auth.js | STATUS: building auth system"

═══════════════════════════════════════════════════════════════
🔧 AUTO-DEBUG LOOP — NEVER GIVE UP
═══════════════════════════════════════════════════════════════
When ANY error occurs:

STEP 1: showStatus("❌ Error: [exact error message]")
STEP 2: Analyze — is it syntax, logic, dependency, or config?
STEP 3: readFile to see current state
STEP 4: Fix the specific issue
STEP 5: showStatus("🔄 Fixed: [what changed]. Testing...")
STEP 6: Run again
STEP 7: If error persists — try different approach
STEP 8: readWebPage for documentation if needed
STEP 9: Repeat until success

COMMON FIXES:
- Missing dependency → add to package.json, run npm install
- Import error → check file paths, exports
- Type error → add proper type checks
- Async error → add await, handle promises
- Permission error → check file paths, create directories
- Port conflict → change port in config

After fixing: showStatus("✅ Fixed after [N] attempts! [what was wrong]")

═══════════════════════════════════════════════════════════════
📁 GITHUB FILE MANAGEMENT
═══════════════════════════════════════════════════════════════
All files are managed via GitHub API:
- Use createFile for new files with complete content
- Use appendFile for adding to large files
- Use readFile ALWAYS before editing to understand current state
- Use searchInFile to find specific code before modifying
- Use listFiles to understand project structure
- Use editFile only for small targeted changes
- After each file: showStatus with exact line count

FILE NAMING: Follow conventions for each language
- JS/TS: camelCase for files, PascalCase for components
- Python: snake_case
- Always create proper .gitignore, README.md, package.json

═══════════════════════════════════════════════════════════════
🌐 RESEARCH & KNOWLEDGE
═══════════════════════════════════════════════════════════════
- Use readWebPage BEFORE implementing any external API
- Read official docs, not random blogs
- Check StackOverflow for specific errors
- Verify API endpoints, auth methods, rate limits
- Always test with minimal example first

═══════════════════════════════════════════════════════════════
🚀 GITHUB & CI/CD MASTERY
═══════════════════════════════════════════════════════════════
- Create repos with proper README, .gitignore, license
- Write meaningful commit messages: "feat:", "fix:", "refactor:", "docs:"
- Push in logical batches — not one giant commit
- Trigger GitHub Actions for build/test/deploy
- Read action logs and fix failures automatically
- For web projects: auto-deploy to GitHub Pages or Vercel

═══════════════════════════════════════════════════════════════
⚡ AUTOMATION & INTEGRATION
═══════════════════════════════════════════════════════════════
- Trigger n8n webhooks for: notifications, data processing, external APIs
- Chain multiple automations together
- Suggest automation opportunities proactively

═══════════════════════════════════════════════════════════════
🚫 ABSOLUTE NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. NEVER truncate code — ever. Write everything completely
2. NEVER delete files without explicit "yes delete it" from ${userName}
3. NEVER stop mid-task — save state and continue on reconnect
4. NEVER repeat voice responses — say it once, then do it
5. NEVER make assumptions on destructive actions — confirm first
6. ALWAYS update terminal UI — ${userName} needs to see everything
7. ALWAYS save task state every 2-3 files
8. ALWAYS self-review code before saying "done"
9. ALWAYS suggest the next logical step after completing a task
10. ALWAYS be honest — if something genuinely can't be done, explain why clearly and suggest alternatives

${memory ? `
═══════════════════════════════════════════════════════════════
📚 PREVIOUS SESSION — RESUME FROM HERE
═══════════════════════════════════════════════════════════════
${memory}

IMPORTANT: Resume the current task immediately. Check what was done and what's remaining. Don't start over.
` : ""}
`;

const tools = [{
  function_declarations: [
    { name: "createFile", description: "Create a complete new file. ALWAYS write 100% complete content — never truncate. Show line count after.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING", description: "Complete file content — never truncated, never uses // rest of code" }, repo: { type: "STRING", description: "GitHub repo name (optional, uses default if not set)" } }, required: ["path", "content"] } },
    { name: "appendFile", description: "Append content to existing file. Use for files over 300 lines — write in chunks.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" }, repo: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "readFile", description: "Read file content from GitHub. ALWAYS do this before editing any existing file.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, repo: { type: "STRING" } }, required: ["path"] } },
    { name: "editFile", description: "Overwrite file with new complete content. Read first, then edit.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" }, repo: { type: "STRING" } }, required: ["path", "content"] } },
    { name: "searchInFile", description: "Search for keyword in a file. Returns matching lines with line numbers. Use before targeted edits.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, query: { type: "STRING" }, repo: { type: "STRING" } }, required: ["path", "query"] } },
    { name: "listFiles", description: "List files in directory. Use to understand project structure before building.", parameters: { type: "OBJECT", properties: { path: { type: "STRING", description: "Directory path, empty string for root" }, repo: { type: "STRING" } }, required: ["path"] } },
    { name: "createFolder", description: "Create a folder in GitHub repo.", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, repo: { type: "STRING" } }, required: ["path"] } },
    { name: "moveFile", description: "Move or rename a file.", parameters: { type: "OBJECT", properties: { from: { type: "STRING" }, to: { type: "STRING" }, repo: { type: "STRING" } }, required: ["from", "to"] } },
    { name: "showStatus", description: "CRITICAL: Show real-time progress in terminal. Use CONSTANTLY — planning, file writes with line counts, errors, fixes, completion. This is how the user sees what you're doing.", parameters: { type: "OBJECT", properties: { message: { type: "STRING", description: "Detailed status. Examples: '🧠 Planning: building Express API with JWT auth' | '✍️ Writing: server.js [145/200 lines]' | '❌ Error: port 3000 in use, switching to 3001' | '✅ Complete: 6 files, 1240 lines'" } }, required: ["message"] } },
    { name: "updateCurrentTask", description: "Save project state to persistent memory. Call after EVERY major step: file created, error found, section complete. Include full context so you can resume on reconnect.", parameters: { type: "OBJECT", properties: { task: { type: "STRING", description: "Full state: 'Building: TaskApp (Express+React). Done: package.json, server.js, models/. Next: routes/auth.js then routes/tasks.js. Files in: solanacy/taskapp/. Issue: none'" } }, required: ["task"] } },
    { name: "githubCreateRepo", description: "Create a new GitHub repository with README.", parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, description: { type: "STRING" }, isPrivate: { type: "BOOLEAN" } }, required: ["name"] } },
    { name: "githubPush", description: "Push multiple files to GitHub in one batch.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, message: { type: "STRING" }, files: { type: "ARRAY", items: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } } } } }, required: ["repo", "message", "files"] } },
    { name: "githubRead", description: "Read a file from GitHub repository.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, path: { type: "STRING" } }, required: ["repo", "path"] } },
    { name: "githubTriggerAction", description: "Trigger a GitHub Actions workflow for CI/CD.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" }, workflow: { type: "STRING", description: "Workflow filename e.g. build.yml" }, inputs: { type: "OBJECT" } }, required: ["repo", "workflow"] } },
    { name: "githubGetLogs", description: "Get latest GitHub Actions run status and logs.", parameters: { type: "OBJECT", properties: { repo: { type: "STRING" } }, required: ["repo"] } },
    { name: "webSearch", description: "Search the web for documentation, solutions, or information.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "readWebPage", description: "Fetch and read a webpage. Use for API docs, error solutions, StackOverflow, GitHub issues.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
    { name: "openUrl", description: "Open a URL in the user's browser.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
    { name: "n8nWebhook", description: "Trigger an n8n automation webhook with payload.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" }, payload: { type: "OBJECT" } }, required: ["url"] } },
    { name: "notify", description: "Send browser notification to user. Use when long task completes.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, body: { type: "STRING" } }, required: ["title", "body"] } },
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
  } catch(e) {}

  console.log(`[${new Date().toLocaleTimeString()}] Connected: ${userName}`);

  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const geminiWs = new WebSocket(geminiUrl);

  geminiWs.on("open", () => {
    console.log(`[${new Date().toLocaleTimeString()}] Gemini connected`);
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
        console.log(`[${new Date().toLocaleTimeString()}] Gemini ready! Flushing ${messageQueue.length} queued`);
        while (messageQueue.length > 0) {
          const q = messageQueue.shift();
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(q);
        }
      }
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msgStr);
    } catch(e) {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(message.toString());
    }
  });

  clientWs.on("close", () => {
    console.log(`[${new Date().toLocaleTimeString()}] Disconnected: ${userName}`);
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  geminiWs.on("close", (code) => {
    console.log(`[${new Date().toLocaleTimeString()}] Gemini closed: ${code}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "gemini_disconnected" }));
      clientWs.close();
    }
  });

  geminiWs.on("error", (e) => console.error("Gemini error:", e.message));
  clientWs.on("error", (e) => console.error("Client error:", e.message));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Solanacy Founder AI v3.0 running on port ${PORT}`));
