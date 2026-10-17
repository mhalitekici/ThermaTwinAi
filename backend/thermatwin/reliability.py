"""Chronological reliability evaluation. Selection never receives a test block.

The deployed temperature estimators remain unchanged. A separate, fingerprinted
policy supplies validation-selected warning rules and calibrated intervals.
"""

from itertools import product

import numpy as np
import pandas as pd

from .model import scores
from .science import climatology, seasonal_day

SEASONS = {
    12: "DJF",
    1: "DJF",
    2: "DJF",
    3: "MAM",
    4: "MAM",
    5: "MAM",
    6: "JJA",
    7: "JJA",
    8: "JJA",
    9: "SON",
    10: "SON",
    11: "SON",
}
POLICY_VERSION = "reliability-v1"


def block_masks(frame, x, horizon, train_end, tune_end, cal_end, test_end):
    target = frame.sst_c.shift(-horizon)
    dates = frame.index + pd.DateOffset(days=horizon)
    valid = x.notna().all(axis=1) & target.notna()
    return {
        "train": valid & (dates <= train_end),
        "validation": valid & (frame.index > train_end) & (dates <= tune_end),
        "calibration": valid & (frame.index > tune_end) & (dates <= cal_end),
        "test": valid & (frame.index > cal_end) & (dates <= test_end),
    }


def seasonal_reference(training: pd.DataFrame) -> pd.DataFrame:
    result = climatology(training)
    doy = seasonal_day(training.index)
    p95 = []
    for day in range(1, 367):
        delta = np.abs(doy - day)
        values = training.loc[np.minimum(delta, 366 - delta) <= 5, "sst_c"].dropna()
        p95.append(float(values.quantile(0.95)))
    result["p95_c"] = np.convolve(np.r_[p95[-15:], p95, p95[:15]], np.ones(31) / 31, "valid")
    return result


def reference_diagnostics(frame: pd.DataFrame, split: dict) -> dict:
    """Reference sensitivity only: no deployment choices are made from test."""
    cutoff = pd.Timestamp(split["train_end"])
    last_full_year = cutoff.year if cutoff.month == 12 and cutoff.day == 31 else cutoff.year - 1
    windows = {
        "frozen_training": frame.loc[:cutoff],
        "last_10_complete_training_years": frame.loc[
            f"{last_full_year - 9}-01-01" : f"{last_full_year}-12-31"
        ],
    }
    result = {}
    for name, training in windows.items():
        climate = seasonal_reference(training)
        rows = {
            "reference_start": str(training.index.min().date()),
            "reference_end": str(training.index.max().date()),
            "periods": {},
        }
        start = frame.index.min()
        for period, end in (
            ("training", split["train_end"]),
            ("validation", split["tuning_end"]),
            ("calibration", split["calibration_end"]),
            ("test", split["test_end"]),
        ):
            block = frame.loc[start : pd.Timestamp(end)]
            ref = climate.loc[seasonal_day(block.index)]
            sst = block.sst_c.to_numpy()
            rows["periods"][period] = {
                "n": len(block),
                "p90_rate": float(np.mean(sst > ref.p90_c.to_numpy())),
                "p95_rate": float(np.mean(sst > ref.p95_c.to_numpy())),
                "mean_anomaly_c": float(np.mean(sst - ref.reference_c.to_numpy())),
            }
            start = pd.Timestamp(end) + pd.DateOffset(days=1)
        result[name] = rows
    return result


def binary_scores(truth, signal) -> dict:
    truth, signal = np.asarray(truth, dtype=bool), np.asarray(signal, dtype=bool)
    tp, fp = int(np.sum(truth & signal)), int(np.sum(~truth & signal))
    fn, tn = int(np.sum(truth & ~signal)), int(np.sum(~truth & ~signal))
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
        "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0,
        "n": len(truth),
    }


def finite_radius(residuals, coverage=0.8) -> float:
    errors = np.sort(np.asarray(residuals, dtype=float))
    if not len(errors) or not np.isfinite(errors).all():
        raise ValueError("Kalibrasyon hataları eksik veya geçersiz.")
    rank = int(np.ceil((len(errors) + 1) * coverage))
    if rank > len(errors):
        raise ValueError("Sonlu tahmin aralığı için kalibrasyon örneği yetersiz.")
    return float(errors[rank - 1])


