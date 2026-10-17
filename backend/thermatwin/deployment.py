"""Deployment boundaries. Values never appear in validation errors."""

import os
from urllib.parse import urlsplit


def environment() -> str:
    if os.getenv("VERCEL_ENV") == "preview":
        return "preview"
    value = os.getenv("APP_ENV", "development").strip().lower()
    if value not in {"development", "test", "preview", "production"}:
        raise ValueError("APP_ENV development, test, preview veya production olmalı.")
    return value


def https_origin(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return bool(
            parsed.scheme == "https"
            and parsed.hostname
            and not parsed.username
            and not parsed.password
            and parsed.path in ("", "/")
            and not parsed.query
            and not parsed.fragment
            and "*" not in value
            and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
            and not parsed.hostname.endswith(".localhost")
        )
    except ValueError:
        return False


def cors_origins() -> list[str]:
    default = (
        "http://localhost:5173,http://127.0.0.1:5173" if environment() in {"development", "test"} else ""
    )
    return [
        item.strip().rstrip("/") for item in os.getenv("ALLOWED_ORIGINS", default).split(",") if item.strip()
    ]


def validate_runtime() -> None:
    target = environment()
    origins = cors_origins()
    if any("*" in origin or origin == "null" for origin in origins):
        raise ValueError("ALLOWED_ORIGINS yalnız açık uygulama origin'leri içermeli.")
    if target in {"production", "preview"} and any(not https_origin(origin) for origin in origins):
        raise ValueError("Hosted ALLOWED_ORIGINS tam HTTPS origin'leri olmalı.")
    if target == "production":
        required = (
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "RESEND_API_KEY",
            "EMAIL_FROM",
            "APP_URL",
            "ALLOWED_ORIGINS",
        )
        if any(not os.getenv(name, "").strip() for name in required):
            raise ValueError("Production backend yapılandırması eksik; deployment rehberini kontrol edin.")
        if not https_origin(os.environ["APP_URL"]) or not https_origin(os.environ["SUPABASE_URL"]):
            raise ValueError("Production APP_URL ve SUPABASE_URL HTTPS olmalı.")
        if os.environ["APP_URL"].rstrip("/") not in origins:
            raise ValueError("Production APP_URL, ALLOWED_ORIGINS içinde olmalı.")
