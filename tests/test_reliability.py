"""Synthetic fixtures test invariants; reported skill uses real artifacts only."""

import json
from datetime import UTC, datetime

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from thermatwin.api import app
from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.reliability import (
    binary_scores,
    block_masks,
    calibrate,
    event_scores,
    finite_radius,
    interval_radius,
    policy_signal,
    select_policy,
)
from thermatwin.science import features
from thermatwin.warning import apply_reliability, decide, transition


def test_target_boundaries_are_purged_for_all_horizons():
    frame = pd.DataFrame({"sst_c": np.arange(100.0)}, index=pd.date_range("2024-01-01", periods=100))
    x = features(frame)
    boundaries = frame.index[[39, 59, 79, 99]]
    for h in (1, 2, 3):
        masks = block_masks(frame, x, h, *boundaries)
        for i, name in enumerate(("train", "validation", "calibration", "test")):
            origins = frame.index[masks[name]]
            assert ((origins + pd.Timedelta(days=h)) <= boundaries[i]).all()
            if i:
                assert (origins > boundaries[i - 1]).all()
        assert not any(sum(mask.astype(int) for mask in masks.values()) > 1)


def test_finite_sample_rank_and_sparse_season_fallback():
    assert finite_radius(np.arange(9.0)) == 7.0  # ceil((9+1)*.8)-th order statistic
    with pytest.raises(ValueError, match="yetersiz"):
        finite_radius([0.1, 0.2])
    rows = pd.DataFrame(
        {
            "target_date": pd.date_range("2024-01-01", periods=80),
            "actual_c": np.arange(80.0) / 100,
            "model_c": 0.0,
        }
    )
    calibrated = calibrate(rows)
    assert calibrated["seasonal_n"]["JJA"] == 0
    assert interval_radius(calibrated, "2025-07-01") == calibrated["global_radius_c"]
    assert all(v >= calibrated["global_radius_c"] for v in calibrated["seasonal_envelope_c"].values())


def test_policy_compares_p95_triggers_to_fixed_p90_truth():
    rows = pd.DataFrame(
        {
            "actual_c": [22.0, 23.0, 20.0, 20.0],
            "p90_c": 21.0,
            "p95_c": 24.0,
            "persistence_c": [22.0, 23.0, 20.0, 20.0],
            "model_c": 20.0,
            "seasonal_drift_c": 20.0,
            "target_date": pd.date_range("2024-01-01", periods=4),
        }
    )
    policy = select_policy(rows)
    assert policy["source"] == "persistence_c" and policy["percentile"] == 90
    assert policy["validation"]["f1"] == 1.0
    for candidate in policy["candidates"]:
        assert candidate["validation"] == binary_scores(
            rows.actual_c > rows.p90_c, policy_signal(rows, candidate)
        )


def test_states_quality_gate_and_predicted_risk_are_separate():
    future = [
        {
            "horizon_days": h,
            "lower_c": 20.0,
            "upper_c": 24.0,
            "warning": {"triggered": h == 2, "reason": "SYNTHETIC FIXTURE"},
        }
        for h in (1, 2, 3)
    ]
    normal = {"sst_c": 20.0, "p90_c": 21.0}
    assert decide(normal, future, "2024-01-01")["state"] == "forecast_risk"
    assert decide(normal, future, "2024-01-01")["horizon_hours"] == 48
    assert decide({"sst_c": 22.0, "p90_c": 21.0}, future, "2024-01-01")["state"] == "observed_anomaly"
    assert decide(normal, future, "2024-01-01", stale=True)["state"] == "insufficient_data"
    assert decide({"sst_c": np.nan}, future, "2024-01-01")["state"] == "insufficient_data"
    assert not transition(None, decide(normal, [], "2024-01-01"))["notify"]
    for f in future:
        f["warning"]["triggered"] = False
    assert decide(normal, future, "2024-01-01")["state"] == "normal"


def test_episode_dedupe_escalation_two_clear_days_and_unknown_not_clear():
    def step(previous, day, state):
        return transition(previous, {"origin_date": f"2024-01-{day:02}", "state": state})

    state = step(None, 1, "forecast_risk")
    assert state["notify"]
    repeated = step(state, 1, "forecast_risk")
    assert not repeated["notify"] and repeated["alert_id"] == state["alert_id"]
    state = step(state, 2, "observed_anomaly")
    assert state["notify"]
    state = step(state, 3, "normal")
    state = step(state, 4, "insufficient_data")
    state = step(state, 5, "normal")
    state = step(state, 6, "observed_anomaly")
    assert not state["notify"]
    state = step(step(state, 7, "normal"), 8, "normal")
    assert step(state, 9, "forecast_risk")["notify"]
    with pytest.raises(ValueError, match="kronolojik"):
        step(state, 2, "normal")


