import logging

logger = logging.getLogger(__name__)

def send_email(to: str, subject: str, body: str) -> str:
    """Send email (configure SMTP credentials in .env)"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        import os
        
        smtp_user = os.getenv("EMAIL_USER", "")
        smtp_pass = os.getenv("EMAIL_PASS", "")
        smtp_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("EMAIL_PORT", 587))
        
        if not smtp_user or not smtp_pass:
            return "Email not configured. Add EMAIL_USER and EMAIL_PASS to environment variables."
        
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        
        return f"✅ Email sent to {to}: {subject}"
    except Exception as e:
        return f"Email error: {str(e)}"

def read_emails(count: int = 5) -> str:
    """Read recent emails"""
    return "Email reading requires IMAP configuration. Add EMAIL_USER, EMAIL_PASS to environment."
