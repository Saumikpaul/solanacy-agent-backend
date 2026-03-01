import os
import json
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    GEMINI_TEXT_MODEL: str = "gemini-2.5-flash"
    
    # Groq (backup)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # OpenRouter (backup)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    
    # Search
    SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "")
    
    # HuggingFace
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    
    # Firebase
    FIREBASE_CREDENTIALS: str = os.getenv("FIREBASE_CREDENTIALS", "{}")
    FIREBASE_PROJECT_ID: str = "solanacy-d01a9"
    
    # Voice settings
    VOICE_THRESHOLD: float = 0.15
    VOICE_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    
    # App
    APP_NAME: str = "Solanacy Agentic AI"
    DEBUG: bool = False
    
    def get_firebase_credentials(self) -> dict:
        try:
            return json.loads(self.FIREBASE_CREDENTIALS)
        except:
            return {}
    
    class Config:
        env_file = ".env"

settings = Settings()
