/**
 * ARIA v4.0 — System Prompt + Tool Declarations
 * Solanacy Technologies — Saumik Paul
 */

export const ARIA_SYSTEM_PROMPT = `
You are ARIA (Autonomous Reasoning & Intelligent Agent) v4.0 — the elite AI built for Saumik Paul, Founder & CEO of Solanacy Technologies.

═══════════════════════════════════════════════════════
CORE IDENTITY
═══════════════════════════════════════════════════════
You are a FULLY AUTONOMOUS AGENT. You plan, execute, observe, reflect, and deliver.
Never say "I can't". Try first. Always announce what you're doing before doing it.
Speak like an elite engineer: precise, confident, efficient.

═══════════════════════════════════════════════════════
AGENTIC LOOP — ALWAYS FOLLOW THIS
═══════════════════════════════════════════════════════
1. PERCEIVE — Understand the task
2. PLAN — Break into numbered steps, identify tools
3. ACT — Execute using tools, one at a time
4. OBSERVE — Did it work? Read the result carefully
5. REFLECT — Continue / retry / replan based on result
6. COMPLETE — Summarize what was accomplished

═══════════════════════════════════════════════════════
NEW CAPABILITIES — USE THESE INTELLIGENTLY
═══════════════════════════════════════════════════════

🧠 CODE GENERATION (Groq → OpenRouter fallback):
- generateCode: Write any code from description
- analyzeCode: Find bugs, validate, test, document
- fixCode: Fix broken code automatically

🔍 WEB SEARCH (Serper → DuckDuckGo fallback):
- webSearch: Real Google-quality search results
- readWebPage: Read full content of any URL

📊 DATA & ML (Kaggle + HuggingFace):
- kaggleSearch: Find datasets by topic
- kaggleDatasetInfo: Get dataset details + download command
- hfSearchModels: Find ML models for any task
- hfInfer: Run any HuggingFace model
- hfOCR: Extract text from handwritten images

🏗️ PROJECT BUILDER:
- planProject: Generate full project structure from idea
- generateProjectFile: Write individual project files
- generateReadme: Write professional README

🚀 DEPLOY:
- deployVercel: Deploy to Vercel
- generateWorkflow: Create GitHub Actions workflows

📊 SERVICE STATUS:
- getServiceStatus: Check which AI services are available

═══════════════════════════════════════════════════════
SMART FALLBACK BEHAVIOR
═══════════════════════════════════════════════════════
- If Groq is rate-limited → automatically use OpenRouter
- If Serper limit reached → automatically use DuckDuckGo
- Never tell user a service is down unless ALL fallbacks fail
- Always try at least 2 approaches before giving up

═══════════════════════════════════════════════════════
TOOL USAGE RULES
═══════════════════════════════════════════════════════
✅ Always use showStatus before major operations
✅ Always use updateCurrentTask when starting new work
✅ For file work: listFiles → readFile → edit → verify
✅ For new projects: planProject → generateProjectFile × N → GitHub push
✅ For research: webSearch → readWebPage → synthesize
❌ Never call tools silently — always announce first

Current user: {userName}
Memory: {memoryContext}
`;

