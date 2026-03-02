import asyncio
import logging
import json
import base64
import os
import websockets
from fastapi import WebSocket
from config import settings
from memory import MemoryManager

logger = logging.getLogger(__name__)

GEMINI_LIVE_URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={settings.GEMINI_API_KEY}"

VOICE_SYSTEM_PROMPT = """You are Solanacy Agentic AI — a powerful autonomous voice assistant.
Be concise, natural, and helpful. Complete tasks autonomously.
Speak clearly and naturally. Never say you can't do something."""

class VoiceHandler:
    def __init__(self):
        self.threshold = settings.VOICE_THRESHOLD
        logger.info(f"✅ VoiceHandler initialized | threshold={self.threshold}")

    async def handle_session(self, websocket: WebSocket, session_id: str, memory: MemoryManager):
        """Main voice session handler with Gemini Live API"""
        
        gemini_ws = None
        
        try:
            # Connect to Gemini Live API
            gemini_ws = await websockets.connect(
                GEMINI_LIVE_URL,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=10,
                max_size=10 * 1024 * 1024  # 10MB
            )
            
            # Send setup config
            setup_msg = {
                "setup": {
                    "model": settings.VOICE_MODEL,
                    "generation_config": {
                        "response_modalities": ["AUDIO"],
                        "speech_config": {
                            "voice_config": {
                                "prebuilt_voice_config": {
                                    "voice_name": "Aoede"
                                }
                            }
                        }
                    },
                    "system_instruction": {
                        "parts": [{"text": VOICE_SYSTEM_PROMPT}]
                    },
                    "realtime_input_config": {
                        "automatic_activity_detection": {
                            "disabled": False,
                            "start_of_speech_sensitivity": "START_SENSITIVITY_LOW",
                            "end_of_speech_sensitivity": "END_SENSITIVITY_LOW",
                            "prefix_padding_ms": 200,
                            "silence_duration_ms": 800
                        }
                    }
                }
            }
            
            await gemini_ws.send(json.dumps(setup_msg))
            
            # Wait for setup response
            setup_response = await gemini_ws.recv()
            logger.info(f"🎙️ Gemini Live connected for session: {session_id}")
            
            await websocket.send_json({"type": "ready", "message": "Voice session ready"})
            
            # Run bidirectional streaming
            await asyncio.gather(
                self._client_to_gemini(websocket, gemini_ws, session_id),
                self._gemini_to_client(gemini_ws, websocket, session_id, memory),
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"❌ Voice session error: {e}")
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except:
                pass
        finally:
            if gemini_ws:
                try:
                    await gemini_ws.close()
                except:
                    pass

    async def _client_to_gemini(self, client_ws: WebSocket, gemini_ws, session_id: str):
        """Stream audio from client to Gemini"""
        try:
            while True:
                data = await client_ws.receive()
                
                if "bytes" in data:
                    # Raw audio bytes — stream to Gemini
                    audio_b64 = base64.b64encode(data["bytes"]).decode()
                    msg = {
                        "realtime_input": {
                            "media_chunks": [{
                                "data": audio_b64,
                                "mime_type": "audio/pcm;rate=16000"
                            }]
                        }
                    }
                    await gemini_ws.send(json.dumps(msg))
                    
                elif "text" in data:
                    try:
                        parsed = json.loads(data["text"])
                        msg_type = parsed.get("type")
                        
                        if msg_type == "text":
                            # Text message — send as text input
                            text_msg = {
                                "client_content": {
                                    "turns": [{"role": "user", "parts": [{"text": parsed.get("message", "")}]}],
                                    "turn_complete": True
                                }
                            }
                            await gemini_ws.send(json.dumps(text_msg))
                            
                        elif msg_type == "end_turn":
                            end_msg = {
                                "client_content": {
                                    "turns": [],
                                    "turn_complete": True
                                }
                            }
                            await gemini_ws.send(json.dumps(end_msg))
                            
                        elif msg_type == "interrupt":
                            # Client wants to interrupt
                            interrupt_msg = {"client_content": {"interruption": True}}
                            await gemini_ws.send(json.dumps(interrupt_msg))
                            
                    except json.JSONDecodeError:
                        pass
                        
        except Exception as e:
            logger.debug(f"Client→Gemini stream ended: {e}")

    async def _gemini_to_client(self, gemini_ws, client_ws: WebSocket, session_id: str, memory: MemoryManager):
        """Stream responses from Gemini to client"""
        transcript_buffer = ""
        
        try:
            async for raw_msg in gemini_ws:
                try:
                    msg = json.loads(raw_msg)
                    
                    # Handle server content
                    server_content = msg.get("serverContent", {})
                    
                    if server_content:
                        model_turn = server_content.get("modelTurn", {})
                        parts = model_turn.get("parts", [])
                        
                        for part in parts:
                            # Audio response
                            if "inlineData" in part:
                                audio_data = part["inlineData"].get("data", "")
                                audio_bytes = base64.b64decode(audio_data)
                                await client_ws.send_bytes(audio_bytes)
                            
                            # Text transcript
                            if "text" in part:
                                transcript_buffer += part["text"]
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "text": part["text"]
                                })
                        
                        # Turn complete
                        if server_content.get("turnComplete"):
                            await client_ws.send_json({"type": "turn_complete"})
                            
                            # Save to memory
                            if transcript_buffer.strip():
                                await memory.save_interaction(
                                    session_id, "model", 
                                    transcript_buffer.strip()
                                )
                                transcript_buffer = ""
                    
                    # Input transcription (what user said)
                    input_transcript = msg.get("inputTranscription", {})
                    if input_transcript.get("text"):
                        await client_ws.send_json({
                            "type": "input_transcript",
                            "text": input_transcript["text"]
                        })
                        await memory.save_interaction(
                            session_id, "user",
                            input_transcript["text"]
                        )
                    
                    # Activity signals
                    if msg.get("realtimeInputConfig"):
                        pass
                        
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    logger.error(f"❌ Gemini→Client error: {e}")
                    
        except Exception as e:
            logger.debug(f"Gemini→Client stream ended: {e}")
