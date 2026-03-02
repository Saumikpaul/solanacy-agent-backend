import subprocess
import tempfile
import os
import logging
import google.generativeai as genai
from config import settings

logger = logging.getLogger(__name__)

# ── Sandboxed code execution ──────────────────────────────────────────────────
# Dangerous imports that could compromise the server
_BLOCKED = [
    "import os", "import sys", "import subprocess", "import shutil",
    "__import__", "open(", "exec(", "eval(", "compile(",
    "importlib", "socket", "requests", "urllib", "http.client",
    "ftplib", "smtplib", "paramiko", "pexpect",
]

def _is_safe(code: str) -> tuple[bool, str]:
    low = code.lower()
    for pattern in _BLOCKED:
        if pattern.lower() in low:
            return False, f"Blocked pattern detected: `{pattern}`"
    return True, ""


def run_code(code: str) -> str:
    """Execute Python code in a restricted subprocess."""
    safe, reason = _is_safe(code)
    if not safe:
        return (
            f"⛔ Code blocked for security: {reason}\n"
            "Allowed: math, string ops, data processing, algorithms. "
            "Not allowed: file I/O, network, OS commands, imports of system modules."
        )

    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            tmp_path = f.name

        result = subprocess.run(
            ["python3", tmp_path],
            capture_output=True,
            text=True,
            timeout=10,
            # Restrict environment
            env={"PATH": "/usr/bin:/bin", "HOME": "/tmp"},
        )
        os.unlink(tmp_path)

        output = result.stdout.strip()
        error = result.stderr.strip()

        if error and not output:
            return f"❌ Error:\n{error}"
        if error:
            return f"📤 Output:\n{output}\n\n⚠️ Warnings:\n{error}"
        return output or "✅ Executed successfully (no output)"

    except subprocess.TimeoutExpired:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        return "⏱️ Execution timed out (10s limit)"
    except Exception as e:
        return f"❌ Execution error: {str(e)}"


def write_code(description: str, language: str = "python") -> str:
    """Generate code using Gemini."""
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_TEXT_MODEL)

        prompt = (
            f"Write complete, working {language} code for the following task:\n\n"
            f"{description}\n\n"
            "Requirements:\n"
            "- Include all necessary imports\n"
            "- Add brief comments for clarity\n"
            "- Make it production-quality\n"
            "- Return ONLY the code, no explanations outside of code comments"
        )

        response = model.generate_content(prompt)
        code = response.text.strip()

        # Strip markdown fences if present
        if code.startswith("```"):
            lines = code.split("\n")
            # Remove first and last fence lines
            code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return f"```{language}\n{code}\n```"

    except Exception as e:
        logger.error(f"write_code error: {e}")
        return f"❌ Code generation failed: {str(e)}"
