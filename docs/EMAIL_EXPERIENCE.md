# Professional email experience — PR C

`backend/thermatwin/email_templates.py` renders three experiences with the same Ocean identity as the application: manual historical TEST, observed-anomaly information, and an explicitly experimental forecast preview. It remains a pure function returning `subject`, `html`, `text`; no transport, store, credentials or approval flags are touched. `mail.py` and `notification_policy.py` are unchanged.

Layout uses presentation tables, inline CSS, system fonts, a typographic logo, a single safe report CTA, notification management and no external images/tracking. Progressive media queries provide narrower-screen padding and dark colors; common-client fallbacks remain inline. No Outlook/Gmail native-client compatibility claim is made: actual automated screenshots use Chromium.

Both formats include the real region, observation/origin date, target where appropriate, SST, reference, difference, P90 and source, plus why the report exists, scientific limitations, report link and cancellation link. Facts are copied from the immutable report; no values or current dates are fabricated. Forecast values are called forecasts, never observations. Existing frozen outbox payloads/retries stay immutable; this renderer affects newly claimed payloads only.

The application link accepts a credential-free HTTPS origin without path/query/fragment/control characters; local HTTP is limited to loopback outside Production. Historical links use an ISO-validated origin and encoded replay query. Every dynamic HTML value is escaped. Numeric facts and intervals must be finite. Provider identity, consent, recipient revalidation, staleness/quality gates, namespace dedupe, cancellation and automatic approval remain the existing mail-policy responsibility.

## Recreate local previews

```powershell
.venv/Scripts/python.exe -X utf8 scripts/preview_emails.py
node scripts/capture-email-previews.mjs after
```

Open `artifacts/product-upgrade/email-after/{manual-test,observed,forecast}.html` and the adjacent plain-text files. All use actual 7 June 2024 replay reports with a prominent local/historical/no-send banner. The observed/forecast variants are renderer previews only: that old observation is ineligible for a live send. The script imports no sender, loads no `.env` and never calls HTTP. It fixes the CTA destination only; it does not configure an account.

Actual screenshots: [before TEST](product-review/email-test-before.png), [after TEST mobile](product-review/email-test-mobile.png), [observed dark](product-review/email-observed-dark.png), [experimental forecast](product-review/email-forecast.png). The full local matrix has 24 before and 24 after screenshots: three templates × four widths × two color schemes. CI generates and uploads HTML/text/24 screenshots as `email-review-previews`.

## Validation and boundaries

101 Python tests passed locally, including 14 new renderer/URL/plain-parity cases and the existing delivery/consent/frozen-retry tests. Ten connected-account E2E scenarios passed against controlled transports, including OTP, private subscriptions, explicit TEST, dedupe and cancellation. All 24 new preview screenshots passed zero overflow, WCAG A/AA smoke checks and zero external requests; the 24 original screenshots were preserved for comparison. Python lint passed. Earlier frontend/build/environment validation is retained and the full CI matrix runs on this PR.

No real email was sent. Automatic flags remain shadow/false/false and no Production deployment or account change was performed. Native mail-client rendering, inbox placement and owner review remain manual acceptance items. Historical or experimental previews are not authorizations to dispatch.
