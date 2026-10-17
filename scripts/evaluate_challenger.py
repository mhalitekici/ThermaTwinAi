"""One predeclared offline run. Never writes original weights/policies/data."""

import hashlib
import importlib.metadata
import json
import os
import platform
import subprocess
from copy import deepcopy
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

# Importing config in this offline process must not load .env/provider accounts.
os.environ["APP_ENV"] = "research"

import joblib
import numpy as np
import pandas as pd
from evaluate_reliability import evaluate_blocks, pooled_summary, prediction_rows
from thermatwin.challenger import promotion_gates, select_candidate, subgroup_scores
from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.model import forecast
from thermatwin.reliability import (
    block_masks,
    interval_radius,
    policy_signal,
    seasonal_reference,
    true_events,
)
from thermatwin.science import FEATURES, features
from thermatwin.warning import calibrated_forecasts, evaluate_engine

EXPERIMENT = ROOT / "research/candidate-vnext"
OUTPUT = ROOT / "artifacts/experiments/candidate-vnext-2026-10-17-v1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(value, path):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def engine_metrics(rows):
    metric, trace = evaluate_engine(rows)
    trace["origin_date"] = pd.to_datetime(trace.origin_date)
    trace["target_date"] = pd.to_datetime(trace.target_date)
    origins = pd.DatetimeIndex(trace.origin_date)
    labels = pd.DataFrame({"target_date": origins, "actual_c": trace.sst_c, "p90_c": trace.p90_c})
    events = true_events(labels)
    notices = trace.loc[trace.notify & (trace.state == "forecast_risk")]
    leads = []
    for event in events:
        matches = notices.loc[
            (notices.target_date >= event["start"])
            & (notices.target_date <= event["end"])
            & (notices.origin_date < event["start"])
        ]
        if len(matches):
            leads.append(int((event["start"] - matches.origin_date.min()).days))
    assert len(leads) == metric["early_events"]
    metric["early_lead_days"] = leads
    metric["mean_early_lead_days"] = float(np.mean(leads)) if leads else None
    return metric, trace


def rolling_pool(folds, traces):
    result = {"horizons": {}, "combined_engine": {}}
    for h in (1, 2, 3):
        rows = pd.concat(traces[h], ignore_index=True)
        item = pooled_summary([f["horizons"][str(h)]["evaluation"] for f in folds], rows)
        item["year_season"] = subgroup_scores(rows)
        result["horizons"][str(h)] = item
    metrics = [f["combined_engine"] for f in folds]
    for key in (
        "origins",
        "events",
        "detected_events",
        "early_events",
        "notifications",
        "false_event_notifications",
    ):
        result["combined_engine"][key] = sum(m[key] for m in metrics)
    leads = [lead for m in metrics for lead in m["early_lead_days"]]
    result["combined_engine"].update(
        {"early_lead_days": leads, "mean_early_lead_days": float(np.mean(leads)) if leads else None}
    )
    return result


