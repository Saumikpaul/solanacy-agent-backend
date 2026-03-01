import requests
import logging
from config import settings

logger = logging.getLogger(__name__)

def get_news(topic: str = "technology", count: int = 5) -> str:
    """Get latest news using Serper News API"""
    try:
        headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {"q": topic, "num": count, "type": "news"}
        response = requests.post(
            "https://google.serper.dev/news",
            headers=headers,
            json=payload,
            timeout=10
        )
        data = response.json()
        
        results = [f"📰 Latest News: {topic}\n"]
        for item in data.get("news", [])[:count]:
            results.append(
                f"• {item.get('title')}\n"
                f"  Source: {item.get('source')} | {item.get('date')}\n"
                f"  {item.get('snippet')}\n"
            )
        
        return "\n".join(results) if len(results) > 1 else f"No news found for: {topic}"
    except Exception as e:
        logger.error(f"News error: {e}")
        return f"News fetch failed: {str(e)}"
