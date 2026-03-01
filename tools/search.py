import requests
import logging
from config import settings

logger = logging.getLogger(__name__)

def search_web(query: str, count: int = 5) -> str:
    """Search the web using Serper API"""
    try:
        headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {"q": query, "num": count}
        response = requests.post(
            "https://google.serper.dev/search",
            headers=headers,
            json=payload,
            timeout=10
        )
        data = response.json()
        
        results = []
        
        # Answer box
        if data.get("answerBox"):
            ab = data["answerBox"]
            results.append(f"ANSWER: {ab.get('answer') or ab.get('snippet', '')}")
        
        # Organic results
        for r in data.get("organic", [])[:count]:
            results.append(f"• {r.get('title')}: {r.get('snippet')} ({r.get('link')})")
        
        return "\n".join(results) if results else "No results found"
    except Exception as e:
        logger.error(f"Search error: {e}")
        return f"Search failed: {str(e)}"
