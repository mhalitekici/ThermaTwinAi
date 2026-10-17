"""Scalar warning decision, shared by HTTP serving and the scientific pipeline."""

from math import isfinite, nan


def decide(
    observation: dict, forecasts: list[dict], origin_date: str, *, stale=False, sufficient=True
) -> dict:
    sufficient = (
        sufficient
        and all(isfinite(observation.get(k, nan)) for k in ("sst_c", "p90_c"))
        and len(forecasts) == 3
    )
    if stale or not sufficient:
        return {
            "state": "insufficient_data",
            "reason": "Veri eksik veya üç günden eski; yeni uyarı üretilmedi.",
            "origin_date": origin_date,
            "horizon_hours": None,
            "uncertainty": None,
        }
    if observation["sst_c"] > observation["p90_c"]:
        return {
            "state": "observed_anomaly",
            "reason": "Gözlenen sıcaklık, eğitim döneminden hesaplanan mevsimsel P90 eşiğini aşıyor.",
            "origin_date": origin_date,
            "horizon_hours": 0,
            "uncertainty": "Uydu bölgesel ortalaması; gözlem hatası bu aralıkla ölçülmez.",
        }
    triggered = next((f for f in forecasts if f.get("warning", {}).get("triggered")), None)
    if triggered:
        return {
            "state": "forecast_risk",
            "reason": triggered["warning"]["reason"],
            "origin_date": origin_date,
            "horizon_hours": triggered["horizon_days"] * 24,
            "uncertainty": {
                "lower_c": triggered["lower_c"],
                "upper_c": triggered["upper_c"],
                "nominal_coverage": 0.8,
                "guaranteed": False,
            },
        }
    return {
        "state": "normal",
        "reason": "Gözlenen P90 aşımı veya validation ile seçilmiş ileriye dönük uyarı sinyali yok.",
        "origin_date": origin_date,
        "horizon_hours": None,
        "uncertainty": None,
    }
