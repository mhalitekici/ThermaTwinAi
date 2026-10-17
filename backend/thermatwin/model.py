import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

from .config import ROOT
from .science import FEATURES, climatology, features, seasonal_day


def scores(actual, predicted) -> dict:
    return {
        "mae_c": float(mean_absolute_error(actual, predicted)),
        "rmse_c": float(np.sqrt(mean_squared_error(actual, predicted))),
        "bias_c": float(np.mean(np.asarray(predicted) - np.asarray(actual))),
    }


def estimator() -> XGBRegressor:
    """One configuration shared by the preserved pipeline and rolling refits."""
    return XGBRegressor(
        n_estimators=350,
        max_depth=3,
        learning_rate=0.035,
        subsample=0.85,
        colsample_bytree=0.9,
        reg_lambda=8,
        objective="reg:squarederror",
        n_jobs=2,
        random_state=42,
    )


def train(frame: pd.DataFrame, source: dict, output: Path | None = None) -> dict:
    if len(frame) < 365 * 8:
        raise ValueError("Zamansal eğitim için en az 8 yıllık günlük seri gerekli.")
    output = output or ROOT / "artifacts" / source["dataset_id"]
    output.mkdir(parents=True, exist_ok=True)
    n = len(frame)
    train_end, tune_end, cal_end = (frame.index[int(n * p)] for p in (0.65, 0.75, 0.85))
    x = features(frame)
    climate = climatology(frame.loc[:train_end])
    bundle = {
        "source": source,
        "features": FEATURES,
        "climate": climate,
        "models": {},
        "train_end": train_end.isoformat(),
        "calibration_end": cal_end.isoformat(),
    }
    report = {
        "source": source,
        "created_at": datetime.now(UTC).isoformat(),
        "split": {
            "train_end": train_end.date().isoformat(),
            "tuning_end": tune_end.date().isoformat(),
            "calibration_end": cal_end.date().isoformat(),
            "test_start": (cal_end + pd.Timedelta(days=1)).date().isoformat(),
            "test_end": frame.index.max().date().isoformat(),
        },
        "horizons": {},
        "reference": f"{frame.index.min().date()}–{train_end.date()}; ±5 gün, 31 gün dairesel yumuşatma; kısa MVP referansı, standart 30 yıl değil",
        "limitations": [
            "Günlük bölgesel SST; gerçek zamanlı sensör veya tesis etkisi değildir.",
            "Ampirik %80 tahmin aralığı; mevsimsel dağılım kaymasında kapsama garantisi yok.",
            "Eşik sınıflaması klimatolojiye göre sıcak gün taramasıdır; biyolojik zarar etiketi değildir.",
        ],
    }
    for horizon in (1, 2, 3):
        target = frame.sst_c.shift(-horizon)
        target_dates = frame.index + pd.Timedelta(days=horizon)
        valid = x.notna().all(axis=1) & target.notna()
        # Target dates must stay within their split; no +3-day boundary leakage.
        tr = valid & (target_dates <= train_end)
        tune = valid & (frame.index > train_end) & (target_dates <= tune_end)
        cal = valid & (frame.index > tune_end) & (target_dates <= cal_end)
        test = valid & (frame.index > cal_end)
        if min(map(np.sum, (tr, tune, cal, test))) < 50:
            raise ValueError("Bir zaman bloğunda yeterli geçerli örnek yok.")
        model = estimator()
        model.fit(x.loc[tr], target.loc[tr] - frame.sst_c.loc[tr])
        tune_delta = model.predict(x.loc[tune])
        # Validation can select persistence; never claim XGBoost wins unless it does.
        weight = min(
            (0, 0.25, 0.5, 0.75, 1),
            key=lambda w: mean_absolute_error(target.loc[tune], frame.sst_c.loc[tune] + w * tune_delta),
        )
        calibration_pred = frame.sst_c.loc[cal] + weight * model.predict(x.loc[cal])
        errors = np.abs(target.loc[cal] - calibration_pred)
        q = min(1.0, np.ceil((len(errors) + 1) * 0.8) / len(errors))
        radius = float(np.quantile(errors, q, method="higher"))
        predicted = frame.sst_c.loc[test] + weight * model.predict(x.loc[test])
        actual = target.loc[test]
        base = frame.sst_c.loc[test]
        threshold = climate.loc[seasonal_day(pd.DatetimeIndex(target_dates[test])), "p90_c"].to_numpy()
        metric = {
            "xgboost_weight": weight,
            "selected_method": "persistence" if weight == 0 else "XGBoost delta + persistence",
            "model": scores(actual, predicted),
            "persistence": scores(actual, base),
            "interval_radius_c": radius,
            "coverage_80": float(np.mean(np.abs(actual - predicted) <= radius)),
            "warm_day_f1": float(f1_score(actual > threshold, predicted > threshold, zero_division=0)),
            "warm_test_days": int(np.sum(actual > threshold)),
            "train_n": int(tr.sum()),
            "tuning_n": int(tune.sum()),
            "calibration_n": int(cal.sum()),
            "test_n": int(test.sum()),
        }
        warm = actual > threshold
        metric["warm_days_mae_c"] = (
            float(mean_absolute_error(actual[warm], predicted[warm])) if warm.any() else None
        )
        report["horizons"][str(horizon)] = metric
        bundle["models"][horizon] = {"model": model, "weight": weight, "radius": radius}
        pd.DataFrame(
            {
                "origin_date": frame.index[test],
                "target_date": target_dates[test],
                "actual_c": actual.to_numpy(),
                "predicted_c": predicted.to_numpy(),
                "persistence_c": base.to_numpy(),
                "p90_c": threshold,
            }
        ).to_csv(output / f"hindcast_{horizon}d.csv", index=False)
        fig, ax = plt.subplots(figsize=(11, 3))
        ax.plot(actual.index, actual, label="Observed", linewidth=0.7)
        ax.plot(predicted.index, predicted, label=f"+{horizon}d", linewidth=0.7, alpha=0.8)
        ax.set(ylabel="SST (°C)", title=f"Held-out hindcast, +{horizon} day(s)")
        ax.legend()
        fig.tight_layout()
        fig.savefig(output / f"hindcast_{horizon}d.png", dpi=140)
        plt.close(fig)
    bundle["evaluation"] = report
    joblib.dump(bundle, output / "model.joblib")
    (output / "evaluation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return bundle


def forecast(frame: pd.DataFrame, bundle: dict, origin: pd.Timestamp | None = None) -> list[dict]:
    origin = pd.Timestamp(origin) if origin is not None else frame.sst_c.last_valid_index()
    if origin <= pd.Timestamp(bundle["calibration_end"]):
        raise ValueError("Replay gözlem tarihi kalibrasyon döneminden sonra olmalı.")
    if origin not in frame.index or origin != origin.normalize():
        raise ValueError("Tahmin başlangıcı mevcut bir günlük gözlem tarihi olmalı.")
    past = frame.loc[:origin]
    x = features(past).tail(1)
    if x.empty or x.isna().any(axis=None):
        raise ValueError("Son 15 takvim gününde eksik gözlem var; tahmin üretilmedi.")
    rows = []
    for h, m in bundle["models"].items():
        target = origin + pd.Timedelta(days=h)
        sst = float(x.sst_c.iloc[0] + m["weight"] * m["model"].predict(x)[0])
        ref = bundle["climate"].loc[seasonal_day(pd.DatetimeIndex([target]))[0]]
        rows.append(
            {
                "horizon_days": h,
                "origin_date": origin.date().isoformat(),
                "target_date": target.date().isoformat(),
                "sst_c": round(sst, 3),
                "lower_c": round(sst - m["radius"], 3),
                "upper_c": round(sst + m["radius"], 3),
                "reference_c": float(ref.reference_c),
                "p90_c": float(ref.p90_c),
                "method": "persistence" if m["weight"] == 0 else "XGBoost + persistence",
            }
        )
    return rows