def test_event_score_counts_early_notice_and_censors_open_boundary_runs():
    target = pd.date_range("2024-01-01", periods=12)
    rows = pd.DataFrame(
        {
            "target_date": target,
            "origin_date": target - pd.Timedelta(days=1),
            "actual_c": [20.0] * 3 + [23.0] * 5 + [20.0] * 4,
            "p90_c": 21.0,
            "persistence_c": 20.0,
            "origin_p90_c": 21.0,
        }
    )
    signal = np.array([False] * 3 + [True] * 5 + [False] * 4)
    metric = event_scores(rows, signal)
    assert metric["events"] == metric["early_events"] == metric["notifications"] == 1
    assert metric["suppressed_repeats"] == 4 and metric["false_notifications"] == 0
    rows.loc[:4, "actual_c"] = 23.0
    assert event_scores(rows, signal)["events"] == 0
    assert event_scores(rows, signal)["false_notifications"] == 0


def test_real_report_confusion_calibration_and_model_are_reproducible():
    path = ROOT / "artifacts/reliability/v1/deployed-1d.csv"
    if not path.exists():
        pytest.skip("Real reliability artifacts not in clean checkout")
    report = json.loads((ROOT / "docs/reliability-report.json").read_text(encoding="utf-8"))
    assert len(report["folds"]) == 8
    for fold in report["folds"]:
        assert fold["train_end"] < fold["validation_end"] < fold["calibration_end"] < fold["test_end"]
        for item in fold["horizons"].values():
            assert (
                item["warning_policy"]["validation_target_end"]
                < item["calibration"]["calibration_target_end"]
                < fold["test_end"]
            )
    for h in (1, 2, 3):
        rows = pd.read_csv(path.with_name(f"deployed-{h}d.csv"))
        item = report["deployed"]["horizons"][str(h)]
        assert (rows.origin_date > report["deployed"]["calibration_end"][:10]).all()
        assert (
            binary_scores(rows.actual_c > rows.p90_c, rows.optimized_signal)
            == item["evaluation"]["daily"]["optimized"]
        )
        coverage = float(np.mean(np.abs(rows.actual_c - rows.model_c) <= rows.radius_c))
        assert coverage == item["evaluation"]["interval"]["coverage"]
        best = max(c["validation"]["f1"] for c in item["warning_policy"]["candidates"])
        assert best == item["warning_policy"]["validation"]["f1"]


def test_real_warning_replay_is_independent_of_future_observations():
    path = ROOT / "artifacts/reliability/v1/deployed-policy.json"
    if not path.exists():
        pytest.skip("Real reliability artifacts not in clean checkout")
    frame, source = load_series("copernicus")
    bundle = joblib.load(ROOT / "artifacts" / source["dataset_id"] / "model.joblib")
    base = json.loads((ROOT / "public/replay.json").read_text(encoding="utf-8"))
    before = apply_reliability(json.loads(json.dumps(base)), frame, bundle)
    frame.loc[frame.index > pd.Timestamp(base["origin_date"]), "sst_c"] = -1.0
    after = apply_reliability(json.loads(json.dumps(base)), frame, bundle)
    assert before["forecasts"] == after["forecasts"]
    assert before["early_warning"] == after["early_warning"]
    assert [f["sst_c"] for f in before["forecasts"]] == [f["sst_c"] for f in base["forecasts"]]
    trace = json.loads(path.with_name("deployed-engine-trace.json").read_text(encoding="utf-8"))
    entry = next(r for r in trace if r["origin_date"] == base["origin_date"])
    assert entry["state"] == before["early_warning"]["state"]
    assert entry["notify"] == before["early_warning"]["notify"]


def test_additional_real_replays_include_both_success_and_false_event_warning():
    examples = json.loads((ROOT / "public/reliability-replays.json").read_text(encoding="utf-8"))["events"]
    assert {e["replay_label"] for e in examples} == {"Olaydan önce sinyal", "Olay oluşmayan sinyal"}
    for event in examples:
        assert event["early_warning"]["state"] == "forecast_risk"
        assert event["early_warning"]["notify"]
        assert event["observation"]["sst_c"] <= event["observation"]["p90_c"]
        assert event["early_warning"]["horizon_hours"] == 72
        assert all(day["date"] <= event["origin_date"] for day in event["history"])
        assert "Sonradan gözlenen sonuç" in event["replay_assessment"]


def test_local_api_serves_the_same_calibrated_replay_as_dashboard(monkeypatch):
    expected = json.loads((ROOT / "public/reliability-snapshots.json").read_text(encoding="utf-8"))[
        "snapshots"
    ]
    origin = json.loads((ROOT / "public/replay.json").read_text(encoding="utf-8"))["origin_date"]
    expected = next(e for e in expected if e["mode"] == "replay" and e["origin_date"] == origin)
    with TestClient(app) as client:
        response = client.get("/snapshot?mode=replay")
        assert response.status_code == 200
        payload = response.json()
        assert payload["forecasts"] == expected["forecasts"]
        assert payload["early_warning"] == expected["early_warning"]
        if (ROOT / "artifacts/live.json").exists():
            from thermatwin import api as api_module

            class FutureDate(datetime):
                @classmethod
                def now(cls, tz=None):
                    return cls(2030, 1, 1, tzinfo=UTC)

            monkeypatch.setattr(api_module, "datetime", FutureDate)
            stale = client.get("/snapshot?mode=live").json()
            assert stale["stale"] and stale["age_days"] > 3
            assert stale["reports"] == []
            assert stale["early_warning"]["state"] == "insufficient_data"
            assert not stale["early_warning"]["notify"]
