import asyncio
import logging
import json
import base64
from fastapi import WebSocket
from google import genai
from google.genai import types
from config import settings
from memory import MemoryManager

logger = logging.getLogger(__name__)

VOICE_MODEL = settings.VOICE_MODEL

LIVE_CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    # system_instruction must be types.Content, NOT a plain string
    system_instruction=types.Content(
        parts=[types.Part(text=(
            "You are Solanacy Agentic AI — a powerful autonomous voice assistant. "
            "Be concise, natural, and helpful. Complete tasks autonomously. "
            "Keep responses short and conversational."
        ))],
        role="user",
    ),
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
        )
    ),
)


def _make_client() -> genai.Client:
    return genai.Client(api_key=settings.GEMINI_API_KEY)


class VoiceHandler:
    def __init__(self):
        logger.info(f"✅ VoiceHandler initialized | model={VOICE_MODEL}")

    async def handle_session(self, websocket: WebSocket, session_id: str, memory: MemoryManager):
        logger.info(f"🎙️ Voice session starting: {session_id}")
        client = _make_client()

        try:
            async with client.aio.live.connect(model=VOICE_MODEL, config=LIVE_CONFIG) as live_session:
                logger.info(f"✅ Gemini Live connected: {session_id}")
                await websocket.send_json({"type": "ready"})

                results = await asyncio.gather(
                    self._client_to_gemini(websocket, live_session),
                    self._gemini_to_client(live_session, websocket, session_id, memory),
                    return_exceptions=True,
                )
                for r in results:
                    if isinstance(r, Exception):
                        logger.warning(f"Voice gather exception: {r}")

        except Exception as e:
            logger.error(f"❌ Gemini Live connect failed: {e}")
            try:
                await websocket.send_json({"type": "error", "message": f"Voice connection failed: {str(e)}"})
            except Exception:
                pass

    async def _client_to_gemini(self, websocket: WebSocket, live_session):
        try:
            while True:
                data = await websocket.receive()

                if "bytes" in data:
                    await live_session.send_realtime_input(
                        audio=types.Blob(data=data["bytes"], mime_type="audio/pcm;rate=16000")
                    )
                elif "text" in data:
                    try:
                        msg = json.loads(data["text"])
                        chunks = msg.get("realtime_input", {}).get("media_chunks", [])
                        for chunk in chunks:
                            raw = base64.b64decode(chunk["data"])
                            await live_session.send_realtime_input(
                                audio=types.Blob(
                                    data=raw,
                                    mime_type=chunk.get("mime_type", "audio/pcm;rate=16000"),
                                )
                            )
                    except Exception as e:
                        logger.debug(f"Client→Gemini parse error: {e}")
        except Exception as e:
            logger.debug(f"Client→Gemini loop ended: {e}")

    async def _gemini_to_client(self, live_session, websocket: WebSocket, session_id: str, memory: MemoryManager):
        transcript_buffer = ""
        try:
            async for response in live_session.receive():
                sc = response.server_content
                if not sc:
                    continue

                if sc.model_turn:
                    audio_parts = []
                    for part in sc.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            b64 = base64.b64encode(part.inline_data.data).decode()
                            audio_parts.append({
                                "inlineData": {
                                    "data": b64,
                                    "mimeType": part.inline_data.mime_type or "audio/pcm",
                                }
                            })
                        if hasattr(part, "text") and part.text:
                            transcript_buffer += part.text
                            await websocket.send_json({"type": "transcript", "text": part.text})

                    if audio_parts:
                        await websocket.send_json({
                            "serverContent": {"modelTurn": {"parts": audio_parts}}
                        })

                if sc.turn_complete:
                    await websocket.send_json({"type": "turn_complete"})
                    if transcript_buffer.strip():
                        await memory.save_interaction(session_id, "model", transcript_buffer.strip())
                        transcript_buffer = ""

        except Exception as e:
            logger.debug(f"Gemini→Client loop ended: {e}")
