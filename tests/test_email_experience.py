"""Renderer-only security, plain-text parity, scientific labels and local preview."""
import importlib.util
import math
import re
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from thermatwin.email_templates import render_email
from thermatwin.notification_policy import dispatch_mode, notification_config

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("preview_emails", ROOT / "scripts/preview_emails.py")
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


@pytest.mark.parametrize("name,alert,test", list(preview.previews()))
def test_three_experiences_have_real_facts_plain_parity_no_tracking_and_safe_links(name, alert, test):
    rendered = render_email(alert, test=test, preview=True)
    html, text = rendered["html"], rendered["text"]
    facts = alert["report"]["facts"]
    for value in (facts["region_name"], facts["origin_date"], facts["event_date"], f"{facts['sst_c']:.2f} °C", f"{facts['reference_c']:.2f} °C", f"{facts['sst_c']-facts['reference_c']:+.2f} °C", f"{facts['p90_c']:.2f} °C", facts["provider"]):
        assert value in html and value in text
    assert "YEREL ÖNİZLEME" in html and "YEREL ÖNİZLEME" in text
    assert "biyolojik zararı kanıtlamaz" in html and "biyolojik zararı kanıtlamaz" in text
    assert not re.search(r"<(?:img|svg|script|iframe|link)\b", html, re.IGNORECASE)
    assert 'role="presentation"' in html and 'scope="row"' in html
    for url in re.findall(r'href="([^"]+)"', html):
        assert urlsplit(url).netloc == "thermatwin.example"
        assert "subscriptions" in url or "history?mode=replay" in url
    if name == "manual-test":
        assert "TEST — ThermaTwin AI Geçmiş Analiz Raporu" in html
        assert "güncel bir uyarı değildir" in text and "[TEST]" in rendered["subject"]
    elif name == "forecast":
        assert "DENEYSEL TAHMİN" in html and "otomatik gönderimi kapalıdır" in text
        assert "Tahmin edilen SST" in text and "Ampirik tahmin aralığı" in text
    else:
        assert "Gözlemlenen Anomali" in html and "Gözlenen SST" in text
    assert notification_config()["mode"] == "shadow"
    assert notification_config()["automatic_approved"] is False
    assert notification_config()["forecast_enabled"] is False
    if name == "forecast":
        assert dispatch_mode(alert)[0] is None


@pytest.mark.parametrize("bad_url", ["javascript:alert(1)", "http://remote.example", "https://good.example@evil.example", "https://good.example/path", "https://good.example?next=evil", "https://good.example#evil", "https://good.example\\evil", "https://good.example\n", "https://good.example:bad", "https://good.example:0"])
def test_application_links_reject_ambiguous_or_unsafe_origins(monkeypatch, bad_url):
    monkeypatch.setenv("APP_URL", bad_url)
    _, alert, test = next(preview.previews())
    with pytest.raises(ValueError, match="APP_URL"):
        render_email(alert, test=test)


def test_local_http_is_development_only_and_report_text_and_fields_are_escaped(monkeypatch):
    _, alert, test = next(preview.previews())
    monkeypatch.setenv("APP_URL", "http://localhost:5173")
    assert "http://localhost:5173/history" in render_email(alert, test=test)["text"]
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValueError):
        render_email(alert, test=test)
    monkeypatch.setenv("APP_URL", "https://thermatwin.example")
    alert["report"]["text"] = '<script>alert("bad")</script>'
    alert["report"]["facts"]["region_name"] = '<img src=x onerror="bad">'
    html = render_email(alert, test=test)["html"]
    assert "<script>" not in html and "<img" not in html
    assert "&lt;script&gt;" in html and "&lt;img" in html
    alert["report"]["facts"]["sst_c"] = math.nan
    with pytest.raises(ValueError):
        render_email(alert, test=test)
