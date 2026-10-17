# ThermaTwin AI Performance Lab

Actual Chromium views: [desktop dark](product-review/performance-lab-dark.png), [mobile light](product-review/performance-lab-mobile.png). Before views are retained in the PR A local comparison matrix. CI uploads all eight Performance Lab theme/viewport screenshots. Eight focused browser tests passed after keyboard-table and stable-theme checks; 66 frontend unit and 87 Python tests passed locally. CI runs the full 56 browser and ten connected-account scenarios. No real external send is used.

The existing `/performance` route is consolidated into a single evidence explorer. It loads the unchanged `reliability-report.json`, `model-audit.json` and the new `performance-traces-v1.json` in parallel, only when the lazy route is opened. The new trace file contains 8,490 existing out-of-sample predictions, not fitted or reconstructed examples. Uncompressed size is approximately 1.59 MB; it is a separate static download, not entry JavaScript.

## Evidence and reproduction

`python scripts/export_performance_traces.py` reads the original ignored `artifacts/reliability/v1/rolling-{1,2,3}d.csv`. It verifies finite numeric values, unique chronological target dates, exact horizon offsets, training/validation/calibration separation, fold completeness and target-boundary purging. All four baseline/model MAE and RMSE values, N and interval coverage must reproduce the original versioned report within 1e-10. No model is loaded or fitted. Original files are never written.

The output records original CSV SHA-256 values, evaluation/model versions and fold boundaries. The report hash uses UTF-8 with LF line endings so Windows CRLF checkout and Linux CI agree without modifying the protected report. The browser verifies that hash and recomputes all-horizon metrics and warning counts before rendering evidence; malformed/mismatched evidence fails with retry. Python CI validates the committed public traces without requiring local model weights; local runs additionally compare original CSV fingerprints.

## Defined metrics

All explorer metrics share exactly the same filtered target dates. The horizon selects +24/+48/+72 hours; filters select target year, meteorological season and retrospective condition or ≥5 consecutive observed-P90-day event. Events touching fold boundaries are excluded; gaps are never joined. Rapid warming means target SST minus origin SST ≥0.5 °C, known only retrospectively.

The chart displays at most the last 90 actual records in the selected scope, with explicit dates and a keyboard-readable table. Lines break across missing dates. Metrics and report use **all** selected records. Model/persistence/seasonal-reference/prior-year MAE and RMSE, sample period, tolerance numerator/denominator, interval coverage/width and daily P90 confusion metrics update together. Zero metric denominators show “Tanımsız”.

“±X °C tolerans içinde kalan tahmin oranı” means the fraction with `abs(model_c - actual_c) <= X`, computed before display rounding. It is neither generic AI accuracy nor event probability. Full-period MAEs remain approximately 0.2484 / 0.3335 / 0.3626 °C (loaded from the report; do not use these rounded documentation values as a separate data source).

Frozen deployed-model diagnostics have a visibly separate scope and never inherit explorer filters: warning F1 still trails persistence; the combined engine found 8/18 events and only 2 before onset, with 38 false event notices. These are retrospective simulated records, not real emails. Conditional rapid-warming interval weakness remains visible. Annual fold estimators are distinct from the single frozen deployed model hash.

## Scientific export and limitations

The downloadable, self-contained HTML report records the exact scope, N, dates, horizons, definitions, baseline errors, tolerance ratios, interval diagnostics, daily confusion metrics, source/model/report/CSV hashes, original limitations and every selected record. It is printable to PDF through the browser. Dynamic text is escaped; no scripts, images, tracking or external resources are included.

The inspected historical test is not a pristine prospective trial. Original archive revisions and historical publication latency are not modeled. No new tuning, candidate promotion, dispatch, migration or real provider call is performed here. Automatic notifications remain shadow/false/false. Browser screenshots test Chromium rendering and accessibility; they are not field performance benchmarks.
