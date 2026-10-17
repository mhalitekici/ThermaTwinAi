"""Only runs against real downloaded artifacts; never reports synthetic ML scores."""

import json

import joblib
import pandas as pd
import pytest

from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.model import forecast
from thermatwin.pipeline import select_replay, snapshot


@pytest.mark.parametrize(
    "provider,dataset_id",
    [("noaa", "ncdcOisst21Agg_LonPM180"), ("copernicus", "SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2")],
)
def test_real_hindcast_boundaries_baseline_and_replay(provider, dataset_id):
    folder = ROOT / "artifacts" / dataset_id
    if not (folder / "model.joblib").exists():
        pytest.skip("Real NOAA artifact not downloaded; use CLI download/train/replay first")
    bundle = joblib.load(folder / "model.joblib")
    frame, source = load_series(provider)
    replay = json.loads((ROOT / "public/replay.json").read_text(encoding="utf-8"))
    assert replay["mode"] == "replay"
    assert replay["observation"]["mhw"]
    assert pd.Timestamp(replay["origin_date"]) > pd.Timestamp(bundle["calibration_end"])
    origin = select_replay(frame, bundle)
    first = snapshot(frame, bundle, "replay", origin)
    changed = frame.copy()
    changed.loc[changed.index > pd.Timestamp(origin), "sst_c"] = 1.0
    second = snapshot(changed, bundle, "replay", origin)
    assert first["forecasts"] == second["forecasts"]
    with pytest.raises(ValueError, match="kalibrasyon"):
        forecast(frame, bundle, pd.Timestamp(bundle["train_end"]))
    for h in (1, 2, 3):
        csv = pd.read_csv(folder / f"hindcast_{h}d.csv")
        assert (pd.to_datetime(csv.target_date) - pd.to_datetime(csv.origin_date)).dt.days.eq(h).all()
        assert (pd.to_datetime(csv.origin_date) > pd.Timestamp(bundle["calibration_end"])).all()
        assert len(csv) == bundle["evaluation"]["horizons"][str(h)]["test_n"]
    assert source["valid_days"] > 5000
