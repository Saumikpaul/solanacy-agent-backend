import asyncio
import logging
import json
import base64
from fastapi import WebSocket
from google import genai
from config import settings
from memory import MemoryManager

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL = settings.VOICE_MODEL
CONFIG = {
    "response_modalities": ["AUDIO"],
    "system_instruction": "You are Solanacy Agentic AI — a powerful autonomous voice assistant. Be concise, natural, and helpful. Complete tasks autonomously. Never say you can't do something.",
    "speech_config": {
        "voice_config": {
            "prebuilt_voice_config": {
                "voice_name": "Aoede"
            }
        }
    }
}

class VoiceHandler:
    def __init__(self):
        logger.info(f"✅ VoiceHandler initialized | model={MODEL}")

    async def handle_session(self, websocket: WebSocket, session_id: str, memory: MemoryManager):
        logger.info(f"🎙️ Voice session: {session_id}")
        try:
            async with client.aio.live.connect(model=MODEL, config=CONFIG) as live_session:
                logger.info(f"✅ Gemini Live connected: {session_id}")
                await websocket.send_json({"type": "ready"})

                await asyncio.gather(
                    self._client_to_gemini(websocket, live_session),
                    self._gemini_to_client(live_session, websocket, session_id, memory),
                    return_exceptions=True
                )
        except Exception as e:
            logger.error(f"❌ Voice error: {e}")
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except:
                pass

    async def _client_to_gemini(self, websocket: WebSocket, live_session):
        """Receive base64 JSON from frontend → send to Gemini"""
        try:
            while True:
                data = await websocket.receive()
                if "text" in data:
                    try:
                        msg = json.loads(data["text"])
                        # Frontend sends: { realtime_input: { media_chunks: [{ mime_type, data }] } }
                        if "realtime_input" in msg:
                            chunks = msg["realtime_input"].get("media_chunks", [])
                            for chunk in chunks:
                                audio_bytes = base64.b64decode(chunk["data"])
                                await live_session.send_realtime_input(
                                    audio={"data": audio_bytes, "mime_type": "audio/pcm;rate=16000"}
                                )
                    except Exception as e:
                        logger.debug(f"Parse error: {e}")
                elif "bytes" in data:
                    # Also support raw bytes as fallback
                    await live_session.send_realtime_input(
                        audio={"data": data["bytes"], "mime_type": "audio/pcm;rate=16000"}
                    )
        except Exception as e:
            logger.debug(f"Client→Gemini ended: {e}")

    async def _gemini_to_client(self, live_session, websocket: WebSocket, session_id: str, memory: MemoryManager):
        """Receive from Gemini → forward as base64 JSON to frontend"""
        transcript_buffer = ""
        try:
            while True:
                turn = live_session.receive()
                async for response in turn:
                    sc = response.server_content
                    if not sc:
                        continue

                    if sc.model_turn:
                        parts = []
                        for part in sc.model_turn.parts:
                            if part.inline_data and isinstance(part.inline_data.data, bytes):
                                # Encode audio as base64 — same format as working example
                                b64 = base64.b64encode(part.inline_data.data).decode()
                                parts.append({
                                    "inlineData": {
                                        "data": b64,
                                        "mimeType": part.inline_data.mime_type or "audio/pcm"
                                    }
                                })
                            if hasattr(part, 'text') and part.text:
                                transcript_buffer += part.text
                                await websocket.send_json({"type": "transcript", "text": part.text})

                        if parts:
                            # Send in same format as Gemini raw JSON
                            await websocket.send_json({
                                "serverContent": {
                                    "modelTurn": {"parts": parts}
                                }
                            })

                    if sc.turn_complete:
                        await websocket.send_json({"type": "turn_complete"})
                        if transcript_buffer.strip():
                            await memory.save_interaction(session_id, "model", transcript_buffer.strip())
                            transcript_buffer = ""

        except Exception as e:
            logger.debug(f"Gemini→Client ended: {e}")
