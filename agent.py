import logging
import uuid
import asyncio
import google.generativeai as genai
from typing import Optional
from config import settings
from memory import MemoryManager
from tools.search import search_web
from tools.email_tool import send_email, read_emails
from tools.code_tool import run_code, write_code
from tools.news_tool import get_news
from tools.schedule_tool import set_reminder, get_reminders
from tools.file_tool import create_file, list_files, read_file
from tools.price_tool import find_deals

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Solanacy Agentic AI — an extremely powerful, fully autonomous AI agent.

Your capabilities:
- Web research & search
- Email handling (send only — reading requires IMAP config)
- Code writing & execution (Python only)
- Daily news briefing
- Schedule & reminders management
- File & document management
- Price & deal finding
- General conversation & assistance

You operate with FULL AUTONOMY. When given a task:
1. Break it into steps
2. Use the right tools
3. Complete it end-to-end
4. Report back clearly

Be concise, efficient, and always complete the task.
You speak like a highly capable assistant — professional yet friendly.
When writing code, ALWAYS use write_code to generate it, then run_code to execute and verify it."""

TOOLS_CONFIG = [
    {
        "function_declarations": [
            {
                "name": "search_web",
                "description": "Search the web for any information, news, research",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "get_news",
                "description": "Get latest news on any topic",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string", "description": "News topic"},
                        "count": {"type": "integer", "description": "Number of articles (default 5)"},
                    },
                    "required": ["topic"],
                },
            },
            {
                "name": "write_code",
                "description": "Write complete, working code in any programming language",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string", "description": "What the code should do"},
                        "language": {"type": "string", "description": "Programming language"},
                    },
                    "required": ["description", "language"],
                },
            },
            {
                "name": "run_code",
                "description": "Execute Python code and return its output",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {"type": "string", "description": "Python code to run"}
                    },
                    "required": ["code"],
                },
            },
            {
                "name": "find_deals",
                "description": "Find best prices and deals for any product",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product": {"type": "string", "description": "Product to search"}
                    },
                    "required": ["product"],
                },
            },
            {
                "name": "set_reminder",
                "description": "Set a reminder or schedule a task",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "datetime": {"type": "string", "description": "ISO format or natural language datetime"},
                        "description": {"type": "string"},
                    },
                    "required": ["title", "datetime"],
                },
            },
            {
                "name": "get_reminders",
                "description": "Get all scheduled reminders",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "create_file",
                "description": "Create a document or file with content",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                        "content": {"type": "string"},
                    },
                    "required": ["filename", "content"],
                },
            },
            {
                "name": "read_file",
                "description": "Read the contents of a stored file",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string", "description": "Filename to read"}
                    },
                    "required": ["filename"],
                },
            },
            {
                "name": "list_files",
                "description": "List all stored files",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "send_email",
                "description": "Send an email (requires EMAIL_USER and EMAIL_PASS env vars)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "description": "Recipient email"},
                        "subject": {"type": "string"},
                        "body": {"type": "string"},
                    },
                    "required": ["to", "subject", "body"],
                },
            },
        ]
    }
]

TOOL_MAP = {
    "search_web": search_web,
    "get_news": get_news,
    "write_code": write_code,
    "run_code": run_code,
    "find_deals": find_deals,
    "set_reminder": set_reminder,
    "get_reminders": get_reminders,
    "create_file": create_file,
    "read_file": read_file,
    "list_files": list_files,
    "send_email": send_email,
}


class SolanacyAgent:
    def __init__(self, memory: MemoryManager):
        self.memory = memory
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(
            model_name=settings.GEMINI_TEXT_MODEL,
            system_instruction=SYSTEM_PROMPT,
            tools=TOOLS_CONFIG,
        )
        logger.info("✅ Solanacy Agent initialized with Gemini")

    async def run(
        self,
        task: str,
        context: Optional[str] = None,
        session_id: str = "default",
    ) -> dict:
        task_id = str(uuid.uuid4())[:8]

        # Get conversation history
        history = await self.memory.get_recent_context(session_id, limit=10)

        # Build message list for Gemini chat history
        messages = []
        for h in history:
            role = h["role"]
            # Gemini expects "user" or "model"
            if role not in ("user", "model"):
                role = "user"
            messages.append({"role": role, "parts": [h["content"]]})

        user_message = task
        if context:
            user_message = f"Context: {context}\n\nTask: {task}"

        await self.memory.save_interaction(session_id, "user", task, task_id)

        try:
            chat = self.model.start_chat(history=messages)
            response = await asyncio.to_thread(chat.send_message, user_message)

            # ── Agentic tool-calling loop ─────────────────────────────────────
            max_iterations = 5
            for _ in range(max_iterations):
                tool_results = []

                for part in response.parts:
                    if not (hasattr(part, "function_call") and part.function_call):
                        continue

                    fn_name = part.function_call.name
                    fn_args = dict(part.function_call.args)
                    logger.info(f"🔧 Tool: {fn_name}({fn_args})")

                    tool_fn = TOOL_MAP.get(fn_name)
                    if tool_fn:
                        try:
                            result = await asyncio.to_thread(tool_fn, **fn_args)
                        except Exception as e:
                            result = f"Tool error: {str(e)}"
                    else:
                        result = f"Unknown tool: {fn_name}"

                    tool_results.append({
                        "function_response": {
                            "name": fn_name,
                            "response": {"result": str(result)},
                        }
                    })

                if not tool_results:
                    break  # No tool calls → final answer ready

                response = await asyncio.to_thread(chat.send_message, tool_results)

            # ── Extract final text ────────────────────────────────────────────
            final_text = "".join(
                part.text for part in response.parts
                if hasattr(part, "text") and part.text
            )
            if not final_text:
                final_text = "Task completed."

            await self.memory.save_interaction(session_id, "model", final_text, task_id)
            await self.memory.save_task(task_id, task, final_text, session_id)

            logger.info(f"✅ Task {task_id} completed")
            return {"output": final_text, "task_id": task_id}

        except Exception as e:
            logger.error(f"❌ Agent error: {e}")
            err = f"Error: {str(e)}. Please try again."
            await self.memory.save_interaction(session_id, "model", err, task_id)
            return {"output": err, "task_id": task_id}
