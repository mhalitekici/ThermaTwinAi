"""Consent-aware outbox. No provider call occurs in the default shadow mode."""

import os

import httpx

from .config import required
from .email_templates import render_email
from .notification_policy import CONSENT_VERSION, data_gate, dispatch_mode
from .store import Store


def deliver(store: Store, alert: dict, only_user: str | None = None, *, manual_test=False) -> dict:
    counts = {"sent": 0, "failed": 0, "skipped": 0, "shadow": 0}
    mode, reason = dispatch_mode(alert, manual_test=manual_test, only_user=only_user)
    if alert["mode"] == "replay" and only_user is None:
        raise ValueError("Replay için tek doğrulanmış test hesabı gereklidir.")
    invalid = data_gate(alert)
    if mode is None or invalid:
        return {**counts, "skipped": 1, "reason": invalid or reason}
    sender = (
        required("EMAIL_FROM") if mode != "shadow" else os.getenv("EMAIL_FROM", "shadow@thermatwin.invalid")
    )
    for subscription in store.subscribers(alert["region_id"]):
        user_id = subscription["user_id"]
        if only_user is not None and user_id != only_user:
            continue
        if (
            not subscription.get("email_enabled")
            or subscription.get("consent_version") != CONSENT_VERSION
            or not subscription.get("consented_at")
        ):
            counts["skipped"] += 1
            continue
        user = store.user(user_id)
        email = user.get("email", "").strip().lower()
        if not user.get("email_confirmed_at") or not email:
            counts["skipped"] += 1
            continue
        payload = {"from": sender, "to": [email], **render_email(alert, test=mode == "test")}
        d = store.claim(alert["id"], user_id, payload, dispatch_mode=mode)
        if d is None:
            counts["skipped"] += 1
            continue
        if mode == "shadow":
            counts["shadow"] += 1
            continue
        if d["payload"].get("to") != [email]:
            store.finish(d, "skipped", error="Recipient changed; frozen request not sent")
            counts["skipped"] += 1
            continue
        try:
            with httpx.Client(timeout=20) as client:
                response = client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {required('RESEND_API_KEY')}",
                        "Idempotency-Key": f"thermatwin/{d['id']}",
                    },
                    json=d["payload"],
                )
                response.raise_for_status()
                provider_id = response.json()["id"]
        except (httpx.HTTPError, ValueError, KeyError):
            store.finish(
                d, "failed", error="Provider request failed; reconcile with Resend before manual resend"
            )
            counts["failed"] += 1
            continue
        store.finish(d, "sent", provider_id=provider_id)
        counts["sent"] += 1
    return counts


def retry_outbox(store: Store, excluded_alerts: set[str] | None = None) -> dict:
    rows = store.request(
        "GET",
        "/rest/v1/deliveries",
        params={
            "status": "in.(pending,failed,sending)",
            "dispatch_mode": "eq.live",
            "select": "alert_id,user_id,alerts!inner(*)",
            "alerts.mode": "eq.live",
            "limit": "200",
            "order": "created_at.asc",
        },
    )
    counts = {"sent": 0, "failed": 0, "skipped": 0, "shadow": 0}
    for row in rows:
        if excluded_alerts and row["alert_id"] in excluded_alerts:
            continue
        result = deliver(store, row["alerts"], row["user_id"])
        for key in counts:
            counts[key] += result[key]
    return counts