def calibrate(rows: pd.DataFrame) -> dict:
    errors = np.abs(rows.actual_c - rows.model_c)
    global_radius = finite_radius(errors)
    seasons = pd.DatetimeIndex(rows.target_date).month.map(SEASONS)
    by_season, counts = {}, {}
    for season in ("DJF", "MAM", "JJA", "SON"):
        selected = errors[seasons == season]
        counts[season] = len(selected)
        # Predeclared conservative rule, not selected on test coverage.
        by_season[season] = (
            max(global_radius, finite_radius(selected)) if len(selected) >= 60 else global_radius
        )
    return {
        "nominal_coverage": 0.8,
        "global_radius_c": global_radius,
        "seasonal_envelope_c": by_season,
        "seasonal_n": counts,
        "method": "seasonal_envelope",
        "minimum_season_n": 60,
        "calibration_n": len(rows),
        "calibration_target_end": str(rows.target_date.max())[:10],
    }


def interval_radius(calibration: dict, target_date) -> float:
    season = SEASONS[pd.Timestamp(target_date).month]
    return float(calibration["seasonal_envelope_c"][season])


def policy_signal(rows: pd.DataFrame, policy: dict):
    return (
        rows[policy["source"]].to_numpy() > rows[f"p{policy['percentile']}_c"].to_numpy() + policy["margin_c"]
    )


def select_policy(validation: pd.DataFrame) -> dict:
    """Optimize against ONE fixed P90 truth, including P95 trigger candidates.

    P95 cannot improve F1 by relabeling inconvenient P90 positives as negatives.
    Ties prefer fewer false alarms, then simpler persistence / zero margin.
    """
    candidates = []
    truth = validation.actual_c > validation.p90_c
    for source, percentile, margin in product(
        ("persistence_c", "model_c", "seasonal_drift_c"), (90, 95), (0.0, -0.2, 0.2)
    ):
        policy = {"source": source, "percentile": percentile, "margin_c": margin}
        metric = binary_scores(truth, policy_signal(validation, policy))
        candidates.append({**policy, "validation": metric})
    winner = max(
        candidates,
        key=lambda p: (
            p["validation"]["f1"],
            -p["validation"]["fp"],
            -abs(p["margin_c"]),
            p["source"] == "persistence_c",
        ),
    )
    return {
        **winner,
        "objective": "daily F1 against fixed observed P90 truth",
        "validation_n": len(validation),
        "validation_target_end": str(validation.target_date.max())[:10],
        "candidates": candidates,
    }


def true_events(rows: pd.DataFrame, minimum=5) -> list[dict]:
    """Retrospective evaluation labels only; never used to generate warnings.

    Runs at either edge are censored, gaps split runs. No two-day gap joining.
    """
    days = pd.DatetimeIndex(rows.target_date)
    warm = np.asarray(rows.actual_c > rows.p90_c)
    events, run = [], []
    for i in range(len(days) + 1):
        if run and (i == len(days) or not warm[i] or (days[i] - days[run[-1]]).days != 1):
            if len(run) >= minimum and run[0] > 0 and i < len(days):
                events.append({"start": days[run[0]], "end": days[run[-1]], "days": len(run)})
            run = []
        if i < len(days) and warm[i]:
            run.append(i)
    return events


def episode_notifications(days, signals, clear_days=2) -> np.ndarray:
    """One alert per episode, rearm only after two consecutive clear days."""
    sent, active, clear, last = [], False, 0, None
    for day, signal in zip(pd.DatetimeIndex(days), signals):
        if last is not None and (day - last).days != 1:
            active, clear = False, 0
        notify = bool(signal and not active)
        if signal:
            active, clear = True, 0
        else:
            clear += 1
            if clear >= clear_days:
                active = False
        sent.append(notify)
        last = day
    return np.asarray(sent)


