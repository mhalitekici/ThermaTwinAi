"""Reproducible Copernicus rolling-origin / frozen-model warning evaluation.

No downloads, emails, external services, or replacement of existing artifacts.
Run: .venv/Scripts/python.exe -X utf8 scripts/evaluate_reliability.py
"""

import hashlib
import json
import sys
from datetime import UTC, datetime

import joblib
import numpy as np
import pandas as pd
from thermatwin.config import ROOT
from thermatwin.ingest import load_series
from thermatwin.model import estimator, scores
from thermatwin.pipeline import write_snapshot
from thermatwin.reliability import (
    POLICY_VERSION,
    block_masks,
    calibrate,
    interval_radius,
    policy_signal,
    reference_diagnostics,
    seasonal_reference,
    select_policy,
    summarize,
)
from thermatwin.science import features, seasonal_day

OUTPUT = ROOT / "artifacts/reliability/v1"


def prediction_rows(frame, x, model, weight, horizon, mask, climate):
    origins = frame.index[mask]
    targets = origins + pd.DateOffset(days=horizon)
    lookup = climate.loc[seasonal_day(targets)]
    origin_lookup = climate.loc[seasonal_day(origins)]
    previous_year = targets - pd.DateOffset(years=1)  # Feb 29 -> Feb 28, always known at origin.
    return (
        pd.DataFrame(
            {
                "origin_date": origins,
                "target_date": targets,
                "actual_c": frame.reindex(targets).sst_c.to_numpy(),
                "model_c": frame.sst_c.loc[origins].to_numpy() + weight * model.predict(x.loc[origins]),
                "persistence_c": frame.sst_c.loc[origins].to_numpy(),
                "seasonal_c": lookup.reference_c.to_numpy(),
                "seasonal_naive_c": frame.reindex(previous_year).sst_c.to_numpy(),
                "seasonal_drift_c": frame.sst_c.loc[origins].to_numpy()
                + lookup.reference_c.to_numpy()
                - origin_lookup.reference_c.to_numpy(),
                "p90_c": lookup.p90_c.to_numpy(),
                "p95_c": lookup.p95_c.to_numpy(),
                "origin_p90_c": origin_lookup.p90_c.to_numpy(),
            }
        )
        .dropna()
        .reset_index(drop=True)
    )


def evaluate_blocks(blocks):
    policy = select_policy(blocks["validation"])
    calibration = calibrate(blocks["calibration"])
    assert pd.Timestamp(policy["validation_target_end"]) < blocks["calibration"].origin_date.min()
    assert pd.Timestamp(calibration["calibration_target_end"]) < blocks["test"].origin_date.min()
    result = summarize(blocks["test"], policy, calibration)
    return {"warning_policy": policy, "calibration": calibration, "evaluation": result}


def pooled_summary(evaluations, rows):
    # Do not average fold percentages; pool rows / confusion counts.
    result = {
        "n": len(rows),
        "model": scores(rows.actual_c, rows.model_c),
        "persistence": scores(rows.actual_c, rows.persistence_c),
        "seasonal": scores(rows.actual_c, rows.seasonal_c),
        "seasonal_naive": scores(rows.actual_c, rows.seasonal_naive_c),
        "daily": {},
        "events": {},
    }
    result["mae_improvement_pct"] = 100 * (1 - result["model"]["mae_c"] / result["persistence"]["mae_c"])
    for name in ("optimized", "old_model_p90", "persistence_p90"):
        values = [e["daily"][name] for e in evaluations]
        counts = {k: sum(m[k] for m in values) for k in ("tp", "fp", "fn", "tn", "n")}
        tp, fp, fn = (counts[k] for k in ("tp", "fp", "fn"))
        result["daily"][name] = {
            **counts,
            "precision": tp / (tp + fp) if tp + fp else 0.0,
            "recall": tp / (tp + fn) if tp + fn else 0.0,
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0,
        }
    for name in ("optimized", "persistence"):
        counts = {
            k: sum(e["events"][name][k] for e in evaluations)
            for k in (
                "events",
                "detected_events",
                "missed_events",
                "early_events",
                "raw_positive_days",
                "notifications",
                "suppressed_repeats",
                "false_notifications",
            )
        }
        precision = counts["detected_events"] / max(
            1, counts["detected_events"] + counts["false_notifications"]
        )
        recall = counts["detected_events"] / max(1, counts["events"])
        result["events"][name] = {
            **counts,
            "precision": precision,
            "recall": recall,
            "f1": 2 * precision * recall / max(1e-12, precision + recall),
            "early_recall": counts["early_events"] / max(1, counts["events"]),
        }
    result["interval"] = {
        "nominal": 0.8,
        "coverage": float(np.mean(np.abs(rows.actual_c - rows.model_c) <= rows.radius_c)),
        "mean_width_c": float(np.mean(rows.radius_c * 2)),
        "misses": int(np.sum(np.abs(rows.actual_c - rows.model_c) > rows.radius_c)),
    }
    result["by_year"] = {
        str(y): {
            "n": len(g),
            "model": scores(g.actual_c, g.model_c),
            "persistence": scores(g.actual_c, g.persistence_c),
        }
        for y, g in rows.groupby(rows.target_date.dt.year)
    }
    from thermatwin.reliability import SEASONS

    season = rows.target_date.dt.month.map(SEASONS)
    result["subgroups"] = {}
    masks = {s: season == s for s in ("DJF", "MAM", "JJA", "SON")}
    masks.update(
        {"rising": rows.actual_c - rows.persistence_c >= 0.5, "extreme_p95": rows.actual_c > rows.p95_c}
    )
    for name, mask in masks.items():
        g = rows.loc[mask]
        result["subgroups"][name] = {
            "n": len(g),
            "model": scores(g.actual_c, g.model_c),
            "persistence": scores(g.actual_c, g.persistence_c),
            "coverage": float(np.mean(np.abs(g.actual_c - g.model_c) <= g.radius_c)),
        }
    return result


