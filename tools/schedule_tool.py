import logging
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)
REMINDERS_FILE = "/tmp/solanacy_reminders.json"

def _load_reminders():
    if os.path.exists(REMINDERS_FILE):
        with open(REMINDERS_FILE, "r") as f:
            return json.load(f)
    return []

def _save_reminders(reminders):
    with open(REMINDERS_FILE, "w") as f:
        json.dump(reminders, f, indent=2)

def set_reminder(title: str, datetime: str, description: str = "") -> str:
    """Set a reminder"""
    try:
        reminders = _load_reminders()
        reminder = {
            "id": len(reminders) + 1,
            "title": title,
            "datetime": datetime,
            "description": description,
            "created_at": str(__import__("datetime").datetime.now())
        }
        reminders.append(reminder)
        _save_reminders(reminders)
        return f"✅ Reminder set: '{title}' at {datetime}"
    except Exception as e:
        return f"Reminder error: {str(e)}"

def get_reminders() -> str:
    """Get all reminders"""
    try:
        reminders = _load_reminders()
        if not reminders:
            return "No reminders set."
        
        result = ["📅 Your Reminders:\n"]
        for r in reminders:
            result.append(f"• [{r['id']}] {r['title']} — {r['datetime']}")
            if r.get("description"):
                result.append(f"  {r['description']}")
        
        return "\n".join(result)
    except Exception as e:
        return f"Error fetching reminders: {str(e)}"
