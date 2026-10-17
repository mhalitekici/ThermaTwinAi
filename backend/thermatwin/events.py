"""Convert verified snapshots to events; no ML runtime or training imports."""

from pathlib import Path

from .config import REGION, ROOT


def event_candidates(snap: dict):
    if snap["mode"] == "live" and snap["stale"]:
        return
    common = {
        "region_id": REGION.id,
        "region_name": REGION.name,
        "mode": snap["mode"],
        "provider": snap["source"]["provider"],
        "dataset_id": snap["source"]["dataset_id"],
        "origin_date": snap["origin_date"],
        "data_date": snap["origin_date"],
        "episode_key": snap.get("early_warning", {}).get("alert_id"),
        "data_quality": {
            "valid": snap.get("status") == "ready",
            "stale": snap.get("stale", True),
            "complete_recent_days": sum(
                1 for row in snap.get("history", [])[-15:] if row.get("sst_c") is not None
            ),
        },
    }
    o = snap["observation"]
    if o["risk"] in ("watch", "high"):
        yield (
            "observed",
            {
                **common,
                "kind": "observed",
                "event_date": snap["origin_date"],
                **o,
                "horizon_hours": 0,
                "reason": "Gerçek gözlem mevsimsel P90 eşiğini aşıyor.",
                "uncertainty": "Uydu gözlem hatası tahmin aralığıyla ölçülmez.",
            },
        )
    predicted = next(
        (
            f
            for f in snap["forecasts"]
            if f.get("warning", {}).get("triggered", f["risk"] in ("watch", "high"))
        ),
        None,
    )
    if predicted:
        yield (
            "predicted",
            {
                **common,
                **predicted,
                "kind": "predicted",
                "event_date": predicted["target_date"],
                "horizon_hours": predicted["horizon_days"] * 24,
                "reason": predicted.get("warning", {}).get("reason", "Nokta tahmini P90 eşiğini aşıyor."),
                "uncertainty": {
                    "lower_c": predicted["lower_c"],
                    "upper_c": predicted["upper_c"],
                    "nominal_coverage": 0.8,
                },
            },
        )


def replay_path() -> Path:
    return ROOT / "public/replay.json"
