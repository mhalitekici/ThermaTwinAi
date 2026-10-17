"""One idempotent monitoring pass; existing models are never retrained here."""

import json
from datetime import UTC, datetime

from .mail import deliver, retry_outbox
from .notification_policy import notification_config
from .pipeline import publish, snapshot


def run_once(store, frame, source, bundle, *, run_key: str, trigger="manual"):
    config = notification_config()

    def record(status, detail, observed=None):
        store.upsert(
            "monitor_runs",
            [
                {
                    "run_key": run_key,
                    "status": status,
                    "detail": json.dumps(detail),
                    "dispatch_mode": config["mode"],
                    "observation_date": observed,
                    "finished_at": datetime.now(UTC).isoformat() if status != "running" else None,
                }
            ],
            "run_key",
        )

    record("running", {"trigger": trigger})
    try:
        if (
            source["provider"] != "Copernicus Marine"
            or source["dataset_id"] != bundle["source"]["dataset_id"]
            or source.get("dataset_version") != bundle["source"].get("dataset_version")
        ):
            raise ValueError("Monitoring model/veri kaynağı uyumsuz.")
        bundle = {**bundle, "source": source}
        snap = snapshot(frame, bundle, "live", allow_llm=False)
        alerts = publish(store, frame, snap)
        results = [deliver(store, alert) for alert in alerts]
        # Retrying is gated again at send time for freshness, consent and approval.
        if config["mode"] == "live" and config["automatic_approved"]:
            results.append(retry_outbox(store, {a["id"] for a in alerts}))
        totals = {k: sum(result[k] for result in results) for k in ("sent", "failed", "shadow", "skipped")}
        status = (
            "stale"
            if snap["stale"]
            else "mail_failed"
            if totals["failed"]
            else "shadow"
            if not config["automatic_approved"] or config["mode"] != "live"
            else "ok"
        )
        record(
            status,
            {
                "trigger": trigger,
                "counts": totals,
                "reasons": [r["reason"] for r in results if r.get("reason")],
            },
            snap["origin_date"],
        )
        return snap, totals
    except Exception as exc:
        record("failed", {"trigger": trigger, "error_class": type(exc).__name__})
        raise