def build_runtime(bundle, policy):
    binary = BytesIO()
    joblib.dump(bundle, binary)
    model = binary.getvalue()
    model_hash = hashlib.sha256(model).hexdigest()
    policy["model_sha256"] = model_hash
    policy_bytes = (json.dumps(policy, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    manifest = {
        "dataset_id": bundle["source"]["dataset_id"],
        "model_sha256": model_hash,
        "policy_sha256": hashlib.sha256(policy_bytes).hexdigest(),
    }
    package = BytesIO()
    with ZipFile(package, "w", ZIP_DEFLATED) as z:
        z.writestr("model.joblib", model)
        z.writestr("deployed-policy.json", policy_bytes)
        z.writestr("manifest.json", json.dumps(manifest))
    content = package.getvalue()
    manifest["bundle_sha256"] = hashlib.sha256(content).hexdigest()
    (EXPERIMENT / "runtime-bundle.zip").write_bytes(content)
    write_json(manifest, EXPERIMENT / "runtime-manifest.json")
    # Exercise the unchanged monitor installer in an isolated root, never the project artifacts.
    import prepare_monitor_model as installer

    with TemporaryDirectory() as directory:
        original_root = installer.ROOT
        try:
            installer.ROOT = Path(directory)
            installer.install_bundle(content, manifest)
            loaded = joblib.load(Path(directory) / "artifacts" / manifest["dataset_id"] / "model.joblib")
        finally:
            installer.ROOT = original_root
    return loaded, manifest


def main():
    protocol_path = EXPERIMENT / "protocol.json"
    protocol = json.loads(protocol_path.read_text(encoding="utf-8"))
    if OUTPUT.exists() or (EXPERIMENT / "report.json").exists():
        raise RuntimeError(
            "This experiment already has output; create a new predeclared version, never overwrite/rerun tests for tuning."
        )
    frame, source = load_series("copernicus")
    model_path = ROOT / "artifacts" / source["dataset_id"] / "model.joblib"
    champion_hash = sha(model_path)
    assert champion_hash == protocol["champion_sha256"]
    assert (
        source["sha256"] == protocol["data_sha256"] and str(frame.index.max().date()) == protocol["data_end"]
    )
    original_paths = [
        model_path,
        ROOT / "artifacts/reliability/v1/deployed-policy.json",
        ROOT / "docs/runtime-model-manifest.json",
    ]
    original_hashes = {str(p.relative_to(ROOT)): sha(p) for p in original_paths}
    champion = joblib.load(model_path)
    original_report = json.loads((ROOT / "public/reliability-report.json").read_text(encoding="utf-8"))
    x = features(frame)
    OUTPUT.mkdir(parents=True)
    report = {
        "name": protocol["name"],
        "version": protocol["version"],
        "created_at": datetime.now(UTC).isoformat(),
        "protocol_sha256_lf": hashlib.sha256(protocol_path.read_text(encoding="utf-8").encode()).hexdigest(),
        "protocol_commit": subprocess.check_output(
            ["git", "log", "-1", "--format=%H", "--", "research/candidate-vnext/protocol.json"],
            cwd=ROOT,
            text=True,
        ).strip(),
        "source": source,
        "champion_sha256": champion_hash,
        "versions": {
            k: importlib.metadata.version(k) for k in ("xgboost", "scikit-learn", "numpy", "pandas", "joblib")
        },
        "python": platform.python_version(),
        "folds": [],
        "limitations": [
            protocol["test_limitation"],
            protocol["publication_latency"],
            "One region; no ecological labels, field sensors or causal plant-impact attribution. No statistical significance or field-service improvement claimed.",
        ],
    }
    pooled_candidate = {h: [] for h in (1, 2, 3)}
    pooled_champion = {h: [] for h in (1, 2, 3)}
    champion_folds = []
    for label in [*protocol["test_years"], "frozen"]:
        if label == "frozen":
            split = champion["evaluation"]["split"]
            train_end, tune_end, cal_end, test_end = map(
                pd.Timestamp,
                [split["train_end"], split["tuning_end"], split["calibration_end"], split["test_end"]],
            )
        else:
            train_end, tune_end, cal_end = [pd.Timestamp(f"{label - i}-12-31") for i in (3, 2, 1)]
            test_end = min(pd.Timestamp(f"{label}-12-31"), frame.index.max())
        climate = seasonal_reference(frame.loc[:train_end])
        fold = {
            "label": label,
            "train_end": str(train_end.date()),
            "validation_end": str(tune_end.date()),
            "calibration_end": str(cal_end.date()),
            "test_end": str(test_end.date()),
            "horizons": {},
        }
        candidate_rows, champion_rows, models = {}, {}, {}
        for h in (1, 2, 3):
            masks = block_masks(frame, x, h, train_end, tune_end, cal_end, test_end)
            target = frame.sst_c.shift(-h)
            tr, val = masks["train"], masks["validation"]
            model, selection, board = select_candidate(
                x.loc[tr],
                (target - frame.sst_c).loc[tr],
                x.loc[val],
                target.loc[val],
                frame.sst_c.loc[val],
                protocol,
            )
            blocks = {
                name: prediction_rows(frame, x, model, selection["weight"], h, mask, climate)
                for name, mask in masks.items()
                if name != "train"
            }
            item = evaluate_blocks(blocks)
            item.update({"selected": selection, "validation_candidates": board, "train_n": int(tr.sum())})
            rows = blocks["test"].copy()
            rows["optimized_signal"] = policy_signal(rows, item["warning_policy"])
            rows["radius_c"] = [interval_radius(item["calibration"], d) for d in rows.target_date]
            rows["fold"] = label
            reference = pd.read_csv(
                ROOT / f"artifacts/reliability/v1/{'deployed' if label == 'frozen' else 'rolling'}-{h}d.csv",
                parse_dates=["origin_date", "target_date"],
            )
            if label != "frozen":
                reference = reference.loc[reference.fold == label].reset_index(drop=True)
            assert rows.origin_date.equals(reference.origin_date) and rows.target_date.equals(
                reference.target_date
            )
            for col in (
                "actual_c",
                "persistence_c",
                "seasonal_c",
                "seasonal_naive_c",
                "p90_c",
                "p95_c",
                "origin_p90_c",
            ):
                np.testing.assert_allclose(rows[col], reference[col], atol=1e-12, rtol=0)
            item["evaluation"]["year_season"] = subgroup_scores(rows)
            fold["horizons"][str(h)] = item
            candidate_rows[h], champion_rows[h] = rows, reference
            models[h] = {
                "model": model,
                "weight": selection["weight"],
                "radius": item["calibration"]["global_radius_c"],
            }
            rows.to_csv(OUTPUT / f"{label}-{h}d.csv", index=False)
            if label != "frozen":
                pooled_candidate[h].append(rows)
                pooled_champion[h].append(reference)
        fold["combined_engine"], trace = engine_metrics(candidate_rows)
        champion_engine, _ = engine_metrics(champion_rows)
        trace.to_json(OUTPUT / f"{label}-engine.json", orient="records", date_format="iso")
        if label == "frozen":
            report["frozen"] = {
                "candidate": {
                    "horizons": {h: item["evaluation"] for h, item in fold["horizons"].items()},
                    "combined_engine": fold["combined_engine"],
                },
                "champion": {
                    "horizons": {
                        h: {
                            **original_report["deployed"]["horizons"][h]["evaluation"],
                            "year_season": subgroup_scores(champion_rows[int(h)]),
                        }
                        for h in ("1", "2", "3")
                    },
                    "combined_engine": champion_engine,
                },
                "selection": fold,
            }
            bundle = deepcopy(champion)
            bundle.update(
                {
                    "models": models,
                    "engine": protocol["name"],
                    "experiment_version": protocol["version"],
                    "features": FEATURES,
                    "climate": climate[["reference_c", "p90_c"]],
                    "evaluation": {
                        **champion["evaluation"],
                        "created_at": report["created_at"],
                        "model_version": protocol["version"],
                        "horizons": {
                            h: {
                                **champion["evaluation"]["horizons"][h],
                                **item["evaluation"],
                                "coverage_80": item["evaluation"]["interval"]["coverage"],
                                "warm_day_f1": item["evaluation"]["daily"]["old_model_p90"]["f1"],
                            }
                            for h, item in fold["horizons"].items()
                        },
                    },
                }
            )
            policy = {
                "version": "reliability-v1",
                "dataset_id": source["dataset_id"],
                "calibration_end": bundle["calibration_end"],
                "split": split,
                "p95_c": {str(k): float(v) for k, v in climate.p95_c.items()},
                "horizons": fold["horizons"],
            }
            loaded, runtime_manifest = build_runtime(bundle, policy)
            origin = frame.index.max()
            before = forecast(frame, bundle, origin)
            after = forecast(frame, loaded, origin)
            assert before == after
            assert len(calibrated_forecasts(frame, loaded, origin, policy)) == 3
            report["runtime"] = {
                "manifest": runtime_manifest,
                "temporary_install_and_forecast_match": True,
                "zip_bytes": (EXPERIMENT / "runtime-bundle.zip").stat().st_size,
            }
        else:
            report["folds"].append(fold)
            champion_folds.append(
                {
                    "horizons": original_report["folds"][label - 2019]["horizons"],
                    "combined_engine": champion_engine,
                }
            )
        print(f"Candidate {label}: complete; selection validation-only", flush=True)
    report["rolling"] = {
        "candidate": rolling_pool(report["folds"], pooled_candidate),
        "champion": rolling_pool(champion_folds, pooled_champion),
    }
    report["gates"] = {
        scope: promotion_gates(report[scope]["candidate"], report[scope]["champion"], protocol["gates"])
        for scope in ("rolling", "frozen")
    }
    report["recommendation"] = (
        "proposal_only_requires_owner_review"
        if all(v["passed"] for v in report["gates"].values())
        else "retain_champion_do_not_promote"
    )
    assert all(sha(ROOT / name) == value for name, value in original_hashes.items())
    report["original_hashes_preserved"] = original_hashes
    report["code_sha256"] = {
        str(p.relative_to(ROOT)): sha(p)
        for p in [Path(__file__).resolve(), ROOT / "backend/thermatwin/challenger.py"]
    }
    report["prediction_sha256"] = {p.name: sha(p) for p in sorted(OUTPUT.glob("*.csv"))}
    write_json(report, EXPERIMENT / "report.json")
    print(json.dumps({"recommendation": report["recommendation"], "gates": report["gates"]}, indent=2))


if __name__ == "__main__":
    main()
