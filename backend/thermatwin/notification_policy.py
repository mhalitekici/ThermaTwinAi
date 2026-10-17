"""Fail-closed dispatch rules. Auth OTP is handled separately by Supabase SMTP."""

import math
import os
from datetime import UTC, date, datetime

CONSENT_VERSION = "observed-info-v1"


def notification_config() -> dict:
    mode = os.getenv("NOTIFICATION_MODE", "shadow").strip().lower()
    if mode not in ("shadow", "test", "live"):
        raise ValueError("NOTIFICATION_MODE shadow, test veya live olmalı.")
    return {
        "mode": mode,
        "automatic_approved": os.getenv("AUTOMATIC_EMAILS_APPROVED") == "true",
        "forecast_enabled": os.getenv("ENABLE_FORECAST_EMAILS") == "true",
        "test_enabled": os.getenv("TEST_EMAIL_ENABLED") == "true",
    }


def data_gate(alert: dict, today: date | None = None) -> str | None:
    facts = alert.get("report", {}).get("facts", {})
    quality = facts.get("data_quality", {})
    if facts.get("provider") != "Copernicus Marine" or quality.get("complete_recent_days", 0) < 15:
        return "unverified_or_incomplete_data"
    if not quality.get("valid") or quality.get("stale"):
        return "invalid_or_stale_data"
    try:
        origin = date.fromisoformat(facts["origin_date"])
        values = [float(facts[k]) for k in ("sst_c", "reference_c", "p90_c")]
        if not all(math.isfinite(v) and -2 <= v <= 40 for v in values):
            return "invalid_temperature"
        if alert.get("kind") == "observed" and (
            values[0] <= values[2] or facts.get("event_date") != str(origin)
        ):
            return "no_observed_exceedance"
        if alert.get("mode") == "live":
            age = ((today or datetime.now(UTC).date()) - origin).days
            if age < 0 or age > 3:
                return "stale_or_future_observation"
        elif alert.get("mode") != "replay":
            return "invalid_mode"
    except (KeyError, ValueError, TypeError):
        return "invalid_facts"
    return None


def dispatch_mode(alert: dict, *, manual_test=False, only_user=None) -> tuple[str | None, str]:
    config = notification_config()
    if alert.get("kind") == "predicted" and not config["forecast_enabled"]:
        return None, "forecast_email_disabled"
    if manual_test:
        if not only_user or not config["test_enabled"]:
            return None, "manual_test_not_enabled"
        return "test", "authenticated_self_test"
    if alert.get("mode") == "replay":
        return None, "replay_requires_manual_test"
    if config["mode"] != "live" or not config["automatic_approved"]:
        return "shadow", "automatic_delivery_not_approved"
    return "live", "approved_observed_information"
