"""Calendar-aware features, a frozen seasonal reference, and screening anomalies."""

import numpy as np
import pandas as pd

FEATURES = [
    "sst_c",
    "lag1",
    "lag2",
    "lag3",
    "lag7",
    "lag14",
    "mean3",
    "mean7",
    "mean14",
    "std7",
    "trend3",
    "trend7",
    "sin_day",
    "cos_day",
]


def seasonal_day(index: pd.DatetimeIndex) -> np.ndarray:
    # Map all years into a leap-year calendar so March never shifts between years.
    return pd.to_datetime("2000-" + index.strftime("%m-%d")).dayofyear.to_numpy()


def features(frame: pd.DataFrame) -> pd.DataFrame:
    s = frame.sst_c
    out = pd.DataFrame({"sst_c": s})
    for lag in (1, 2, 3, 7, 14):
        out[f"lag{lag}"] = s.shift(lag)
    for days in (3, 7, 14):
        out[f"mean{days}"] = s.rolling(days, min_periods=days).mean()
    out["std7"] = s.rolling(7).std()
    out["trend3"] = s - s.shift(3)
    out["trend7"] = s - s.shift(7)
    angle = 2 * np.pi * seasonal_day(out.index) / 366
    out["sin_day"], out["cos_day"] = np.sin(angle), np.cos(angle)
    return out[FEATURES]


def climatology(reference: pd.DataFrame) -> pd.DataFrame:
    if reference.index.year.nunique() < 5:
        raise ValueError("Mevsimsel referans için en az 5 yıl gereklidir.")
    doy = seasonal_day(reference.index)
    rows = []
    for day in range(1, 367):
        distance = np.abs(doy - day)
        values = reference.loc[np.minimum(distance, 366 - distance) <= 5, "sst_c"].dropna()
        if len(values) < 40:
            raise ValueError(f"Mevsimsel referans yetersiz: gün {day}.")
        rows.append({"day": day, "reference_c": float(values.mean()), "p90_c": float(values.quantile(0.9))})
    out = pd.DataFrame(rows).set_index("day")
    # 31-day circular smoothing, performed solely on the reference years.
    for col in ("reference_c", "p90_c"):
        values = out[col].to_numpy()
        out[col] = np.convolve(np.r_[values[-15:], values, values[:15]], np.ones(31) / 31, mode="valid")
    return out


def annotate(frame: pd.DataFrame, climate: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    lookup = climate.loc[seasonal_day(out.index)]
    out["reference_c"] = lookup.reference_c.to_numpy()
    out["p90_c"] = lookup.p90_c.to_numpy()
    out["anomaly_c"] = out.sst_c - out.reference_c
    above = out.sst_c > out.p90_c
    group = (~above).cumsum()
    out["duration_days"] = above.astype(int).groupby(group).cumsum()
    # Causal: do not retrospectively label the first four days as confirmed MHW.
    out["mhw"] = out.duration_days >= 5
    out["risk"] = [risk(t, r, p) for t, r, p in zip(out.sst_c, out.reference_c, out.p90_c)]
    return out


def risk(sst: float, reference: float, p90: float) -> str:
    if not np.isfinite(sst):
        return "unknown"
    if sst <= p90:
        return "normal"
    return "high" if sst - reference >= 2 * max(p90 - reference, 0.1) else "watch"
