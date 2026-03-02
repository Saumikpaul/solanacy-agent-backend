import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from config import settings
from agent import SolanacyAgent
from voice import VoiceHandler
from memory import MemoryManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Solanacy Agentic AI starting up...")
    app.state.memory = MemoryManager()
    await app.state.memory.initialize()
    app.state.agent = SolanacyAgent(app.state.memory)
    app.state.voice = VoiceHandler()
    logger.info(
        f"✅ Solanacy Agentic AI ready! | storage={app.state.memory.storage_type}"
    )
    yield
    logger.info("🛑 Solanacy Agentic AI shutting down...")


app = FastAPI(
    title="Solanacy Agentic AI",
    description="Production-grade autonomous AI agent",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins in development. Restrict in production by setting
# ALLOWED_ORIGINS env var to a comma-separated list.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _origins_env.split(",")] if _origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class TaskRequest(BaseModel):
    task: str
    context: Optional[str] = None
    session_id: Optional[str] = "default"


class TaskResponse(BaseModel):
    success: bool
    result: str
    session_id: str
    task_id: Optional[str] = None
    storage: Optional[str] = None


# ── HTTP Endpoints ────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "online",
        "agent": "Solanacy Agentic AI",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    mem = app.state.memory
    firebase_ok = mem._initialized and mem.db is not None

    # Quick Firestore ping if Firebase is connected
    if firebase_ok:
        try:
            mem.db.collection("_health").document("ping").get()
            firebase_status = "connected"
        except Exception as e:
            firebase_status = f"error: {str(e)[:60]}"
    else:
        firebase_status = "unavailable (using in-memory fallback)"

    return {
        "status": "healthy",
        "services": {
            "firebase": firebase_status,
            "gemini": "ready",
            "storage": mem.storage_type,
        },
    }


@app.post("/task", response_model=TaskResponse)
async def run_task(request: TaskRequest):
    try:
        logger.info(f"📋 Task: {request.task[:100]}")
        result = await app.state.agent.run(
            task=request.task,
            context=request.context,
            session_id=request.session_id,
        )
        return TaskResponse(
            success=True,
            result=result["output"],
            session_id=request.session_id,
            task_id=result.get("task_id"),
            storage=app.state.memory.storage_type,
        )
    except Exception as e:
        logger.error(f"❌ Task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/{session_id}")
async def get_history(session_id: str, limit: int = 20):
    try:
        history = await app.state.memory.get_history(session_id, limit)
        return {"session_id": session_id, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/history/{session_id}")
async def clear_history(session_id: str):
    try:
        await app.state.memory.clear_history(session_id)
        return {"success": True, "message": "History cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── WebSocket Endpoints ───────────────────────────────────────────────────────

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    session_id = websocket.query_params.get("session_id", "default")
    logger.info(f"🎙️ Voice WS connected: {session_id}")

    try:
        await app.state.voice.handle_session(
            websocket=websocket,
            session_id=session_id,
            memory=app.state.memory,
        )
    except WebSocketDisconnect:
        logger.info(f"🔌 Voice WS disconnected: {session_id}")
    except Exception as e:
        logger.error(f"❌ Voice WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


@app.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()
    session_id = websocket.query_params.get("session_id", "default")
    logger.info(f"💬 Chat WS connected: {session_id}")

    try:
        while True:
            data = await websocket.receive_json()
            task = data.get("task", "").strip()
            if not task:
                continue

            await websocket.send_json({"type": "thinking", "message": "Processing..."})

            result = await app.state.agent.run(task=task, session_id=session_id)

            await websocket.send_json({
                "type": "response",
                "message": result["output"],
                "task_id": result.get("task_id"),
            })

    except WebSocketDisconnect:
        logger.info(f"🔌 Chat WS disconnected: {session_id}")
    except Exception as e:
        logger.error(f"❌ Chat WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=False,
    )
