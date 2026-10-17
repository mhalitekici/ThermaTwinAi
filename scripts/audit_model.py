"""Audit saved predictions without refitting or replacing any model or observation."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score

from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.model import forecast, scores
from thermatwin.pipeline import snapshot, write_snapshot
from thermatwin.science import annotate, climatology, features


def audit():
    frame, source = load_series("copernicus")
    folder = ROOT / "artifacts" / source["dataset_id"]
    model_path = folder / "model.joblib"
    bundle = joblib.load(model_path)
    original_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
    x = features(frame)
    climate = climatology(frame.loc[: pd.Timestamp(bundle["train_end"])])
    np.testing.assert_allclose(climate, bundle["climate"], atol=1e-12)
    report = {
        "audited_at": datetime.now(timezone.utc).isoformat(),
        "model_sha256": original_hash,
        "dataset_id": source["dataset_id"],
        "source": source,
        "split": bundle["evaluation"]["split"],
        "horizons": {},
        "checks": {},
        "limitations": [
            "Tek bölgesel ortalama seri; başka bir kıyıya genellenebilirlik ölçülmedi.",
            "Sabit ve kısa referans, ısınan iklimde eşik aşımı sıklığını artırabilir.",
            "Sıcak gün F1, santral etkisi veya ekolojik zarar başarısı değildir.",
            "Aralık hedefi %80; gerçek kapsama +2/+3 günde bunun altında.",
            "Rolling-origin çapraz doğrulama henüz yok; ayrı sabit test bloğu kullanıldı.",
        ],
    }
    for h in (1, 2, 3):
        csv = pd.read_csv(folder / f"hindcast_{h}d.csv")
        origins, targets = pd.DatetimeIndex(csv.origin_date), pd.DatetimeIndex(csv.target_date)
        assert (origins > pd.Timestamp(bundle["calibration_end"])).all()
        assert ((targets - origins).days == h).all()
        np.testing.assert_allclose(csv.actual_c, frame.loc[targets, "sst_c"], atol=1e-12)
        np.testing.assert_allclose(csv.persistence_c, frame.loc[origins, "sst_c"], atol=1e-12)
        model = bundle["models"][h]
        pred = frame.loc[origins, "sst_c"].to_numpy() + model["weight"] * model["model"].predict(
            x.loc[origins]
        )
        np.testing.assert_allclose(pred, csv.predicted_c, atol=1e-10)
        metric = scores(csv.actual_c, csv.predicted_c)
        saved = bundle["evaluation"]["horizons"][str(h)]
        for name, value in metric.items():
            assert abs(value - saved["model"][name]) < 1e-10
        radius = model["radius"]
        coverage = float(np.mean(np.abs(csv.actual_c - csv.predicted_c) <= radius))
        assert abs(coverage - saved["coverage_80"]) < 1e-12
        year_metrics = {
            str(year): scores(group.actual_c, group.predicted_c) for year, group in csv.groupby(targets.year)
        }
        worst = csv.assign(error=np.abs(csv.actual_c - csv.predicted_c)).nlargest(3, "error")
        report["horizons"][str(h)] = {
            **saved,
            "recomputed": metric,
            "mae_improvement_pct": 100 * (1 - metric["mae_c"] / saved["persistence"]["mae_c"]),
            "persistence_warm_f1": float(f1_score(csv.actual_c > csv.p90_c, csv.persistence_c > csv.p90_c)),
            "year_metrics": year_metrics,
            "worst_errors": worst.to_dict("records"),
        }
    for name in ("live", "replay"):
        snap = json.loads((ROOT / f"public/{name}.json").read_text(encoding="utf-8"))
        predicted = forecast(frame, bundle, pd.Timestamp(snap["origin_date"]))
        for a, b in zip(predicted, snap["forecasts"]):
            for field in ("sst_c", "lower_c", "upper_c", "reference_c", "p90_c"):
                assert abs(a[field] - b[field]) < 1e-9, (name, field)
        changed = frame.copy()
        changed.loc[changed.index > pd.Timestamp(snap["origin_date"]), "sst_c"] = -1
        assert forecast(changed, bundle, pd.Timestamp(snap["origin_date"])) == predicted
    raw = (
        ROOT
        / "data/raw/copernicus"
        / f"public_{source['dataset_version']}_{source['first_observation']}_{source['last_observation']}.nc"
    )
    assert hashlib.file_digest(raw.open("rb"), "sha256").hexdigest() == source["sha256"]
    report["checks"] = {
        "raw_hash": True,
        "chronological_split": True,
        "saved_hindcasts": True,
        "frozen_climatology": True,
        "future_independence": True,
        "dashboard_model_match": True,
        "model_preserved": hashlib.sha256(model_path.read_bytes()).hexdigest() == original_hash,
        "valid_days": int(frame.sst_c.notna().sum()),
        "missing_days": int(frame.sst_c.isna().sum()),
        "last_observation": frame.index.max().date().isoformat(),
    }
    if "--catalogue" in sys.argv:
        import copernicusmarine

        catalogue = copernicusmarine.describe(dataset_id=source["dataset_id"], disable_progress_bar=True)
        dataset = next(
            d for p in catalogue.products for d in p.datasets if d.dataset_id == source["dataset_id"]
        )
        coord = next(
            c
            for v in dataset.versions
            for p in v.parts
            for s in p.services
            if s.service_short_name == "timeseries"
            for var in s.variables
            if var.short_name == "analysed_sst"
            for c in var.coordinates
            if c.coordinate_id == "time"
        )
        report["checks"]["catalogue_last_observation"] = (
            pd.to_datetime(coord.maximum_value, unit="ms").date().isoformat()
        )
    write_snapshot(report, ROOT / "docs/model-audit.json")
    write_snapshot(report, ROOT / "public/model-audit.json")

    # Additional real replay scenarios, leaving original replay.json untouched.
    a = annotate(frame, bundle["climate"])
    candidates = a.loc[(a.index > pd.Timestamp(bundle["calibration_end"])) & a.mhw].sort_values(
        "anomaly_c", ascending=False
    )
    selected = []
    for day in candidates.index:
        if all(abs((day - other).days) > 45 for other in selected):
            selected.append(day)
        if len(selected) == 3:
            break
    events = []
    for day in sorted(selected):
        snap = snapshot(frame, bundle, "replay", day.date().isoformat())
        pool = a.loc[
            (a.index < day - pd.Timedelta(days=14)) & (a.index.month == day.month) & (a.risk == "normal")
        ].copy()
        normal = pool.anomaly_c.abs().idxmin()
        row = pool.loc[normal]
        snap["comparison"] = {
            "date": normal.date().isoformat(),
            "sst_c": float(row.sst_c),
            "reference_c": float(row.reference_c),
            "anomaly_c": float(row.anomaly_c),
            "note": "Aynı takvim ayından, olaydan önce gözlenmiş ve mevsimsel referansa en yakın normal gün; nedensel karşılaştırma değil.",
        }
        events.append(snap)
    write_snapshot({"events": events}, ROOT / "public/replay-events.json")
    print(
        json.dumps(
            {"checks": report["checks"], "replay_dates": [s["origin_date"] for s in events]},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    audit()
