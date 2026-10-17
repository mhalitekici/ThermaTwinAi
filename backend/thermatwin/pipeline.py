from dataclasses import asdict
from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .config import REGION, ROOT
from .model import forecast
from .reports import generate_report
from .science import annotate, risk
from .store import Store


def snapshot(frame: pd.DataFrame, bundle: dict, mode: str, origin: str | None = None, *, allow_llm=True) -> dict:
    if bundle["source"]["region_id"] != REGION.id:
        raise ValueError("Model bölgesi uyumsuz.")
    origin_day = pd.Timestamp(origin) if origin else frame.sst_c.last_valid_index()
    annotated = annotate(frame.loc[:origin_day], bundle["climate"])
    latest = annotated.loc[origin_day]
    if pd.isna(latest.sst_c):
        raise ValueError("Seçilen tarihte geçerli gözlem yok.")
    forecasts = forecast(frame, bundle, origin_day)
    for f in forecasts:
        f["risk"] = risk(f["sst_c"], f["reference_c"], f["p90_c"])
    history = []
    for day, row in annotated.tail(365).iterrows():
        history.append(
            {
                "date": day.date().isoformat(),
                **{
                    c: round(float(row[c]), 3) if np.isfinite(row[c]) else None
                    for c in ("sst_c", "reference_c", "p90_c", "anomaly_c")
                },
                "duration_days": int(row.duration_days),
                "mhw": bool(row.mhw),
            }
        )
    checked = datetime.now(timezone.utc)
    age = max(0, (checked.date() - origin_day.date()).days)
    result = {
        "status": "ready",
        "mode": mode,
        "region": asdict(REGION),
        "source": bundle["source"],
        "checked_at": checked.isoformat(),
        "origin_date": origin_day.date().isoformat(),
        "age_days": age,
        "stale": mode == "live" and age > 3,
        "observation": {
            "sst_c": float(latest.sst_c),
            "reference_c": float(latest.reference_c),
            "p90_c": float(latest.p90_c),
            "anomaly_c": float(latest.anomaly_c),
            "risk": latest.risk,
            "duration_days": int(latest.duration_days),
            "mhw": bool(latest.mhw),
        },
        "forecasts": forecasts,
        "history": history,
        "evaluation": bundle["evaluation"],
        "reports": [],
    }
    from .warning import apply_reliability

    result = apply_reliability(result, frame, bundle)
    for kind, event in event_candidates(result):
        result["reports"].append(generate_report(event, allow_llm=allow_llm))
    return result


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
            "valid": snap.get("status") == "ready", "stale": snap.get("stale", True),
            "complete_recent_days": sum(1 for row in snap.get("history", [])[-15:] if row.get("sst_c") is not None),
        },
    }
    o = snap["observation"]
    if o["risk"] in ("watch", "high"):
        yield "observed", {**common, "kind": "observed", "event_date": snap["origin_date"], **o,
                           "horizon_hours": 0, "reason": "Gerçek gözlem mevsimsel P90 eşiğini aşıyor.",
                           "uncertainty": "Uydu gözlem hatası tahmin aralığıyla ölçülmez."}
    predicted = next((f for f in snap["forecasts"] if
                      f.get("warning", {}).get("triggered", f["risk"] in ("watch", "high"))), None)
    if predicted:
        yield (
            "predicted",
            {**common, **predicted, "kind": "predicted", "event_date": predicted["target_date"],
             "horizon_hours": predicted["horizon_days"] * 24,
             "reason": predicted.get("warning", {}).get("reason", "Nokta tahmini P90 eşiğini aşıyor."),
             "uncertainty": {"lower_c": predicted["lower_c"], "upper_c": predicted["upper_c"], "nominal_coverage": .8}},
        )


def select_replay(frame: pd.DataFrame, bundle: dict) -> str:
    a = annotate(frame, bundle["climate"])
    start = pd.Timestamp(bundle["calibration_end"]) + pd.Timedelta(days=30)
    candidates = a.loc[(a.index > start) & a.mhw].sort_values("anomaly_c", ascending=False)
    for day in candidates.index:
        try:
            forecast(frame, bundle, day)
            return day.date().isoformat()
        except ValueError:
            continue
    raise ValueError("Test döneminde doğrulanmış ≥5 günlük sıcak olay bulunamadı; demo uydurulmadı.")


def write_snapshot(snap: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(snap, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(path)


def publish(store: Store, frame: pd.DataFrame, snap: dict) -> list[dict]:
    source = snap["source"]
    if snap["mode"] == "live" and source["provider"] != "Copernicus Marine":
        raise ValueError("Canlı izleme yalnız Copernicus ile etkinleştirilebilir.")
    if snap["mode"] == "live":
        store.upsert(
            "observations",
            [
                {
                    "region_id": REGION.id,
                    "observed_on": d.date().isoformat(),
                    "sst_c": float(r.sst_c),
                    "dataset_id": source["dataset_id"],
                    "retrieved_at": source["retrieved_at"],
                }
                for d, r in frame.dropna(subset=["sst_c"]).iterrows()
            ],
            "region_id,observed_on,dataset_id",
        )
        store.upsert(
            "forecasts",
            [
                {
                    "region_id": REGION.id,
                    "dataset_id": source["dataset_id"],
                    **{
                        k: f[k]
                        for k in (
                            "origin_date",
                            "horizon_days",
                            "target_date",
                            "sst_c",
                            "lower_c",
                            "upper_c",
                            "method",
                        )
                    },
                }
                for f in snap["forecasts"]
            ],
            "region_id,origin_date,horizon_days,dataset_id",
        )
    store.upsert(
        "snapshots",
        [{"region_id": REGION.id, "mode": snap["mode"], "payload": snap, "updated_at": snap["checked_at"]}],
        "region_id,mode",
    )
    alerts = []
    for _, event in event_candidates(snap):
        event["report"] = generate_report(event)
        alerts.append(store.register(event))
    return alerts


def replay_path() -> Path:
    return ROOT / "public/replay.json"
