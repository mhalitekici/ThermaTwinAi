"""Publish existing held-out predictions, without fitting or changing any model."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = [
    "origin_date", "target_date", "actual_c", "model_c", "persistence_c",
    "seasonal_c", "seasonal_naive_c", "p90_c", "p95_c", "radius_c", "fold",
    "optimized_signal",
]


def export(root=ROOT):
    report_path = root / "public/reliability-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    result = {
        "version": "performance-traces-v1",
        "report_version": report["version"],
        "evaluated_at": report["created_at"],
        "report_sha256": hashlib.sha256(report_path.read_text(encoding="utf-8").encode("utf-8")).hexdigest(),
        "report_hash_encoding": "UTF-8 with LF line endings",
        "model_sha256": report["model_sha256"],
        "columns": COLUMNS,
        "csv_sha256": {},
        "folds": [
            {k: f[k] for k in ("test_year", "train_end", "validation_end", "calibration_end", "test_end")}
            for f in report["folds"]
        ],
        "horizons": {},
    }
    for h in (1, 2, 3):
        path = root / f"artifacts/reliability/v1/rolling-{h}d.csv"
        rows = pd.read_csv(path)
        validate(rows, report, h)
        result["csv_sha256"][str(h)] = hashlib.sha256(path.read_bytes()).hexdigest()
        result["horizons"][str(h)] = rows[COLUMNS].values.tolist()
    return result


def validate(rows, report, h):
    dates = pd.to_datetime(rows.target_date)
    origins = pd.to_datetime(rows.origin_date)
    assert dates.is_unique and dates.is_monotonic_increasing, "Duplicate/unsorted target"
    assert ((dates - origins).dt.days == h).all(), "Invalid horizon"
    assert np.isfinite(rows[COLUMNS[2:10]].to_numpy()).all(), "Non-finite trace"
    assert (rows.radius_c >= 0).all(), "Invalid radius"
    assert rows.optimized_signal.isin([True, False]).all(), "Invalid signal"
    assert set(rows.fold) == {f["test_year"] for f in report["folds"]}, "Missing/extra fold"
    for fold in report["folds"]:
        selected = rows.loc[rows.fold == fold["test_year"]]
        assert fold["train_end"] < fold["validation_end"] < fold["calibration_end"] < fold["test_end"]
        assert (selected.origin_date > fold["calibration_end"]).all(), "Calibration leakage"
        assert (selected.target_date <= fold["test_end"]).all(), "Target boundary leakage"
        assert (pd.to_datetime(selected.target_date).dt.year == fold["test_year"]).all()
    expected = report["rolling_pooled"][str(h)]
    assert len(rows) == expected["n"], "Sample mismatch"
    for key in ("model", "persistence", "seasonal", "seasonal_naive"):
        errors = rows[f"{key}_c"] - rows.actual_c
        assert abs(errors.abs().mean() - expected[key]["mae_c"]) < 1e-10, "MAE mismatch"
        assert abs(np.sqrt((errors**2).mean()) - expected[key]["rmse_c"]) < 1e-10, "RMSE mismatch"
    assert abs(((rows.model_c-rows.actual_c).abs() <= rows.radius_c).mean() - expected["interval"]["coverage"]) < 1e-10


if __name__ == "__main__":
    result = export()
    output = ROOT / "public/performance-traces-v1.json"
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"Validated/exported {sum(map(len, result['horizons'].values()))} existing held-out predictions; no models fitted.")
