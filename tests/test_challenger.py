"""Synthetic invariant tests and actual separately packaged candidate smoke."""

import hashlib
import importlib.util
import json
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import joblib
import numpy as np
import pandas as pd
import pytest
from thermatwin.challenger import CausalFeatureExpansion, promotion_gates, select_candidate
from thermatwin.model import forecast
from thermatwin.science import features

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / "research/candidate-vnext"


def test_expansion_is_causal_row_local_and_never_mutates_original_contract():
    index = pd.date_range("2024-01-01", periods=90)
    frame = pd.DataFrame({"sst_c": 20 + np.sin(np.arange(90) / 10)}, index=index)
    changed = frame.copy()
    changed.loc[index[70] :, "sst_c"] = 30
    x = features(frame).dropna()
    expansion = CausalFeatureExpansion().fit(x)
    a, b = expansion.transform(x), expansion.transform(features(changed).dropna())
    pd.testing.assert_frame_equal(a.loc[: index[69]], b.loc[: index[69]])
    pd.testing.assert_frame_equal(a.iloc[[-1]], expansion.transform(x.iloc[[-1]]))
    assert len(a.columns) == len(x.columns) + 9 and "delta1" not in x
    with pytest.raises(ValueError):
        expansion.transform(x[x.columns[::-1]])


def test_validation_only_selection_and_persistence_are_available():
    protocol = json.loads((EXPERIMENT / "protocol.json").read_text(encoding="utf-8"))
    protocol["variants"] = [{"name": "tiny-square", "objective": "reg:squarederror", "n_estimators": 3}]
    frame = pd.DataFrame({"sst_c": np.full(120, 20.0)}, index=pd.date_range("2024-01-01", periods=120))
    x = features(frame).dropna()
    model, selection, board = select_candidate(
        x.iloc[:60], np.zeros(60), x.iloc[60:80], np.full(20, 20.0), np.full(20, 20.0), protocol
    )
    assert selection["weight"] == 0 and len(board) == 5
    assert np.isfinite(model.predict(x.tail(1))).all()


def test_predeclared_gates_require_every_horizon_and_warning_safety():
    protocol = json.loads((EXPERIMENT / "protocol.json").read_text(encoding="utf-8"))
    score = {
        "model": {"mae_c": 1.0, "rmse_c": 1.0},
        "daily": {"optimized": {"f1": 0.8, "recall": 0.8}},
        "interval": {"coverage": 0.8, "mean_width_c": 1.0},
        "subgroups": {"rising": {"model": {"mae_c": 1.0}}},
        "year_season": {"2025": {"n": 100, "mae_c": 1.0}},
    }
    champion = {
        "horizons": {h: deepcopy(score) for h in ("1", "2", "3")},
        "combined_engine": {"early_events": 2, "false_event_notifications": 5},
    }
    candidate = deepcopy(champion)
    for item in candidate["horizons"].values():
        item["model"]["mae_c"] = 0.95
    assert promotion_gates(candidate, champion, protocol["gates"])["passed"]
    candidate["horizons"]["2"]["daily"]["optimized"]["f1"] = 0.7
    candidate["combined_engine"]["false_event_notifications"] = 6
    gate = promotion_gates(candidate, champion, protocol["gates"])
    assert not gate["passed"] and gate["failed"] == ["2d/warning_f1", "false_event_notices"]


def test_actual_candidate_bundle_installs_hash_checks_and_runs_existing_monitor_inference(
    tmp_path, monkeypatch
):
    manifest = json.loads((EXPERIMENT / "runtime-manifest.json").read_text(encoding="utf-8"))
    content = (EXPERIMENT / "runtime-bundle.zip").read_bytes()
    spec = importlib.util.spec_from_file_location(
        "candidate_installer", ROOT / "scripts/prepare_monitor_model.py"
    )
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    monkeypatch.setattr(installer, "ROOT", tmp_path)
    installer.install_bundle(content, manifest)
    with pytest.raises(ValueError, match="SHA-256"):
        installer.install_bundle(content + b"corrupt", manifest)
    with ZipFile(BytesIO(content)) as z:
        assert set(z.namelist()) == {"model.joblib", "deployed-policy.json", "manifest.json"}
        policy = json.loads(z.read("deployed-policy.json"))
        assert policy["model_sha256"] == manifest["model_sha256"]
    model_path = tmp_path / "artifacts" / manifest["dataset_id"] / "model.joblib"
    assert hashlib.sha256(model_path.read_bytes()).hexdigest() == manifest["model_sha256"]
    bundle = joblib.load(model_path)
    # Actual dated public history, no download or synthetic benchmark claim.
    snapshot = json.loads((ROOT / "public/live.json").read_text(encoding="utf-8"))
    frame = pd.DataFrame(snapshot["history"])
    frame.index = pd.to_datetime(frame.pop("date"))
    frame = frame[["sst_c"]]
    rows = forecast(frame, bundle)
    assert len(rows) == 3 and all(np.isfinite(r["sst_c"]) for r in rows)
    from thermatwin import warning
    from thermatwin.pipeline import snapshot as create_snapshot

    original = warning.apply_reliability
    monkeypatch.setattr(warning, "ROOT", tmp_path)
    monkeypatch.setattr(
        warning,
        "apply_reliability",
        lambda snap, frame, bundle: original(
            snap, frame, bundle, policy_path=tmp_path / "artifacts/reliability/v1/deployed-policy.json"
        ),
    )
    result = create_snapshot(frame, bundle, "replay", allow_llm=False)
    assert result["early_warning"]["model_sha256"] == manifest["model_sha256"]
    assert result["evaluation"]["model_version"].startswith("candidate-vnext")
    json.dumps(result, allow_nan=False)