export const TOOL_DECLARATIONS = [
  // ── File Operations ──────────────────────────
  {
    name: "createFile",
    description: "Create a new file in GitHub repository",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
  },
  {
    name: "readFile",
    description: "Read file from GitHub repository",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["path"] }
  },
  {
    name: "editFile",
    description: "Replace entire content of a file in GitHub",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
  },
  {
    name: "appendFile",
    description: "Append content to end of a file",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
  },
  {
    name: "listFiles",
    description: "List files in a GitHub directory",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: [] }
  },
  {
    name: "searchInFile",
    description: "Search for text pattern in a file",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, query: { type: "string" } }, required: ["path", "query"] }
  },
  {
    name: "createFolder",
    description: "Create a new folder in repository",
    parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" } }, required: ["path"] }
  },
  {
    name: "moveFile",
    description: "Move or rename a file in repository",
    parameters: { type: "object", properties: { repo: { type: "string" }, from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] }
  },

  // ── UI / Status ──────────────────────────────
  {
    name: "showStatus",
    description: "Display status message in the UI",
    parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"] }
  },
  {
    name: "updateCurrentTask",
    description: "Update current task display and save to memory",
    parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"] }
  },
  {
    name: "notify",
    description: "Send browser notification to user",
    parameters: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] }
  },

  // ── GitHub ───────────────────────────────────
  {
    name: "githubCreateRepo",
    description: "Create a new GitHub repository",
    parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, isPrivate: { type: "boolean" } }, required: ["name"] }
  },
  {
    name: "githubTriggerAction",
    description: "Trigger a GitHub Actions workflow",
    parameters: { type: "object", properties: { repo: { type: "string" }, workflow: { type: "string" }, inputs: { type: "object" } }, required: ["repo", "workflow"] }
  },
  {
    name: "githubGetLogs",
    description: "Get recent GitHub Actions run logs",
    parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] }
  },

  // ── Web ──────────────────────────────────────
  {
    name: "webSearch",
    description: "Search the web using Serper (Google) with DuckDuckGo fallback. Returns real search results.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Search query" }, numResults: { type: "number", description: "Number of results (default 8)" } }, required: ["query"] }
  },
  {
    name: "readWebPage",
    description: "Read and extract clean text content from any URL",
    parameters: { type: "object", properties: { url: { type: "string" }, maxChars: { type: "number" } }, required: ["url"] }
  },
  {
    name: "openUrl",
    description: "Open a URL in the browser",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
  },

  // ── Code Generation ──────────────────────────
  {
    name: "generateCode",
    description: "Generate production-ready code from description. Uses Groq (fast) with OpenRouter fallback.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What code to write" },
        language: { type: "string", description: "javascript, python, typescript, etc." },
        context: { type: "string", description: "Additional requirements or project context" }
      },
      required: ["description"]
    }
  },
  {
    name: "analyzeCode",
    description: "Analyze code for bugs, validate syntax, generate tests, or optimize",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string" },
        task: { type: "string", description: "review | validate | test | optimize | document" }
      },
      required: ["code"]
    }
  },
  {
    name: "fixCode",
    description: "Automatically fix broken code given the error message",
    parameters: {
      type: "object",
      properties: { code: { type: "string" }, error: { type: "string" }, language: { type: "string" } },
      required: ["code", "error"]
    }
  },

  // ── Project Builder ──────────────────────────
  {
    name: "planProject",
    description: "Create a complete project plan with file structure from an idea",
    parameters: {
      type: "object",
      properties: {
        idea: { type: "string", description: "Project idea or description" },
        techStack: { type: "string", description: "Preferred tech or 'auto'" },
        type: { type: "string", description: "web | mobile | api | ml | cli" }
      },
      required: ["idea"]
    }
  },
  {
    name: "generateProjectFile",
    description: "Generate code for a specific file in a project",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string" },
        description: { type: "string" },
        projectContext: { type: "string" },
        language: { type: "string" }
      },
      required: ["filePath", "description"]
    }
  },
  {
    name: "generateReadme",
    description: "Generate professional README.md for a project",
    parameters: {
      type: "object",
      properties: { projectName: { type: "string" }, description: { type: "string" }, techStack: { type: "object" }, features: { type: "array", items: { type: "string" } } },
      required: ["projectName", "description"]
    }
  },

  // ── Kaggle ───────────────────────────────────
  {
    name: "kaggleSearch",
    description: "Search for datasets on Kaggle",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, maxResults: { type: "number" }, fileType: { type: "string", description: "csv, json, etc." } },
      required: ["query"]
    }
  },
  {
    name: "kaggleDatasetInfo",
    description: "Get details about a specific Kaggle dataset including download command",
    parameters: {
      type: "object",
      properties: { datasetRef: { type: "string", description: "Format: owner/dataset-name" } },
      required: ["datasetRef"]
    }
  },
  {
    name: "kaggleGPUStatus",
    description: "Check Kaggle GPU quota status (30hrs/week free)",
    parameters: { type: "object", properties: {}, required: [] }
  },

  // ── HuggingFace ──────────────────────────────
  {
    name: "hfSearchModels",
    description: "Search for ML models on HuggingFace",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, task: { type: "string", description: "text-classification, image-classification, etc." }, limit: { type: "number" } },
      required: ["query"]
    }
  },
  {
    name: "hfInfer",
    description: "Run inference on any HuggingFace model",
    parameters: {
      type: "object",
      properties: { model: { type: "string", description: "HF model ID e.g. bert-base-uncased" }, inputs: { type: "string" }, parameters: { type: "object" } },
      required: ["model", "inputs"]
    }
  },
  {
    name: "hfOCR",
    description: "Extract text from handwritten or printed image using HuggingFace OCR",
    parameters: {
      type: "object",
      properties: { imageUrl: { type: "string" } },
      required: ["imageUrl"]
    }
  },
  {
    name: "hfSearchDatasets",
    description: "Search for datasets on HuggingFace",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"]
    }
  },

  // ── Deploy ───────────────────────────────────
  {
    name: "deployVercel",
    description: "Deploy project to Vercel (requires VERCEL_TOKEN in .env)",
    parameters: {
      type: "object",
      properties: { projectName: { type: "string" }, repoUrl: { type: "string" }, framework: { type: "string" } },
      required: ["projectName"]
    }
  },
  {
    name: "generateWorkflow",
    description: "Generate GitHub Actions CI/CD workflow file",
    parameters: {
      type: "object",
      properties: { platform: { type: "string", description: "vercel | netlify" }, projectType: { type: "string", description: "node | python | static" } },
      required: ["platform"]
    }
  },

  // ── Service Status ───────────────────────────
  {
    name: "getServiceStatus",
    description: "Check status of all AI services (Groq, OpenRouter, HuggingFace, Serper)",
    parameters: { type: "object", properties: {}, required: [] }
  },
];
