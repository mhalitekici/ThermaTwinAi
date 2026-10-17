"""Render the completed experiment; never trains or changes raw evidence."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / "research/candidate-vnext"


def main():
    r = json.loads((EXPERIMENT / "report.json").read_text(encoding="utf-8"))
    lines = [
        "# ThermaTwin Forecasting Engine — candidate vNext",
        "",
        "**Decision: retain the champion. Do not promote.** No live model, policy, workflow flag, account, data or mail was changed.",
        "",
        f"Evaluation: {r['created_at']}. Protocol `{r['version']}` was committed before fitting at `{r['protocol_commit']}`. This is an already-inspected retrospective series, not a prospective validation or a proprietary foundation model.",
        "",
        "The experiment adds nine causal trend/acceleration/seasonal-interaction features to the original 14. Two declared XGBoost residual objectives and five persistence weights are compared only on validation data per horizon/fold. Calibration uses its separate historical block. Test selection or post-result tuning was not performed.",
    ]
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5), layout="constrained")
    for ax, scope, title in zip(
        axes, ("rolling", "frozen"), ("Annual rolling-origin 2019–2026", "Frozen chronological test")
    ):
        lines += [
            "",
            f"## {title}",
            "",
            "All methods use identical observed target dates; negative gain means worse than champion. Seasonal/persistence errors and full diagnostics are in `report.json` and the packaged traces.",
            "",
            "| Horizon | N | Champion MAE °C | Candidate MAE °C | Gain vs champion | Candidate RMSE °C | Coverage | Width °C |",
            "|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for h in ("1", "2", "3"):
            a, b = r[scope]["candidate"]["horizons"][h], r[scope]["champion"]["horizons"][h]
            gain = 100 * (1 - a["model"]["mae_c"] / b["model"]["mae_c"])
            lines.append(
                f"| +{int(h) * 24}h | {a['n']} | {b['model']['mae_c']:.6f} | {a['model']['mae_c']:.6f} | {gain:+.3f}% | {a['model']['rmse_c']:.6f} | {a['interval']['coverage']:.2%} | {a['interval']['mean_width_c']:.3f} |"
            )
        lines += [
            "",
            "| Horizon | Candidate / champion warning F1 | Candidate / champion recall | Candidate FP / FN | Rapid-warming MAE °C | Rapid-warming coverage |",
            "|---|---:|---:|---:|---:|---:|",
        ]
        for h in ("1", "2", "3"):
            a, b = r[scope]["candidate"]["horizons"][h], r[scope]["champion"]["horizons"][h]
            d, base = a["daily"]["optimized"], b["daily"]["optimized"]
            lines.append(
                f"| +{int(h) * 24}h | {d['f1']:.4f} / {base['f1']:.4f} | {d['recall']:.4f} / {base['recall']:.4f} | {d['fp']} / {d['fn']} | {a['subgroups']['rising']['model']['mae_c']:.4f} | {a['subgroups']['rising']['coverage']:.2%} |"
            )
        a, b = r[scope]["candidate"]["combined_engine"], r[scope]["champion"]["combined_engine"]
        lines += [
            "",
            f"Combined engine: candidate detected {a['detected_events']}/{a['events']} events, {a['early_events']} early; champion detected {b['detected_events']}/{b['events']}, {b['early_events']} early. False-event notices: candidate {a['false_event_notifications']}, champion {b['false_event_notifications']}.",
            "",
            f"Early lead days, one earliest qualifying notice per retrospectively labeled event: candidate {a['early_lead_days']} (mean {a['mean_early_lead_days']:.3f}d, N={a['early_events']}), champion {b['early_lead_days']} (mean {b['mean_early_lead_days']:.3f}d, N={b['early_events']}). Conditional lead-time means exclude missed events and are not a measure of improved early detection.",
            "",
            "Failed predeclared gates: "
            + ", ".join(f"`{s}`" for s in r["gates"][scope]["failed"])
            + ". All gate decisions are recomputed in CI.",
        ]
        x = np.arange(3)
        champion = [r[scope]["champion"]["horizons"][str(h)]["model"]["mae_c"] for h in (1, 2, 3)]
        candidate = [r[scope]["candidate"]["horizons"][str(h)]["model"]["mae_c"] for h in (1, 2, 3)]
        bars_a = ax.bar(x - 0.18, champion, 0.36, label="Champion", color="#536b76")
        bars_b = ax.bar(x + 0.18, candidate, 0.36, label="Candidate", color="#086a77")
        ax.bar_label(bars_a, fmt="%.3f", fontsize=8, padding=3)
        ax.bar_label(bars_b, fmt="%.3f", fontsize=8, padding=3)
        ax.set(
            xticks=x,
            xticklabels=["24h", "48h", "72h"],
            ylabel="MAE (°C), lower is better",
            title=title,
            ylim=(0, 0.45),
        )
        ax.legend(loc="upper left", fontsize=9)
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Candidate vNext: mixed temperature gains; promotion gates failed", fontsize=14)
    fig.savefig(EXPERIMENT / "comparison.png", dpi=180)
    plt.close(fig)
    lines += [
        "",
        "![Real MAE comparison](comparison.png)",
        "",
        "## Why the champion remains",
        "",
        "The required ≥2% MAE improvement did not hold at 24h or 48h in either protocol. Rolling combined-engine early detections regressed from three to two. Per-horizon warm-day metrics do not imply better event warning; frozen warning F1 remains below persistence. Reduced 72h temperature error cannot offset the failed gates. No significance test or general accuracy percentage is claimed.",
        "",
        "Observed-condition decisions are the unchanged SST/P90 rule; their input values and quality gates are identical. Only forecast-dependent candidates differ. The fixed 80% seasonal calibration method was retained for comparability; rapid-warming coverage is still poor. Year/season metrics and regression gates are retained even where pooled averages improve.",
        "",
        "## Evidence, runtime and limits",
        "",
        "- `protocol.json`: predeclared selection, all parameters and gates; `report.json`: complete folds, candidate validation board, yearly/seasonal/subgroup/interval/daily/event diagnostics and decision.",
        "- `held-out-predictions.csv.gz`: all 23,142 candidate/champion comparison records, with origin/target/horizon/scope/strategy. `evidence-manifest.json` fingerprints these, the report and processed input. Original per-fold CSVs remain in the separate ignored experiment directory.",
        "- `runtime-bundle.zip` and `runtime-manifest.json`: separate ~261 KB package in the exact existing three-member format. CI installs it into a temporary directory, validates hashes, unpickles actual estimators and runs the existing forecast/calibrated snapshot path. Corrupt bundles are rejected. The current runtime manifest and model/policy are untouched; it is not activated.",
        "- Source data: archived revised Copernicus L4 daily ROI mean through 16 October 2026. Historical publication/availability timestamps are unavailable; no latency or exogenous forecast benefit is claimed. Region, reference-period and ecological/causal limitations remain.",
        "- Initial execution stopped at a string/Timestamp conversion in 2019 event lead-time reporting. Partial predictions were preserved; date normalization was repaired with identical declared parameters/gates, then one complete run finished. No score-driven search expansion or candidate promotion occurred.",
        "",
        "Locked runtime versions: "
        + ", ".join(f"{k} {v}" for k, v in r["versions"].items())
        + f"; Python {r['python']}.",
        "",
        "Reproduce on an isolated copy with the original local scientific inputs: `python scripts/evaluate_challenger.py`, then `python scripts/package_challenger_evidence.py`, then `python scripts/write_challenger_report.py`. The first two refuse to overwrite an existing completed experiment/evidence. Do not remove existing evidence to tune on the same test. Use a new declared protocol and independent future evaluation for subsequent research.",
        "",
        "Owner approval is required for any future model/policy promotion. This experiment does **not** recommend it.",
    ]
    (EXPERIMENT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
