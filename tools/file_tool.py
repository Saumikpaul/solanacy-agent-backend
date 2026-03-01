import logging
import os

logger = logging.getLogger(__name__)
FILES_DIR = "/tmp/solanacy_files"
os.makedirs(FILES_DIR, exist_ok=True)

def create_file(filename: str, content: str) -> str:
    """Create or write a file"""
    try:
        filepath = os.path.join(FILES_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"✅ File created: {filename} ({len(content)} chars)"
    except Exception as e:
        return f"File create error: {str(e)}"

def read_file(filename: str) -> str:
    """Read a file"""
    try:
        filepath = os.path.join(FILES_DIR, filename)
        if not os.path.exists(filepath):
            return f"File not found: {filename}"
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"File read error: {str(e)}"

def list_files() -> str:
    """List all files"""
    try:
        files = os.listdir(FILES_DIR)
        if not files:
            return "No files stored."
        result = ["📁 Stored Files:\n"]
        for f in files:
            filepath = os.path.join(FILES_DIR, f)
            size = os.path.getsize(filepath)
            result.append(f"• {f} ({size} bytes)")
        return "\n".join(result)
    except Exception as e:
        return f"List files error: {str(e)}"
