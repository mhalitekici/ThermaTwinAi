# Ocean product review — PR A

These are actual Chromium screenshots of the dated demo snapshot, not design mockups. Before: main `a805fb5`; after: PR A. No real account details or mail sends are included.

| Route | Before | After |
|---|---|---|
| Landing, 1920 px, dark | [Original](landing-before.png) | [Ocean design](landing-after.png) |
| Dashboard, 1366 px, dark | [Original](dashboard-before.png) | [Ocean design](dashboard-after.png) |

The complete local matrix contains 80 screenshots per stage: ten routes, four widths (390/768/1366/1920), both themes, plus mobile navigation. Open `artifacts/product-upgrade/review.html` to compare. Run `node scripts/capture-product.mjs after` against the isolated demo preview and `node scripts/product-gallery.mjs` to recreate it; README documents the preview command. CI also uploads the eight landing theme/viewport screenshots. External map tile availability affects the map background; the ROI and observation remain real.

Validation: 48 browser tests, 10 controlled connected-account tests, 56 frontend unit tests, 83 Python tests, RLS/database checks, deployment isolation fixtures, lint, TypeScript and build passed. The connected-account run initially found light-theme badge contrast below AA; the shared teal token was corrected and all ten tests passed on rerun. No live provider send was performed. No mobile field-performance or Outlook-client validation is claimed.

The production entry JS is approximately 526 KB (156 KB gzip), compared with 515 KB (153 KB gzip) before. Route lazy loading is retained; no new runtime package was added. Source observations, research reports, model weights and `.env` match the 50-file starting SHA-256 baseline. Merge and Production deployment remain owner decisions.
