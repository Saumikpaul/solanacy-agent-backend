import logging
import uuid
from datetime import datetime
from typing import Optional
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class InMemoryFallback:
    """Fallback in-memory store when Firebase is unavailable."""

    def __init__(self):
        self._sessions = defaultdict(lambda: deque(maxlen=200))
        self._tasks = {}
        logger.warning(
            "⚠️  Using IN-MEMORY storage. Data will NOT persist on restart.\n"
            "   → Fix: Set FIREBASE_CREDENTIALS env var in Render dashboard.\n"
            "   → Download: Firebase Console → Project Settings → Service Accounts → Generate new private key"
        )

    def save_message(self, session_id, role, content, task_id=None):
        self._sessions[session_id].append({
            "id": str(uuid.uuid4())[:8],
            "role": role,
            "content": content,
            "task_id": task_id,
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id,
        })

    def get_messages(self, session_id, limit=20):
        msgs = list(self._sessions[session_id])
        return msgs[-limit:]

    def save_task(self, task_id, task, result, session_id):
        self._tasks[task_id] = {
            "task": task,
            "result": result,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "status": "completed",
        }

    def clear(self, session_id):
        self._sessions[session_id].clear()


class MemoryManager:
    def __init__(self):
        self.db = None
        self._initialized = False
        self._fallback: Optional[InMemoryFallback] = None

    async def initialize(self):
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            from config import settings

            creds_dict = settings.get_firebase_credentials()

            required_keys = {"type", "project_id", "private_key", "client_email"}
            if not required_keys.issubset(creds_dict.keys()):
                raise ValueError(
                    "FIREBASE_CREDENTIALS env var is empty or missing required fields. "
                    "Set it to the full contents of your Firebase service account JSON."
                )

            if not firebase_admin._apps:
                cred = credentials.Certificate(creds_dict)
                firebase_admin.initialize_app(cred)

            self.db = firestore.client()
            self._initialized = True
            logger.info("✅ Firebase Firestore connected")

        except Exception as e:
            logger.error(f"❌ Firebase init error: {e}")
            logger.warning("🔄 Falling back to in-memory storage")
            self._fallback = InMemoryFallback()
            self._initialized = False

    # ── Public API ────────────────────────────────────────────────────────────

    async def save_interaction(self, session_id: str, role: str, content: str, task_id: str = None):
        if self._initialized and self.db:
            return await self._firebase_save(session_id, role, content, task_id)
        if self._fallback:
            self._fallback.save_message(session_id, role, content, task_id)

    async def get_history(self, session_id: str, limit: int = 20) -> list:
        if self._initialized and self.db:
            return await self._firebase_get_history(session_id, limit)
        if self._fallback:
            return self._fallback.get_messages(session_id, limit)
        return []

    async def get_recent_context(self, session_id: str, limit: int = 10) -> list:
        history = await self.get_history(session_id, limit)
        return [{"role": h["role"], "content": h["content"]} for h in history]

    async def save_task(self, task_id: str, task: str, result: str, session_id: str):
        if self._initialized and self.db:
            return await self._firebase_save_task(task_id, task, result, session_id)
        if self._fallback:
            self._fallback.save_task(task_id, task, result, session_id)

    async def clear_history(self, session_id: str):
        if self._initialized and self.db:
            return await self._firebase_clear(session_id)
        if self._fallback:
            self._fallback.clear(session_id)

    @property
    def storage_type(self) -> str:
        return "firebase" if self._initialized else "memory"

    # ── Firebase internals ────────────────────────────────────────────────────

    async def _firebase_save(self, session_id, role, content, task_id):
        try:
            from firebase_admin import firestore
            doc_ref = (
                self.db.collection("sessions")
                .document(session_id)
                .collection("messages")
                .document()
            )
            doc_ref.set({
                "role": role,
                "content": content,
                "task_id": task_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "session_id": session_id,
            })
            return doc_ref.id
        except Exception as e:
            logger.error(f"❌ Firebase save error: {e}")

    async def _firebase_get_history(self, session_id, limit):
        try:
            from firebase_admin import firestore
            # Get latest N messages in ascending order (efficient)
            docs = (
                self.db.collection("sessions")
                .document(session_id)
                .collection("messages")
                .order_by("timestamp", direction=firestore.Query.ASCENDING)
                .limit_to_last(limit)
                .stream()
            )
            return [
                {
                    "id": doc.id,
                    "role": doc.to_dict().get("role"),
                    "content": doc.to_dict().get("content"),
                    "timestamp": str(doc.to_dict().get("timestamp")),
                    "task_id": doc.to_dict().get("task_id"),
                }
                for doc in docs
            ]
        except Exception as e:
            logger.error(f"❌ Firebase get history error: {e}")
            return []

    async def _firebase_save_task(self, task_id, task, result, session_id):
        try:
            from firebase_admin import firestore
            self.db.collection("tasks").document(task_id).set({
                "task": task,
                "result": result,
                "session_id": session_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "status": "completed",
            })
        except Exception as e:
            logger.error(f"❌ Firebase save task error: {e}")

    async def _firebase_clear(self, session_id):
        try:
            docs = (
                self.db.collection("sessions")
                .document(session_id)
                .collection("messages")
                .stream()
            )
            for doc in docs:
                doc.reference.delete()
            logger.info(f"✅ History cleared: {session_id}")
        except Exception as e:
            logger.error(f"❌ Firebase clear error: {e}")
