# social_tool.py
import logging
logger = logging.getLogger(__name__)

def post_social(platform: str, content: str, media_url: str = "") -> str:
    """Post to social media"""
    return f"Social posting to {platform}: Configure API credentials in environment variables (TWITTER_API_KEY, etc.) to enable auto-posting."
