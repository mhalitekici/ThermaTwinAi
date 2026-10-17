# ThermaTwin AI — product upgrade delivery

Base: `main` at `a805fb577169a04f92f3db2466831f5b070b2c2c`. Work is delivered as five separate stacked PRs. No PR was merged, no Production deployment or real provider email was performed, and no live schedule/account/migration was changed. Automatic mail remains shadow/false/false. Original champion and policy remain active.

## Reviewable changes

| Phase / PR | Implementation and principal files | Evidence and remaining boundary |
|---|---|---|
| A · [#6](https://github.com/mhalitekici/ThermaTwinAi/pull/6) | Independent ocean identity, two themes, shared controls, responsive landing and existing routes; `src/product.css`, `pages/Landing.tsx`, Shell/Login/SeaMap, SEO/local fonts. Map error/retry preserves real ROI. | [Design and before/after screenshots](product-review/README.md). Real dated source, measured rolling metrics and both successful/false replay examples. Map tile availability is external; no field speed claim. |
| B · [#7](https://github.com/mhalitekici/ThermaTwinAi/pull/7) | Existing `/performance` consolidated; `pages/Performance.tsx`, `performance.ts`, HeldOutChart/ReliabilityPerformance, validated trace exporter, versioned public trace file. | [Performance Lab method/screens](PERFORMANCE_LAB.md). 8,490 actual stored held-out predictions; horizons, year/season/event filters, same-date baselines, explicit tolerance rates, daily/interval/event limitations and safe printable HTML export. New static data is ~1.59 MB, lazy route only. |
| C · [#8](https://github.com/mhalitekici/ThermaTwinAi/pull/8) | Pure HTML/plain renderer in `backend/thermatwin/email_templates.py`; three experiences, preview generator, security/URL/plain-parity tests, CI screenshot artifact. | [Email previews/screens](EMAIL_EXPERIENCE.md). TEST/observed/experimental, real historical facts, safe CTA/cancellation, inline/table CSS, no trackers. Dispatch/consent/dedupe/retry unchanged. Native Outlook/Gmail/inbox acceptance remains untested. |
| D · [#9](https://github.com/mhalitekici/ThermaTwinAi/pull/9) | `challenger.py`, offline evaluator, predeclared protocol, 23,142 comparison records, full report/figure and separate hash-validated runtime package under `research/candidate-vnext`. | [Scientific result](../research/candidate-vnext/REPORT.md). Real experiment failed predeclared promotion gates; **retain champion**. Package/inference works in CI using monitoring dependencies. Already-inspected historical series is not a prospective trial. |
| E · [#10](https://github.com/mhalitekici/ThermaTwinAi/pull/10) | DataFreshness card/helper/tests in dashboard, four-width old-data/new-fetch regression, final review gallery, operation audit. | [Chronology and operation boundaries](FRESHNESS_OPERATIONS.md). Observation/fetch/processing/forecast times are separate. Source publication time and successful-run evidence absent from payload stay explicitly unverified. No new privileged request or job activation. |

PR bases form A→B→C→D→E; the first PR targets main. Owner review should follow that order, retargeting the next PR to main after its predecessor merges. Merging research code never activates the candidate package; the original runtime manifest stays unchanged. Any future model promotion needs a separate proposal and approval; this experiment recommends against it.

## Real scientific result

| Rolling horizon | Champion MAE °C | Candidate MAE °C | Change |
|---|---:|---:|---:|
| 24h | 0.248394 | 0.248722 | 0.13% worse |
| 48h | 0.333453 | 0.327295 | 1.85% lower |
| 72h | 0.362608 | 0.354128 | 2.34% lower |

The declared requirement was ≥2% MAE reduction at **each** horizon in both rolling and frozen protocols, plus warning/recall/interval/rapid-warming/year-season/event safety gates. 24/48h failed. Rolling early detections declined 3/34→2/34. Frozen early detections remained 2/18 with 38 false-event notices; warning F1 still does not beat persistence. No generic accuracy percentage or significant/prospective improvement is claimed. The original inspection test remains inspected, and archive revision/publication latency limits remain unresolved.

An initial execution stopped at a string/Timestamp conversion in 2019 lead-time reporting. Partial output was preserved; the date handling was fixed without changing declared candidates or criteria, followed by one completed run. No score-driven retuning or promotion occurred.

## Verification actually run

| Check | Final local result |
|---|---|
| Frontend unit | 71 passed |
| Chromium route/flow/accessibility/routing/freshness E2E | 60 passed at 390/768/1366/1920 px |
| Controlled connected-account E2E | 10 passed; OTP/session/consent/private history/manual TEST/dedupe/cancellation; no real provider transport |
| Python | 107 passed, zero local skips; existing dependency deprecation warnings remain |
| Email screenshots | 24 before + 24 after; after: zero overflow, A/AA smoke violations or external requests |
| Route screenshots | 80 before + 80 PR A + 80 final, plus mobile navigation; zero overflow/page errors |
| Lint / TypeScript / build | Passed |
| Deployment / config guards | Production + hosted Preview fixtures passed; missing Production settings, unknown public fields and secret values rejected; Vercel metadata excluded |
| PostgreSQL/RLS | Passed; private isolation, privileged RPC, consent, lease/dedupe/frozen retry/quarantine/unsubscribe |
| Scientific evidence | Same-date MAE/RMSE/count/coverage reproductions, purged boundaries, causal features, validation-only selection and all gate decisions verified |
| Candidate runtime | Actual pinned candidate ZIP installed in temporary root, corrupt hash rejected, existing inference/calibrated snapshot path passed |
| Preservation / secrets | All 50 original-file hashes and original runtime ZIP match; zero actual local server-secret matches in 331 scanned product/client/artifact files; values never logged |

A–D CI passed on their reviewed heads. Every PR's Checks tab is the authoritative latest-head result, including E's complete matrix. Clean CI lacks the original ignored full research inputs and explicitly skips seven original artifact tests (D CI: 100 passed, 7 skipped); local 107 tests had those inputs. New candidate runtime/evidence tests do run in clean CI from the separately committed candidate files. Linux API container preview/production smoke checks verify a lightweight HTTP runtime without provider requests or ML packages. No real-account OTP or inbox result is invented.

Initial browser/account runs found an AA badge contrast issue, mobile table keyboard access and a theme test that sampled transition colors. The shared light teal color and focusable table regions were fixed; static-theme audits use supported reduced-motion mode. Final focused/full tests and CI passed after the fixes. Those intermediate failures are not hidden or represented as first-run success.

## Screens and previews

- Complete interactive local comparison: `artifacts/product-upgrade/review-final.html` (all routes, four widths, both themes, mobile navigation).
- Original PR A comparison is separately retained at `artifacts/product-upgrade/review.html`.
- Local email HTML/plain previews: `artifacts/product-upgrade/email-after/`; actual historical records, clearly labeled local/no-send.
- Committed selected screenshots: [review directory](product-review/README.md), [Performance Lab](PERFORMANCE_LAB.md), [email experience](EMAIL_EXPERIENCE.md), [freshness](FRESHNESS_OPERATIONS.md).
- CI artifacts: `product-review-screenshots` and `email-review-previews`; retention 14 days. Download from the relevant latest successful Actions run.

Recreate route captures using the isolated demo preview described in README, then `node scripts/capture-product.mjs final` and `node scripts/product-gallery.mjs final`. Email commands are in EMAIL_EXPERIENCE. Map tiles are real external geographic context, not a fabricated thermal layer. Screenshots are desktop Chromium, not mobile field measurements or native email clients.

Production entry JS is approximately 526 KB / 156 KB gzip versus 515 KB / 153 KB before; no new runtime npm dependency was added. Route lazy loading is preserved; the trace data, report UI and maps load in their relevant routes. No Core Web Vitals improvement is asserted from these bundle measurements.

## Owner decisions and future work

The concrete PRs, previews and evidence are ready for review. Merge/Production deployment remain owner decisions under the request's explicit boundary. No confirmation is needed for a routine code edit; approval is required only to change the real deployment/automatic-operation boundary.

Keep the champion. Do not enable automatic forecast mail. After any authorized release, check actual hosted OTP, account isolation, screenshot/theme behavior and explicitly requested manual TEST with the owner; no real inbox test was sent here. Native email-client review and real field performance measurement remain separate acceptance work. A future monitoring rollout needs source availability timestamps, prospective drift/latency evidence and resource/permission review before enabling its schedule. Existing research/data/PDF artifacts, `.env`, user-provided `.agents/` and `skills-lock.json` were preserved; the latter user files were not staged.
