import hashlib
import json

import joblib
import pandas as pd
import pytest

from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.model import forecast
from thermatwin.science import risk


def test_preserved_documents_models_and_observations():
    manifest = json.loads((ROOT / "docs/preservation-manifest.json").read_text(encoding="utf-8"))
    for name, expected in manifest.items():
        path = ROOT / name
        if not path.exists() and not name.endswith(".pdf"):
            continue  # Models and raw observations are intentionally not in a clean checkout.
        assert hashlib.file_digest(path.open("rb"), "sha256").hexdigest() == expected, name


def test_invalid_inference_date_is_rejected():
    path = ROOT / "artifacts/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2/model.joblib"
    if not path.exists():
        pytest.skip("Real model artifact is not available")
    bundle = joblib.load(path)
    frame, _ = load_series("copernicus")
    for day in (frame.index.max() + pd.Timedelta(days=1), pd.Timestamp("2024-06-07T12:00:00")):
        with pytest.raises(ValueError, match="günlük gözlem"):
            forecast(frame, bundle, day)


def test_new_replays_have_real_comparisons_and_correct_risk():
    catalog = json.loads((ROOT / "public/replay-events.json").read_text(encoding="utf-8"))
    assert len(catalog["events"]) == 3
    for event in catalog["events"]:
        observation = event["observation"]
        assert observation["mhw"] and observation["duration_days"] >= 5
        assert (
            risk(observation["sst_c"], observation["reference_c"], observation["p90_c"])
            == observation["risk"]
        )
        assert event["comparison"]["date"] < event["origin_date"]
        assert event["comparison"]["date"][5:7] == event["origin_date"][5:7]
        assert event["comparison"]["anomaly_c"] <= 0.1
