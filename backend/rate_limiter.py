"""
IP-based rate limiter.

Rules:
  - 2 free reports per IP per day (keyed by SHA-256 hash of the IP)
  - Beyond that, the user must pay $3 via Stripe
  - Paid reports are tracked separately so we know how much was earned

We never store raw IP addresses — only their SHA-256 hash.
"""
import hashlib
from fastapi import Request
from database import get_today_usage

FREE_LIMIT = 2


def hash_ip(ip: str) -> str:
    """SHA-256 hash of the IP address. Not reversible."""
    return hashlib.sha256(ip.encode()).hexdigest()


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP from the request.
    Checks X-Forwarded-For (set by nginx / Cloudflare) before falling back
    to the direct connection IP.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain a comma-separated list; first is the client
        return forwarded.split(",")[0].strip()
    return request.client.host


def check_rate_limit(ip_hash: str) -> dict:
    """
    Returns a dict with:
      - allowed: bool — whether a free report is still available
      - free_used: int — free reports used today
      - free_limit: int — max free reports per day
      - requires_payment: bool
    """
    usage = get_today_usage(ip_hash)
    free_used = usage["free_count"]
    requires_payment = free_used >= FREE_LIMIT

    return {
        "allowed": not requires_payment,
        "free_used": free_used,
        "free_limit": FREE_LIMIT,
        "requires_payment": requires_payment,
    }
