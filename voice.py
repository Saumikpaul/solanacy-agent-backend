import asyncio
import logging
import json
from fastapi import WebSocket
from google import genai
from config import settings
from memory import MemoryManager

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL = settings.VOICE_MODEL
CONFIG = {
    "response_modalities": ["AUDIO"],
    "system_instruction": "You are Solanacy Agentic AI — a powerful autonomous voice assistant. Be concise, natural, and helpful. Complete tasks autonomously.",
    "speech_config": {
        "voice_config": {
            "prebuilt_voice_config": {
                "voice_name": "Aoede"
            }
        }
    }
}

audio_queue_output = asyncio.Queue()
audio_queue_mic = asyncio.Queue(maxsize=10)

class VoiceHandler:
    def __init__(self):
        logger.info(f"✅ VoiceHandler initialized | model={MODEL}")

    async def handle_session(self, websocket: WebSocket, session_id: str, memory: MemoryManager):
        logger.info(f"🎙️ Voice session: {session_id}")

        # Clear queues
        while not audio_queue_output.empty():
            audio_queue_output.get_nowait()
        while not audio_queue_mic.empty():
            audio_queue_mic.get_nowait()

        try:
            async with client.aio.live.connect(model=MODEL, config=CONFIG) as live_session:
                logger.info(f"✅ Gemini Live connected: {session_id}")
                await websocket.send_json({"type": "ready", "message": "Voice session ready"})

                await asyncio.gather(
                    self._receive_from_browser(websocket, live_session),
                    self._send_to_gemini(live_session),
                    self._receive_from_gemini(live_session, websocket, session_id, memory),
                    self._send_to_browser(websocket),
                    return_exceptions=True
                )

        except Exception as e:
            logger.error(f"❌ Voice error: {e}")
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except:
                pass

    async def _receive_from_browser(self, websocket: WebSocket, live_session):
        """Get audio from browser → put in mic queue"""
        try:
            while True:
                data = await websocket.receive()

                if "bytes" in data:
                    await audio_queue_mic.put({
                        "data": data["bytes"],
                        "mime_type": "audio/pcm;rate=16000"
                    })

                elif "text" in data:
                    try:
                        parsed = json.loads(data["text"])
                        if parsed.get("type") == "text":
                            await live_session.send_client_content(
                                turns=[{"role": "user", "parts": [{"text": parsed.get("message", "")}]}],
                                turn_complete=True
                            )
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            logger.debug(f"Browser→Queue ended: {e}")

    async def _send_to_gemini(self, live_session):
        """Send audio from mic queue → Gemini (like send_realtime in Google example)"""
        try:
            while True:
                msg = await audio_queue_mic.get()
                await live_session.send_realtime_input(audio=msg)
        except Exception as e:
            logger.debug(f"Queue→Gemini ended: {e}")

    async def _receive_from_gemini(self, live_session, websocket: WebSocket, session_id: str, memory: MemoryManager):
        """Receive from Gemini → put audio in output queue (like receive_audio in Google example)"""
        transcript_buffer = ""
        try:
            while True:
                turn = live_session.receive()
                async for response in turn:
                    if response.server_content and response.server_content.model_turn:
                        for part in response.server_content.model_turn.parts:
                            # Audio
                            if part.inline_data and isinstance(part.inline_data.data, bytes):
                                audio_queue_output.put_nowait(part.inline_data.data)
                            # Text transcript
                            if hasattr(part, 'text') and part.text:
                                transcript_buffer += part.text
                                await websocket.send_json({"type": "transcript", "text": part.text})

                    if response.server_content and response.server_content.turn_complete:
                        await websocket.send_json({"type": "turn_complete"})
                        if transcript_buffer.strip():
                            await memory.save_interaction(session_id, "model", transcript_buffer.strip())
                            transcript_buffer = ""

                # Clear on interruption
                while not audio_queue_output.empty():
                    audio_queue_output.get_nowait()

        except Exception as e:
            logger.debug(f"Gemini→Queue ended: {e}")

    async def _send_to_browser(self, websocket: WebSocket):
        """Send audio from output queue → browser (like play_audio in Google example)"""
        try:
            while True:
                audio_bytes = await audio_queue_output.get()
                await websocket.send_bytes(audio_bytes)
        except Exception as e:
            logger.debug(f"Queue→Browser ended: {e}")
