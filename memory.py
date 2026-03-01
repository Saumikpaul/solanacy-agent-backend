import logging
import uuid
from datetime import datetime
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self):
        self.db = None
        self._initialized = False

    async def initialize(self):
        try:
            creds_dict = settings.get_firebase_credentials()
            if not firebase_admin._apps:
                if creds_dict:
                    cred = credentials.Certificate(creds_dict)
                else:
                    cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            self._initialized = True
            logger.info("✅ Firebase Firestore connected")
        except Exception as e:
            logger.error(f"❌ Firebase init error: {e}")
            self._initialized = False

    async def save_interaction(self, session_id: str, role: str, content: str, task_id: str = None):
        if not self._initialized or not self.db:
            return None
        try:
            doc_ref = self.db.collection("sessions").document(session_id).collection("messages").document()
            doc_ref.set({
                "role": role,
                "content": content,
                "task_id": task_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "session_id": session_id
            })
            return doc_ref.id
        except Exception as e:
            logger.error(f"❌ Save interaction error: {e}")
            return None

    async def get_history(self, session_id: str, limit: int = 20) -> list:
        if not self._initialized or not self.db:
            return []
        try:
            docs = (
                self.db.collection("sessions")
                .document(session_id)
                .collection("messages")
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            history = []
            for doc in docs:
                data = doc.to_dict()
                history.append({
                    "id": doc.id,
                    "role": data.get("role"),
                    "content": data.get("content"),
                    "timestamp": str(data.get("timestamp")),
                    "task_id": data.get("task_id")
                })
            return list(reversed(history))
        except Exception as e:
            logger.error(f"❌ Get history error: {e}")
            return []

    async def get_recent_context(self, session_id: str, limit: int = 10) -> list:
        history = await self.get_history(session_id, limit)
        return [{"role": h["role"], "content": h["content"]} for h in history]

    async def save_task(self, task_id: str, task: str, result: str, session_id: str):
        if not self._initialized or not self.db:
            return
        try:
            self.db.collection("tasks").document(task_id).set({
                "task": task,
                "result": result,
                "session_id": session_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "status": "completed"
            })
        except Exception as e:
            logger.error(f"❌ Save task error: {e}")

    async def clear_history(self, session_id: str):
        if not self._initialized or not self.db:
            return
        try:
            docs = self.db.collection("sessions").document(session_id).collection("messages").stream()
            for doc in docs:
                doc.reference.delete()
            logger.info(f"✅ History cleared for session: {session_id}")
        except Exception as e:
            logger.error(f"❌ Clear history error: {e}")
