"""Package an already completed experiment. No model fitting or retuning."""

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / "research/candidate-vnext"
OUTPUT = ROOT / "artifacts/experiments/candidate-vnext-2026-10-17-v1"


def main():
    report = json.loads((EXPERIMENT / "report.json").read_text(encoding="utf-8"))
    target = EXPERIMENT / "held-out-predictions.csv.gz"
    if target.exists():
        raise RuntimeError("Published evidence already exists; never overwrite it.")
    frames = []
    for scope in ("rolling", "frozen"):
        for h in (1, 2, 3):
            if scope == "rolling":
                candidate = pd.concat(
                    [pd.read_csv(OUTPUT / f"{year}-{h}d.csv") for year in range(2019, 2027)],
                    ignore_index=True,
                )
                champion = pd.read_csv(ROOT / f"artifacts/reliability/v1/rolling-{h}d.csv")
            else:
                candidate = pd.read_csv(OUTPUT / f"frozen-{h}d.csv")
                champion = pd.read_csv(ROOT / f"artifacts/reliability/v1/deployed-{h}d.csv")
                champion["fold"] = "frozen"
            assert candidate.origin_date.equals(champion.origin_date)
            assert candidate.target_date.equals(champion.target_date)
            for strategy, rows in (("candidate", candidate), ("champion", champion)):
                expected = report[scope][strategy]["horizons"][str(h)]
                errors = rows.model_c - rows.actual_c
                assert len(rows) == expected["n"]
                assert abs(errors.abs().mean() - expected["model"]["mae_c"]) < 1e-10
                assert abs(np.sqrt((errors**2).mean()) - expected["model"]["rmse_c"]) < 1e-10
                frames.append(rows.assign(scope=scope, strategy=strategy, horizon=h))
    content = gzip.compress(
        pd.concat(frames, ignore_index=True).to_csv(index=False, lineterminator="\n").encode(), mtime=0
    )
    target.write_bytes(content)
    manifest = {
        "version": report["version"],
        "records": sum(map(len, frames)),
        "comparison_sha256": hashlib.sha256(content).hexdigest(),
        "report_sha256_lf": hashlib.sha256(
            (EXPERIMENT / "report.json").read_text(encoding="utf-8").encode()
        ).hexdigest(),
        "processed_input_sha256": hashlib.sha256(
            (ROOT / "data/processed/copernicus.csv").read_bytes()
        ).hexdigest(),
        "execution_note": "Initial attempt stopped on origin-date string/Timestamp conversion while building 2019 lead-time metrics. Partial predictions retained in artifacts/experiments/candidate-vnext-2026-10-17-v1-aborted-date-conversion. Date normalization repaired; declared model/search/gates unchanged. One completed run; no result-driven tuning.",
        "no_automatic_promotion": True,
    }
    (EXPERIMENT / "evidence-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Packaged {manifest['records']} actual candidate/champion predictions; no fitting. {len(content)} bytes."
    )


if __name__ == "__main__":
    main()
