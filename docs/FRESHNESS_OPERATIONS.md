# Freshness and monitoring — PR E

The dashboard now presents a dated chronology instead of treating “checked” as “observed”. This is a presentation-only change: no source observations, model values, backend policy, account, workflow schedule, RLS or snapshot storage contract changes.

| Field | Meaning | What it does not prove |
|---|---|---|
| `origin_date` | Actual daily SST observation / forecast origin | Intraday sensor measurement |
| `source.retrieved_at` | Access time of the archived source | First publication time or a newly observed day |
| `checked_at` | Snapshot computation/check time | Latest successful monitoring run or delivery |
| `forecasts[].origin_date` | Information date used for each forecast | Forecast target becoming an observation |
| Publication availability | Not included in this snapshot | Cannot infer publication latency from fetch/check time |
| Latest successful monitor | Not verified by this snapshot | Must inspect actual `monitor_runs` records separately |

The public snapshot does not contain an authenticated successful-run record or historical first-publication timestamp. The UI says so explicitly and makes no new privileged request. No fabricated operational status is substituted.

Final visualization review also adds distinct observation/model point markers when filters leave an isolated test date. Such points have no adjacent date to form a line; they remain visible without connecting missing dates or changing any metric.

[Actual filtered example](product-review/performance-isolated-records.png): +72h, summer 2025, ≥0.5 °C warming; 30 real selected records, seven isolated dates. Eight focused browser cases and TypeScript passed after this rendering fix.

## Classification and behavior

The shared pure helper uses UTC calendar days. An eligible dated observation at most three days old is “Güncellik penceresinde”, with a daily/non-sensor explanation. Age >3 or source stale is “Gecikmiş gözlem”; missing/invalid observations in the last 15 calendar days are “Yakın geçmiş eksik”; invalid/future observations are “Veri doğrulanamadı”. Replay remains “Geçmiş kayıt”. Timestamp text requires an actual timezone-qualified timestamp; a bare day is not silently given a measured midnight.

New fetch and processing timestamps cannot update the observation date or make an old observation fresh. Refresh only rereads data; it starts no monitoring or mail job. Stale live email remains blocked by the existing backend data gate. Manual historical TEST still requires the existing explicit user action/consent. Missing/source-failure views remain the existing loading/retry/empty states.

## Inspected operations, unchanged

`monitor.yml` already declares three daily UTC checks and gates scheduled execution on `MONITORING_ENABLED == 'true'`; a manual workflow dispatch is also supported. The workflow fixes shadow/false/false and disables TEST sends. `run_monitor.py` validates the pinned model/policy hashes, installs only the trusted original bundle when absent, loads Copernicus, writes the snapshot and sanitized run status; it never retrains. `monitoring.py` and `pipeline.publish` persist run/snapshot records. A completed snapshot calculation is separate from later delivery/run completion.

Read-only GitHub inspection on 17 October 2026 returned no repository Actions variable names; `MONITORING_ENABLED` was not configured. The most recent listed schedule run (`39062427027`, 19:25:46 UTC) was skipped. This is a point-in-time repository observation, not a promise that no future run can occur. No variables, schedules, secrets, cloud settings or live data were changed, and `run_monitor.py` was not executed.

Before enabling a live schedule, the owner should review Copernicus access/egress, full-history versus incremental retrieval, Actions time limits, Supabase write/storage quotas, concurrency and alerting responsibility. A subsequent additive server-only change could return a narrowly sanitized successful-run summary; exposing the private `monitor_runs.detail` wholesale would be inappropriate. Recording actual provider availability/revision timestamps and immutable per-run source fingerprints would support honest latency/drift analysis. Those require real source support and prospective operation; archived backtests do not establish them. No automatic sending approval follows from enabling a data job.

## Verification

Five new frontend unit cases cover day boundaries, old-data/new-fetch separation, replay, missing/nonfinite/future data and explicit timestamp precision. A browser regression at four widths freezes the clock at 22 October, refreshes fetch/check timestamps to that date, and still requires the real 16 October observation and “six days old” label. Existing dashboard theme/accessibility tests include the new chronology. No external account or email is used.

Final local results: 71 frontend unit, 60 browser, ten controlled connected-account tests passed; lint, TypeScript/production build, RLS/database, secret guards and all hosted deployment fixtures passed. The unchanged Python code's latest full run passed 107 tests. Final 80-route/theme/width capture: zero overflow/page errors. Original 50-file hashes and the original runtime ZIP hash match; a 331-file product/client/artifact scan found zero real local server-secret matches (values were never logged). Actual normal-clock views: [desktop dark](product-review/freshness-dashboard.png), [mobile light](product-review/freshness-mobile.png).

Recreate the complete final route/theme matrix with `node scripts/capture-product.mjs final`, then `node scripts/product-gallery.mjs final`; open `artifacts/product-upgrade/review-final.html`. The original PR A matrix/gallery remains separate. CI also saves the freshness regression screenshots; these clock-controlled test fixtures are not current-day measurements.