def event_scores(rows: pd.DataFrame, signals) -> dict:
    events = true_events(rows)
    targets, origins = pd.DatetimeIndex(rows.target_date), pd.DatetimeIndex(rows.origin_date)
    signal = np.asarray(signals, dtype=bool)
    sent = episode_notifications(origins, signal)
    # A run already active at the first day or still open on the final day has
    # unknown full length. Do not count its notices as false event alarms.
    warm = np.asarray(rows.actual_c > rows.p90_c)
    censored = np.zeros(len(rows), dtype=bool)
    for indices in (range(len(rows)), range(len(rows) - 1, -1, -1)):
        for i in indices:
            if not warm[i]:
                break
            censored[i] = True
    # Operational pre-onset notices require the current observation to be normal.
    early_sent = sent & (rows.persistence_c.to_numpy() <= rows.origin_p90_c.to_numpy())
    matched = np.zeros(len(rows), dtype=bool)
    found, early, lead_days = 0, 0, []
    for event in events:
        inside = (targets >= event["start"]) & (targets <= event["end"])
        matched |= inside
        found += int(np.any(sent & inside))
        before = early_sent & inside & (origins < event["start"])
        if before.any():
            early += 1
            lead_days.append(int((event["start"] - origins[before].min()).days))
    # Each notice maps to at most one event; event precision counts unique hits.
    notices = int(sent.sum())
    false = int(np.sum(sent & ~matched & ~censored))
    precision = found / (found + false) if found + false else 0.0
    recall = found / len(events) if events else 0.0
    return {
        "events": len(events),
        "detected_events": found,
        "missed_events": len(events) - found,
        "early_events": early,
        "early_recall": early / len(events) if events else 0.0,
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "raw_positive_days": int(signal.sum()),
        "notifications": notices,
        "suppressed_repeats": int(signal.sum()) - notices,
        "false_notifications": false,
        "censored_notifications": int(np.sum(sent & censored)),
        "mean_early_lead_days": float(np.mean(lead_days)) if lead_days else None,
        "censoring": "Runs touching evaluation edges excluded; no gap merging; >=5 consecutive P90 days",
        "notification_rule": "one per episode; two clear days rearm; early notice requires normal origin",
    }


def summarize(rows: pd.DataFrame, policy: dict, calibration: dict) -> dict:
    actual = rows.actual_c.to_numpy()
    prediction = rows.model_c.to_numpy()
    error = np.abs(actual - prediction)
    radii = np.array([interval_radius(calibration, d) for d in rows.target_date])
    truth = actual > rows.p90_c.to_numpy()
    optimized = policy_signal(rows, policy)
    methods = {
        name: scores(actual, rows[col])
        for name, col in (
            ("model", "model_c"),
            ("persistence", "persistence_c"),
            ("seasonal", "seasonal_c"),
            ("seasonal_naive", "seasonal_naive_c"),
            ("seasonal_drift", "seasonal_drift_c"),
        )
    }
    result = {
        "n": len(rows),
        **methods,
        "mae_improvement_pct": 100 * (1 - methods["model"]["mae_c"] / methods["persistence"]["mae_c"]),
        "daily": {
            "optimized": binary_scores(truth, optimized),
            "old_model_p90": binary_scores(truth, prediction > rows.p90_c.to_numpy()),
            "persistence_p90": binary_scores(truth, rows.persistence_c.to_numpy() > rows.p90_c.to_numpy()),
        },
        "threshold_diagnostics": {
            str(p): {
                "model": binary_scores(actual > rows[f"p{p}_c"], prediction > rows[f"p{p}_c"]),
                "persistence": binary_scores(actual > rows[f"p{p}_c"], rows.persistence_c > rows[f"p{p}_c"]),
            }
            for p in (90, 95)
        },
        "events": {
            "optimized": event_scores(rows, optimized),
            "persistence": event_scores(rows, rows.persistence_c.to_numpy() > rows.p90_c.to_numpy()),
        },
        "interval": {
            "nominal": 0.8,
            "coverage": float(np.mean(error <= radii)),
            "global_coverage": float(np.mean(error <= calibration["global_radius_c"])),
            "mean_width_c": float(np.mean(2 * radii)),
            "misses": int(np.sum(error > radii)),
            "n": len(rows),
        },
        "subgroups": {},
    }
    groups = {
        "rising": actual - rows.persistence_c.to_numpy() >= 0.5,
        "extreme_p95": actual > rows.p95_c.to_numpy(),
    }
    seasons = pd.DatetimeIndex(rows.target_date).month.map(SEASONS)
    groups.update({season: seasons == season for season in ("DJF", "MAM", "JJA", "SON")})
    for name, mask in groups.items():
        if np.any(mask):
            result["subgroups"][name] = {
                "n": int(np.sum(mask)),
                "model": scores(actual[mask], prediction[mask]),
                "persistence": scores(actual[mask], rows.persistence_c.to_numpy()[mask]),
                "coverage": float(np.mean(error[mask] <= radii[mask])),
            }
    worst = rows.assign(absolute_error_c=error).nlargest(5, "absolute_error_c")
    result["worst_errors"] = (
        worst[["origin_date", "target_date", "actual_c", "model_c", "absolute_error_c"]]
        .astype({"origin_date": str, "target_date": str})
        .to_dict("records")
    )
    return result
