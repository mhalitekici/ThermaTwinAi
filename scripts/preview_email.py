"""Create a local TEST HTML preview from the real historical observation; no send."""

from thermatwin.api import get_snapshot
from thermatwin.config import ROOT
from thermatwin.email_templates import render_email
from thermatwin.pipeline import event_candidates
from thermatwin.reports import generate_report

snap = get_snapshot("replay", "2024-06-07")
event = next(event for kind, event in event_candidates(snap) if kind == "observed")
event["report"] = generate_report(event, allow_llm=False)
rendered = render_email(event, test=True)
target = ROOT / "artifacts/email-preview.html"
target.write_text(rendered["html"], encoding="utf-8")
target.with_suffix(".txt").write_text(rendered["text"], encoding="utf-8")
print("Local preview created: artifacts/email-preview.html; no provider request made.")