def test_report_gates_and_predeclared_fingerprints_are_reproducible():
    protocol_path = EXPERIMENT / "protocol.json"
    protocol = json.loads(protocol_path.read_text(encoding="utf-8"))
    report = json.loads((EXPERIMENT / "report.json").read_text(encoding="utf-8"))
    assert (
        report["protocol_sha256_lf"]
        == hashlib.sha256(protocol_path.read_text(encoding="utf-8").encode()).hexdigest()
    )
    assert report["protocol_commit"] == "6c859ec" or report["protocol_commit"].startswith("6c859ec")
    for scope in ("rolling", "frozen"):
        assert (
            promotion_gates(report[scope]["candidate"], report[scope]["champion"], protocol["gates"])
            == report["gates"][scope]
        )
    expected = (
        "proposal_only_requires_owner_review"
        if all(g["passed"] for g in report["gates"].values())
        else "retain_champion_do_not_promote"
    )
    assert report["recommendation"] == expected


def test_packaged_real_test_rows_reproduce_published_candidate_champion_comparisons():
    manifest = json.loads((EXPERIMENT / "evidence-manifest.json").read_text(encoding="utf-8"))
    report = json.loads((EXPERIMENT / "report.json").read_text(encoding="utf-8"))
    content = (EXPERIMENT / "held-out-predictions.csv.gz").read_bytes()
    assert hashlib.sha256(content).hexdigest() == manifest["comparison_sha256"]
    assert (
        hashlib.sha256((EXPERIMENT / "report.json").read_text(encoding="utf-8").encode()).hexdigest()
        == manifest["report_sha256_lf"]
    )
    rows = pd.read_csv(EXPERIMENT / "held-out-predictions.csv.gz", parse_dates=["origin_date", "target_date"])
    assert len(rows) == manifest["records"]
    assert not rows.duplicated(["scope", "strategy", "horizon", "origin_date"]).any()
    for fold in [*report["folds"], report["frozen"]["selection"]]:
        selected = rows.loc[rows.fold.astype(str) == str(fold["label"])]
        assert len(selected)
        assert (selected.origin_date > pd.Timestamp(fold["calibration_end"])).all()
        assert (selected.target_date <= pd.Timestamp(fold["test_end"])).all()
        assert fold["train_end"] < fold["validation_end"] < fold["calibration_end"]
    for (scope, strategy, horizon), group in rows.groupby(["scope", "strategy", "horizon"]):
        expected = report[scope][strategy]["horizons"][str(horizon)]
        assert len(group) == expected["n"]
        assert ((group.target_date - group.origin_date).dt.days == horizon).all()
        errors = group.model_c - group.actual_c
        assert errors.abs().mean() == pytest.approx(expected["model"]["mae_c"], abs=1e-12)
        assert np.sqrt((errors**2).mean()) == pytest.approx(expected["model"]["rmse_c"], abs=1e-12)
        assert (errors.abs() <= group.radius_c).mean() == pytest.approx(expected["interval"]["coverage"])
        for key, path in report["original_hashes_preserved"].items():
            original = ROOT / key
            if original.exists():
                content = original.read_bytes()
                variants = [content]
                if original.suffix == ".json":
                    lf = content.replace(b"\r\n", b"\n")
                    variants.extend([lf, lf.replace(b"\n", b"\r\n")])
                assert path in {hashlib.sha256(value).hexdigest() for value in variants}
