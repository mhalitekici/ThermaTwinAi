"""Causal local early-warning engine; no email or remote service access."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .config import ROOT
from .warning_decision import decide as decide
from .model import forecast
from .reliability import POLICY_VERSION, interval_radius
from .science import features, risk, seasonal_day

POLICY_PATH = ROOT / "artifacts/reliability/v1/deployed-policy.json"




def transition(previous: dict | None, decision: dict) -> dict:
    """Stable alert IDs + onset/escalation only; two clear days rearm.

    Calling again on the same day cannot create a new notification. State can
    be persisted by a caller; static replay reconstructs it from past days.
    """
    day = pd.Timestamp(decision["origin_date"])
    old = previous or {}
    if old.get("last_date") and day < pd.Timestamp(old["last_date"]):
        raise ValueError("Uyarı durum geçişleri kronolojik olmalı.")
    state = decision["state"]
    active = old.get("active", False)
    clear = old.get("clear_days", 0)
    level = {"normal": 0, "forecast_risk": 1, "observed_anomaly": 2, "insufficient_data": -1}[state]
    same_day = old.get("last_date") == decision["origin_date"]
    gap = old.get("last_date") and (day - pd.Timestamp(old["last_date"])).days > 1
    # Unknown days do not count as clear and cannot silently rearm an episode.
    if gap:
        clear = 0
    notify = False
    episode = old.get("episode_start")
    peak = old.get("peak_level", 0)
    if level > 0:
        notify = not same_day and (not active or level > peak)
        if not active:
            episode, peak = decision["origin_date"], 0
        active, clear, peak = True, 0, max(peak, level)
    elif level == 0 and not same_day:
        clear += 1
        if clear >= 2:
            active, peak = False, 0
    elif level < 0:
        clear = 0
    key = f"{POLICY_VERSION}:{episode}:{state}"
    return {
        **decision,
        "notify": notify,
        "episode_start": episode,
        "alert_id": hashlib.sha256(key.encode()).hexdigest()[:20] if level > 0 else None,
        "suppression_reason": "Aynı olay sürüyor; tekrar bildirim bastırıldı."
        if level > 0 and not notify
        else None,
        "active": active,
        "clear_days": clear,
        "peak_level": peak,
        "last_date": decision["origin_date"],
    }


def calibrated_forecasts(frame, bundle, origin, policy):
    rows = forecast(frame, bundle, origin)
    current = float(frame.loc[origin, "sst_c"])
    climate = bundle["climate"]
    origin_reference = float(climate.loc[seasonal_day(pd.DatetimeIndex([origin]))[0], "reference_c"])
    origin_features = features(frame.loc[:origin]).tail(1)
    for row in rows:
        h = str(row["horizon_days"])
        item = policy["horizons"][h]
        model = bundle["models"][int(h)]
        raw_prediction = current + model["weight"] * float(model["model"].predict(origin_features)[0])
        radius = interval_radius(item["calibration"], row["target_date"])
        row["lower_c"], row["upper_c"] = round(row["sst_c"] - radius, 3), round(row["sst_c"] + radius, 3)
        row["interval"] = {
            "nominal_coverage": 0.8,
            "method": "validation residual seasonal envelope",
            "calibration_end": item["calibration"]["calibration_target_end"],
            "test_coverage": item["evaluation"]["interval"]["coverage"],
        }
        rule = item["warning_policy"]
        row["risk"] = risk(raw_prediction, row["reference_c"], row["p90_c"])
        signal_value = {
            "model_c": raw_prediction,
            "persistence_c": current,
            "seasonal_drift_c": current + row["reference_c"] - origin_reference,
        }[rule["source"]]
        day = seasonal_day(pd.DatetimeIndex([pd.Timestamp(row["target_date"])]))[0]
        p95 = float(policy["p95_c"][str(day)])
        threshold = row["p90_c"] if rule["percentile"] == 90 else p95
        trigger = threshold + rule["margin_c"]
        source_name = {
            "model_c": "XGBoost tahmini",
            "persistence_c": "son gözlemin devamı",
            "seasonal_drift_c": "son gözlem ve mevsimsel değişim",
        }[rule["source"]]
        fired = bool(signal_value > trigger)
        row["warning"] = {
            "triggered": fired,
            "signal_c": signal_value,
            "threshold_c": trigger,
            "percentile": rule["percentile"],
            "source": rule["source"],
            "margin_c": rule["margin_c"],
            "reason": f"+{row['horizon_days'] * 24} saat için {source_name} {signal_value:.2f} °C; "
            f"validation ile seçilen P{rule['percentile']} ve {rule['margin_c']:+.2f} °C marjlı "
            f"{trigger:.2f} °C tetik eşiğini {'aşıyor' if fired else 'aşmıyor'}. "
            "Bu sinyal bir olayın gerçekleşme olasılığı değildir.",
        }
    return rows


def apply_reliability(
    snap: dict, frame: pd.DataFrame, bundle: dict, *, policy_path: Path = POLICY_PATH
) -> dict:
    if not policy_path.exists() or snap["source"]["provider"] != "Copernicus Marine":
        return snap
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    model_path = ROOT / "artifacts" / snap["source"]["dataset_id"] / "model.joblib"
    if policy["model_sha256"] != hashlib.sha256(model_path.read_bytes()).hexdigest():
        raise ValueError("Uyarı politikası farklı bir model için kalibre edilmiş.")
    origin = pd.Timestamp(snap["origin_date"])
    if origin <= pd.Timestamp(policy["calibration_end"]):
        raise ValueError("Uyarı tekrarı kalibrasyon bitiminden sonra olmalı.")
    snap["forecasts"] = calibrated_forecasts(frame, bundle, origin, policy)
    # Reconstruct state from the past only, including the previous episode.
    start = pd.Timestamp(policy["calibration_end"]) + pd.DateOffset(days=1)
    x = features(frame.loc[:origin])
    valid = x.notna().all(axis=1)
    model_values = {
        h: pd.Series(
            frame.loc[valid.index[valid], "sst_c"].to_numpy()
            + m["weight"] * m["model"].predict(x.loc[valid]),
            index=x.index[valid],
        )
        for h, m in bundle["models"].items()
    }
    state = None
    for day in frame.loc[start:origin].index:
        if not valid.loc[day]:
            decision = decide({}, [], day.date().isoformat(), sufficient=False)
        else:
            observed = float(frame.loc[day, "sst_c"])
            ref = bundle["climate"].loc[seasonal_day(pd.DatetimeIndex([day]))[0]]
            future = []
            # Vectorization belongs in backtesting; only replay origins use this path.
            for h in bundle["models"]:
                target = day + pd.DateOffset(days=h)
                rule = policy["horizons"][str(h)]["warning_policy"]
                target_ref = bundle["climate"].loc[seasonal_day(pd.DatetimeIndex([target]))[0]]
                value = {
                    "model_c": float(model_values[h].loc[day]),
                    "persistence_c": observed,
                    "seasonal_drift_c": observed + target_ref.reference_c - ref.reference_c,
                }[rule["source"]]
                limit = (
                    target_ref.p90_c
                    if rule["percentile"] == 90
                    else policy["p95_c"][str(seasonal_day(pd.DatetimeIndex([target]))[0])]
                )
                future.append(
                    {
                        "horizon_days": h,
                        "lower_c": None,
                        "upper_c": None,
                        "warning": {
                            "triggered": value > limit + rule["margin_c"],
                            "reason": "Geçmiş başlangıç sinyali",
                        },
                    }
                )
            decision = decide({"sst_c": observed, "p90_c": float(ref.p90_c)}, future, day.date().isoformat())
        state = transition(state, decision)
    current = decide(snap["observation"], snap["forecasts"], snap["origin_date"], stale=snap["stale"])
    # Preserve today's notify decision; do not apply the same day twice.
    notification = state if current["state"] == state["state"] else transition(state, current)
    snap["early_warning"] = {
        **notification,
        **current,
        "policy_version": POLICY_VERSION,
        "data_date": snap["origin_date"],
        "model_sha256": policy["model_sha256"],
        "rule": "Olay başlangıcı ve gözlenmiş anomaliye geçişte bir bildirim; iki normal günle yeniden kurulur.",
    }
    if snap["early_warning"]["alert_id"]:
        snap["early_warning"]["alert_id"] = hashlib.sha256(
            f"{snap['region']['id']}:{snap['source']['dataset_id']}:{snap['early_warning']['alert_id']}".encode()
        ).hexdigest()[:20]
    return snap


def evaluate_engine(by_horizon: dict[int, pd.DataFrame]) -> tuple[dict, pd.DataFrame]:
    """Replay the exact combined state machine; labels are used ONLY afterwards."""
    from .reliability import true_events

    indexed = {h: rows.set_index("origin_date") for h, rows in by_horizon.items()}
    origins = indexed[1].index.intersection(indexed[2].index).intersection(indexed[3].index).sort_values()
    state, trace = None, []
    for day in origins:
        observed = indexed[1].loc[day]
        future = [
            {
                "horizon_days": h,
                "lower_c": float(indexed[h].loc[day].model_c - indexed[h].loc[day].radius_c),
                "upper_c": float(indexed[h].loc[day].model_c + indexed[h].loc[day].radius_c),
                "warning": {
                    "triggered": bool(indexed[h].loc[day].optimized_signal),
                    "reason": "Validation-selected rule",
                },
            }
            for h in (1, 2, 3)
        ]
        decision = decide(
            {"sst_c": float(observed.persistence_c), "p90_c": float(observed.origin_p90_c)},
            future,
            day.date().isoformat(),
        )
        state = transition(state, decision)
        target = day + pd.DateOffset(hours=decision["horizon_hours"] or 0)
        trace.append(
            {
                **state,
                "target_date": target,
                "sst_c": float(observed.persistence_c),
                "p90_c": float(observed.origin_p90_c),
            }
        )
    rows = pd.DataFrame(trace)
    labels = pd.DataFrame({"target_date": origins, "actual_c": rows.sst_c, "p90_c": rows.p90_c})
    events = true_events(labels)
    notified = rows[rows.notify]
    matched = np.zeros(len(notified), dtype=bool)
    early, detected = 0, 0
    for event in events:
        targets = pd.DatetimeIndex(notified.target_date)
        issued = pd.DatetimeIndex(notified.origin_date)
        hit = (targets >= event["start"]) & (targets <= event["end"])
        matched |= hit
        detected += int(hit.any())
        early += int(np.any(hit & (issued < event["start"]) & (notified.state.to_numpy() == "forecast_risk")))
    # Exclude boundary-censored warm runs from the false-event numerator.
    censored_days = set()
    warm = rows.sst_c.to_numpy() > rows.p90_c.to_numpy()
    for indices in (range(len(rows)), range(len(rows) - 1, -1, -1)):
        for i in indices:
            if not warm[i]:
                break
            censored_days.add(origins[i])
    censored = np.array([d in censored_days for d in notified.target_date])
    false = int(np.sum(~matched & ~censored))
    precision = detected / max(1, detected + false)
    recall = detected / max(1, len(events))
    result = {
        "origins": len(rows),
        "events": len(events),
        "detected_events": detected,
        "early_events": early,
        "missed_events": len(events) - detected,
        "notifications": len(notified),
        "forecast_notifications": int((notified.state == "forecast_risk").sum()),
        "observed_notifications": int((notified.state == "observed_anomaly").sum()),
        "suppressed_repeats": int(rows.suppression_reason.notna().sum()),
        "false_event_notifications": false,
        "censored_notifications": int(censored.sum()),
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / max(1e-12, precision + recall),
        "early_recall": early / max(1, len(events)),
        "note": "Combined engine, onset/escalation notices; event labels are retrospective >=5-day P90 runs; boundary runs excluded",
    }
    return result, rows
