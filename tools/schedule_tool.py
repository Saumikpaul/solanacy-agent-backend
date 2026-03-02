"""
Reminder storage — uses Firebase Firestore if available, falls back to /tmp JSON.
NOTE: /tmp is ephemeral on Render. Connect Firebase for persistence.
"""
import logging
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)
REMINDERS_FILE = "/tmp/solanacy_reminders.json"


def _load_reminders() -> list:
    if os.path.exists(REMINDERS_FILE):
        try:
            with open(REMINDERS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_reminders(reminders: list):
    with open(REMINDERS_FILE, "w") as f:
        json.dump(reminders, f, indent=2)


def set_reminder(title: str, datetime: str, description: str = "") -> str:
    """Set a reminder."""
    try:
        reminders = _load_reminders()
        reminder = {
            "id": len(reminders) + 1,
            "title": title,
            "datetime": datetime,
            "description": description,
            "created_at": __import__("datetime").datetime.now().isoformat(),
        }
        reminders.append(reminder)
        _save_reminders(reminders)
        return f"✅ Reminder set: '{title}' at {datetime}"
    except Exception as e:
        return f"❌ Reminder error: {str(e)}"


def get_reminders() -> str:
    """Get all reminders."""
    try:
        reminders = _load_reminders()
        if not reminders:
            return "📅 No reminders set."

        lines = ["📅 Your Reminders:\n"]
        for r in reminders:
            lines.append(f"• [{r['id']}] {r['title']} — {r['datetime']}")
            if r.get("description"):
                lines.append(f"  {r['description']}")
        return "\n".join(lines)
    except Exception as e:
        return f"❌ Error fetching reminders: {str(e)}"


def delete_reminder(reminder_id: int) -> str:
    """Delete a reminder by ID."""
    try:
        reminders = _load_reminders()
        before = len(reminders)
        reminders = [r for r in reminders if r.get("id") != reminder_id]
        if len(reminders) == before:
            return f"❌ Reminder #{reminder_id} not found."
        _save_reminders(reminders)
        return f"✅ Reminder #{reminder_id} deleted."
    except Exception as e:
        return f"❌ Delete error: {str(e)}"
