import numpy as np
import pandas as pd
import pytest
import xarray as xr

from thermatwin.ingest import clean_daily, extract_netcdf
from thermatwin.science import annotate, climatology, features, seasonal_day


def test_netcdf_kelvin_land_mask_and_scaled_fill(tmp_path):
    values = np.array([[[300.0, 350.0], [298.0, -999.0]]])
    ds = xr.Dataset(
        {
            "analysed_sst": (("time", "lat", "lon"), values, {"units": "K"}),
            "mask": (("lat", "lon"), [[1, 2], [1, 1]]),
        },
        coords={"time": pd.date_range("2024-01-01", periods=1), "lat": [36.0, 36.1], "lon": [33.5, 33.6]},
    )
    path = tmp_path / "synthetic_test_only.nc"
    ds.to_netcdf(path)
    frame = extract_netcdf(path)
    assert frame.valid_cells.iloc[0] == 2
    assert 25.8 < frame.sst_c.iloc[0] < 25.9
    ds.analysed_sst.attrs["units"] = "unknown"
    ds.to_netcdf(path)
    with pytest.raises(ValueError, match="birimi"):
        extract_netcdf(path)


def test_calendar_gaps_not_compressed_or_interpolated():
    frame = clean_daily(pd.DataFrame({"date": ["2024-01-01", "2024-01-03"], "sst_c": [20, 21]}))
    assert len(frame) == 3
    assert np.isnan(frame.sst_c.iloc[1])
    assert np.isnan(features(frame).lag1.iloc[2])


def test_features_do_not_see_future_and_leap_calendar_stable():
    index = pd.date_range("2024-01-01", periods=40)
    frame = pd.DataFrame({"sst_c": np.linspace(10, 20, 40)}, index=index)
    original = features(frame)
    frame.loc[index[25] :, "sst_c"] = 35
    pd.testing.assert_frame_equal(original.iloc[:25], features(frame).iloc[:25])
    assert (
        seasonal_day(pd.DatetimeIndex(["2023-03-01"]))[0] == seasonal_day(pd.DatetimeIndex(["2024-03-01"]))[0]
    )


def test_heatwave_only_confirmed_after_five_days_and_gap_resets():
    climate = pd.DataFrame({"reference_c": [20.0] * 366, "p90_c": [22.0] * 366}, index=range(1, 367))
    frame = pd.DataFrame(
        {"sst_c": [23.0] * 5 + [np.nan] + [23.0] * 4}, index=pd.date_range("2024-01-01", periods=10)
    )
    a = annotate(frame, climate)
    assert a.mhw.tolist() == [False] * 4 + [True] + [False] * 5
    assert a.duration_days.iloc[-1] == 4
    assert a.risk.iloc[5] == "unknown"


def test_climatology_requires_sufficient_years():
    with pytest.raises(ValueError, match="5 yıl"):
        climatology(pd.DataFrame({"sst_c": [20.0] * 365}, index=pd.date_range("2024-01-01", periods=365)))