def run():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    frame, source = load_series("copernicus")
    x = features(frame)
    path = ROOT / "artifacts" / source["dataset_id"] / "model.joblib"
    original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    bundle = joblib.load(path)
    report = {
        "version": POLICY_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "source": source,
        "model_sha256": original_hash,
        "folds": [],
        "rolling_pooled": {},
        "protocol": {
            "refit": "annual expanding training, daily forecast origins, separate validation year and calibration year",
            "rolling_test_years": [2019, 2026],
            "forecast_horizons_days": [1, 2, 3],
            "selection": "Blend selected by validation MAE; alert source/percentile/margin by validation F1 against FIXED P90 labels",
            "interval": "finite-sample 80% residual order statistic; max(global, seasonal) with >=60 seasonal calibration samples",
            "event": ">=5 consecutive P90 days; no gap merging; boundary runs censored; one notice/episode and two clear days rearm",
            "rising": "target SST minus origin SST >=0.5 C (retrospective subgroup)",
            "extreme": "observed target SST > frozen training P95",
            "test_use": "Retrospective evaluation; prior fixed test was inspected in previous audit, so not a pristine prospective trial",
            "references": [
                "https://otexts.com/fpp3/tscv.html",
                "https://proceedings.mlr.press/v139/xu21h.html",
                "https://www.marineheatwaves.org/mhw-overview.html",
            ],
        },
        "limitations": [
            "Tek bölge ve günlük bölgesel SST; kıyı sensörü veya ekolojik zarar etiketi yok.",
            "2019–2026 geçmiş değerlendirmesi; daha önce incelenmiş seri üzerinde ileriye dönük bağımsız saha testi değildir.",
            "Zamansal bağımlılık ve iklim kayması nedeniyle %80 kapsama garantisi yok; mevsim ve ekstrem kapsaması ayrıca izlenmeli.",
            "Referans standart 30 yıl değil; sabit eski referans ısınan iklimde daha fazla eşik aşımı üretebilir.",
            "Olay başlangıcından önce uyarı başarısı, olay sürerken anomaliyi saptama başarısından düşüktür.",
            "Bildirim azaltımı yerel deterministik motorla ölçülür; e-posta teslimatı veya kullanıcı davranışı ölçülmedi.",
            "Arşiv revizyonları ve gerçek yayın gecikmesi için point-in-time kaynak sürümleri bulunmuyor; operasyonel gecikme backtestte modellenmedi.",
        ],
    }
    pooled = {h: [] for h in (1, 2, 3)}
    for year in range(2019, frame.index.max().year + 1):
        train_end = pd.Timestamp(f"{year - 3}-12-31")
        tune_end, cal_end = pd.Timestamp(f"{year - 2}-12-31"), pd.Timestamp(f"{year - 1}-12-31")
        test_end = min(pd.Timestamp(f"{year}-12-31"), frame.index.max())
        climate = seasonal_reference(frame.loc[:train_end])
        fold = {
            "test_year": year,
            "train_end": str(train_end.date()),
            "validation_end": str(tune_end.date()),
            "calibration_end": str(cal_end.date()),
            "test_end": str(test_end.date()),
            "horizons": {},
        }
        models = {}
        engine_rows = {}
        for h in (1, 2, 3):
            masks = block_masks(frame, x, h, train_end, tune_end, cal_end, test_end)
            model = estimator()
            target = frame.sst_c.shift(-h)
            tr, val = masks["train"], masks["validation"]
            model.fit(x.loc[tr], target.loc[tr] - frame.sst_c.loc[tr])
            delta = model.predict(x.loc[val])
            weight = min(
                (0.0, 0.25, 0.5, 0.75, 1.0),
                key=lambda w: scores(target.loc[val], frame.sst_c.loc[val] + w * delta)["mae_c"],
            )
            blocks = {
                name: prediction_rows(frame, x, model, weight, h, mask, climate)
                for name, mask in masks.items()
                if name != "train"
            }
            item = evaluate_blocks(blocks)
            item["xgboost_weight"] = weight
            item["train_n"] = int(tr.sum())
            fold["horizons"][str(h)] = item
            test = blocks["test"].copy()
            test["fold"] = year
            test["optimized_signal"] = policy_signal(test, item["warning_policy"])
            test["radius_c"] = [interval_radius(item["calibration"], d) for d in test.target_date]
            pooled[h].append(test)
            engine_rows[h] = test
            models[h] = {"model": model, "weight": weight}
        from thermatwin.warning import evaluate_engine

        fold["combined_engine"], _ = evaluate_engine(engine_rows)
        joblib.dump({"models": models, "climate": climate, "split": fold}, OUTPUT / f"rolling-{year}.joblib")
        report["folds"].append(fold)
        print(f"Rolling-origin {year}: tamamlandı", flush=True)
    for h in (1, 2, 3):
        rows = pd.concat(pooled[h], ignore_index=True)
        rows.to_csv(OUTPUT / f"rolling-{h}d.csv", index=False)
        report["rolling_pooled"][str(h)] = pooled_summary(
            [f["horizons"][str(h)]["evaluation"] for f in report["folds"]], rows
        )
    # Calibrate and optimize the PRESERVED deployed models on their original splits.
    split = bundle["evaluation"]["split"]
    climate = seasonal_reference(frame.loc[: pd.Timestamp(bundle["train_end"])])
    np.testing.assert_allclose(climate[["reference_c", "p90_c"]], bundle["climate"], atol=1e-12)
    deployed = {
        "version": POLICY_VERSION,
        "model_sha256": original_hash,
        "dataset_id": source["dataset_id"],
        "calibration_end": bundle["calibration_end"],
        "split": split,
        "p95_c": {str(k): float(v) for k, v in climate.p95_c.items()},
        "horizons": {},
    }
    engine_rows = {}
    for h in (1, 2, 3):
        masks = block_masks(
            frame,
            x,
            h,
            pd.Timestamp(split["train_end"]),
            pd.Timestamp(split["tuning_end"]),
            pd.Timestamp(split["calibration_end"]),
            frame.index.max(),
        )
        item = bundle["models"][h]
        blocks = {
            name: prediction_rows(frame, x, item["model"], item["weight"], h, mask, climate)
            for name, mask in masks.items()
            if name != "train"
        }
        result = evaluate_blocks(blocks)
        result["old_interval_coverage"] = bundle["evaluation"]["horizons"][str(h)]["coverage_80"]
        result["old_interval_radius_c"] = item["radius"]
        rows = blocks["test"].copy()
        rows["optimized_signal"] = policy_signal(rows, result["warning_policy"])
        rows["radius_c"] = [interval_radius(result["calibration"], d) for d in rows.target_date]
        rows.to_csv(OUTPUT / f"deployed-{h}d.csv", index=False)
        engine_rows[h] = rows
        deployed["horizons"][str(h)] = result
    from thermatwin.warning import evaluate_engine

    deployed["combined_engine"], trace = evaluate_engine(engine_rows)
    trace.to_json(
        OUTPUT / "deployed-engine-trace.json",
        orient="records",
        date_format="iso",
        force_ascii=False,
        indent=2,
    )
    assert original_hash == hashlib.sha256(path.read_bytes()).hexdigest()
    write_snapshot(deployed, OUTPUT / "deployed-policy.json")
    report["deployed"] = deployed
    report["reference_diagnostics"] = reference_diagnostics(frame, split)
    report["checks"] = {
        "original_model_preserved": True,
        "target_boundaries_purged": True,
        "policy_selected_on_validation": True,
        "calibration_separate_from_validation_and_test": True,
        "reference_training_only": True,
        "rolling_folds": len(report["folds"]),
    }
    write_snapshot(report, ROOT / "docs/reliability-report.json")
    write_snapshot(report, ROOT / "public/reliability-report.json")
    refresh_snapshots(frame, bundle, source, original_hash)
    from write_reliability_report import write_report

    write_report(report)
    print(
        json.dumps(
            {
                h: {
                    "rolling_mae_c": report["rolling_pooled"][h]["model"]["mae_c"],
                    "rolling_mae_gain_pct": report["rolling_pooled"][h]["mae_improvement_pct"],
                    "warning_f1": deployed["horizons"][h]["evaluation"]["daily"]["optimized"]["f1"],
                    "interval_coverage": deployed["horizons"][h]["evaluation"]["interval"]["coverage"],
                }
                for h in ("1", "2", "3")
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def refresh_snapshots(frame, bundle, source, original_hash):
    # Preserve original snapshots and enrich copies with the new deterministic engine.
    from thermatwin.pipeline import event_candidates
    from thermatwin.reports import generate_report
    from thermatwin.warning import apply_reliability

    originals = [
        json.loads((ROOT / f"public/{name}.json").read_text(encoding="utf-8")) for name in ("live", "replay")
    ]
    originals += json.loads((ROOT / "public/replay-events.json").read_text(encoding="utf-8"))["events"]
    overlays = []
    for snap in originals:
        enriched = apply_reliability(snap, frame, bundle)
        enriched["reports"] = [
            generate_report(event, allow_llm=False) for _, event in event_candidates(enriched)
        ]
        overlays.append(
            {k: enriched[k] for k in ("mode", "origin_date", "forecasts", "early_warning", "reports")}
        )
    write_snapshot(
        {"model_sha256": original_hash, "dataset_id": source["dataset_id"], "snapshots": overlays},
        ROOT / "public/reliability-snapshots.json",
    )
    # One successful pre-onset case AND one false event warning, selected only
    # for inspection. Neither case is used for policy or score selection.
    from thermatwin.pipeline import snapshot
    from thermatwin.reliability import true_events
    from thermatwin.science import annotate

    trace = pd.read_json(OUTPUT / "deployed-engine-trace.json", convert_dates=False)
    labels = pd.DataFrame(
        {"target_date": pd.to_datetime(trace.origin_date), "actual_c": trace.sst_c, "p90_c": trace.p90_c}
    )
    events = true_events(labels)
    selected = {}
    for row in trace.loc[trace.notify & (trace.state == "forecast_risk")].itertuples():
        event = next((e for e in events if e["start"] <= pd.Timestamp(row.target_date) <= e["end"]), None)
        key = "early" if event else "false"
        if key not in selected:
            selected[key] = (row.origin_date, event)
    annotated = annotate(frame, bundle["climate"])
    examples = []
    for key, (origin, event) in selected.items():
        snap = snapshot(frame, bundle, "replay", str(origin)[:10], allow_llm=False)
        pool = annotated.loc[
            (annotated.index < pd.Timestamp(origin) - pd.DateOffset(days=14))
            & (annotated.index.month == pd.Timestamp(origin).month)
            & (annotated.risk == "normal")
        ]
        normal = pool.anomaly_c.abs().idxmin()
        row = pool.loc[normal]
        snap["comparison"] = {
            "date": str(normal.date()),
            "sst_c": float(row.sst_c),
            "reference_c": float(row.reference_c),
            "anomaly_c": float(row.anomaly_c),
            "note": "Aynı aydan önceki normal gözlem; nedensel kontrol değildir.",
        }
        snap["replay_label"] = "Olaydan önce sinyal" if key == "early" else "Olay oluşmayan sinyal"
        snap["replay_assessment"] = (
            f"Sonradan gözlenen sonuç: beş günlük P90 olayı {event['start'].date()} tarihinde başladı. Bu gelecek bilgisi uyarı hesabına girmedi."
            if event
            else "Sonradan gözlenen sonuç: uyarının hedefi beş günlük bir P90 olayına denk gelmedi. Bu örnek yanlış olay uyarısını gösterir; kısa eşik aşımı yaşanmış olabilir."
        )
        examples.append(snap)
    write_snapshot({"events": examples}, ROOT / "public/reliability-replays.json")


if __name__ == "__main__":
    if "--refresh-snapshots" in sys.argv:
        frame, source = load_series("copernicus")
        path = ROOT / "artifacts" / source["dataset_id"] / "model.joblib"
        refresh_snapshots(frame, joblib.load(path), source, hashlib.sha256(path.read_bytes()).hexdigest())
    else:
        run()
