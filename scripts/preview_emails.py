"""Local real historical previews only. No store, credentials, HTTP or sends."""
import json
import os
from copy import deepcopy
from pathlib import Path

from thermatwin.email_templates import render_email

ROOT = Path(__file__).resolve().parents[1]


def previews():
    snapshot = json.loads((ROOT / "public/replay.json").read_text(encoding="utf-8"))
    observed = next(r for r in snapshot["reports"] if r["facts"]["kind"] == "observed")
    predicted = next(r for r in snapshot["reports"] if r["facts"]["kind"] == "predicted")
    for name, report, test in (("manual-test", observed, True), ("observed", observed, False), ("forecast", predicted, False)):
        report = deepcopy(report)
        yield name, {"mode": "replay" if test else "live", "kind": report["facts"]["kind"], "event_date": report["facts"]["event_date"], "report": report}, test


if __name__ == "__main__":
    # This sets link destinations only, not credentials or actual provider configuration.
    os.environ["APP_URL"] = "https://thermatwin-ai.vercel.app"
    os.environ["APP_ENV"] = "test"
    folder = ROOT / "artifacts/product-upgrade/email-after"
    folder.mkdir(parents=True, exist_ok=True)
    for name, alert, test in previews():
        result = render_email(alert, test=test, preview=True)
        for suffix, key in (("html", "html"), ("txt", "text")):
            (folder / f"{name}.{suffix}").write_text(result[key], encoding="utf-8")
    print("Three historical local previews written. No transport called; no mail sent.")
