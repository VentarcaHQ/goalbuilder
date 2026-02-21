"""
Application configuration — loaded from environment variables.
Copy .env.example to .env and fill in values before running.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # PostgreSQL
    DATABASE_URL: str = "postgresql://goalbuilder:goalbuilder@localhost:5432/goalbuilder"

    # Stripe — required for the $3 paywall
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""           # Create a $3 one-time product in Stripe dashboard

    # Buy Me a Coffee — your BMC page URL
    BMAC_URL: str = "https://buymeacoffee.com/goalbuilder"

    # Admin endpoint protection
    ADMIN_API_KEY: str = "change-me-in-production"

    # Mailchimp — optional, leave blank to store subscribers in DB only
    MAILCHIMP_API_KEY: Optional[str] = None
    MAILCHIMP_LIST_ID: Optional[str] = None
    MAILCHIMP_SERVER_PREFIX: Optional[str] = None  # e.g. "us21"

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()

# ─── Hardcoded benchmark data ──────────────────────────────────────────────────
# Source: 10-year historical averages (2014–2024).
# v2 will replace this with live API calls.
BENCHMARK_DATA = {
    "US": {
        "equities": {"annual_mean": 0.108, "annual_std": 0.158},
        "bonds":    {"annual_mean": 0.024, "annual_std": 0.058},
        "inflation": 0.025,
        "currency": "USD",
    },
    "UK": {
        "equities": {"annual_mean": 0.067, "annual_std": 0.142},
        "bonds":    {"annual_mean": 0.017, "annual_std": 0.068},
        "inflation": 0.025,
        "currency": "GBP",
    },
    "EU": {
        "equities": {"annual_mean": 0.078, "annual_std": 0.161},
        "bonds":    {"annual_mean": 0.005, "annual_std": 0.051},
        "inflation": 0.020,
        "currency": "EUR",
    },
    "NG": {
        "equities": {"annual_mean": 0.142, "annual_std": 0.248},
        "bonds":    {"annual_mean": 0.135, "annual_std": 0.048},
        "inflation": 0.220,
        "currency": "NGN",
    },
}

ALLOCATION_PROFILES = {
    "conservative": {"bonds": 0.80, "equities": 0.20},
    "balanced":     {"bonds": 0.60, "equities": 0.40},
    "growth":       {"bonds": 0.30, "equities": 0.70},
    "aggressive":   {"bonds": 0.10, "equities": 0.90},
}

CURRENCY_SYMBOLS = {"USD": "$", "GBP": "£", "EUR": "€", "NGN": "₦"}
