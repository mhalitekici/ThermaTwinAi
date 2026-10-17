"""Public trace provenance can be checked in clean CI without local model weights."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("export_performance_traces", ROOT / "scripts/export_performance_traces.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def test_public_traces_reproduce_report_and_purge_temporal_boundaries():
    public = json.loads((ROOT / "public/performance-traces-v1.json").read_text(encoding="utf-8"))
    report_bytes = (ROOT / "public/reliability-report.json").read_text(encoding="utf-8").encode("utf-8")
    report = json.loads(report_bytes)
    assert public["report_sha256"] == hashlib.sha256(report_bytes).hexdigest()
    assert public["model_sha256"] == report["model_sha256"]
    for h in (1, 2, 3):
        rows = pd.DataFrame(public["horizons"][str(h)], columns=public["columns"])
        exporter.validate(rows, report, h)
        path = ROOT / f"artifacts/reliability/v1/rolling-{h}d.csv"
        if path.exists():
            assert hashlib.sha256(path.read_bytes()).hexdigest() == public["csv_sha256"][str(h)]
            assert rows.target_date.tolist() == pd.read_csv(path).target_date.tolist()


@pytest.mark.parametrize("column,value", [("model_c", 80), ("origin_date", "2010-01-01"), ("radius_c", -1)])
def test_export_rejects_corrupted_trace(column, value):
    public = json.loads((ROOT / "public/performance-traces-v1.json").read_text(encoding="utf-8"))
    report = json.loads((ROOT / "public/reliability-report.json").read_text(encoding="utf-8"))
    rows = pd.DataFrame(public["horizons"]["1"], columns=public["columns"])
    rows.loc[0, column] = value
    with pytest.raises(AssertionError):
        exporter.validate(rows, report, 1)
