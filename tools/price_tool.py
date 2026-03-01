import requests
import logging
from config import settings

logger = logging.getLogger(__name__)

def find_deals(product: str) -> str:
    """Find best prices and deals for a product"""
    try:
        headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {"q": f"{product} best price buy online", "num": 5}
        response = requests.post(
            "https://google.serper.dev/shopping",
            headers=headers,
            json=payload,
            timeout=10
        )
        data = response.json()
        
        results = [f"🛒 Best deals for: {product}\n"]
        
        shopping = data.get("shopping", [])
        if shopping:
            for item in shopping[:5]:
                results.append(
                    f"• {item.get('title')}\n"
                    f"  Price: {item.get('price')} | {item.get('source')}\n"
                    f"  {item.get('link', '')}\n"
                )
        else:
            # Fallback to organic search
            payload2 = {"q": f"buy {product} price comparison", "num": 5}
            r2 = requests.post("https://google.serper.dev/search", headers=headers, json=payload2, timeout=10)
            d2 = r2.json()
            for item in d2.get("organic", [])[:5]:
                results.append(f"• {item.get('title')}: {item.get('snippet')}")
        
        return "\n".join(results)
    except Exception as e:
        return f"Price search error: {str(e)}"
