"""API keys identify the application; user access tokens remain separate JWTs."""

import base64
import json


def key_role(key: str) -> str | None:
    """Inspect format only. This does not verify a key or its signature."""
    if any(char.isspace() for char in key):
        return None
    if key.startswith("sb_publishable_") and len(key) > len("sb_publishable_"):
        return "anon"
    if key.startswith("sb_secret_") and len(key) > len("sb_secret_"):
        return "service_role"
    try:
        parts = key.split(".")
        if len(parts) != 3:
            return None
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        role = payload.get("role") if isinstance(payload, dict) else None
        return role if role in ("anon", "service_role") else None
    except (ValueError, UnicodeError):
        return None


def api_headers(key: str) -> dict[str, str]:
    # Publishable/secret keys are not JWTs. Never put them in a Bearer header.
    headers = {"apikey": key}
    if not key.startswith(("sb_secret_", "sb_publishable_")):
        headers["Authorization"] = f"Bearer {key}"
    return headers
