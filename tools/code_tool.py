import subprocess
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

def write_code(description: str, language: str = "python") -> str:
    """Generate code based on description"""
    return f"Code task noted: Write {language} code for: {description}\n[Agent will generate this using its language model capabilities]"

def run_code(code: str) -> str:
    """Execute Python code safely"""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            tmp_path = f.name
        
        result = subprocess.run(
            ["python3", tmp_path],
            capture_output=True,
            text=True,
            timeout=15
        )
        
        os.unlink(tmp_path)
        
        output = result.stdout or ""
        error = result.stderr or ""
        
        if error and not output:
            return f"Error:\n{error}"
        elif error:
            return f"Output:\n{output}\nWarnings:\n{error}"
        return output or "Code executed successfully (no output)"
        
    except subprocess.TimeoutExpired:
        return "Code execution timed out (15s limit)"
    except Exception as e:
        return f"Execution error: {str(e)}"
