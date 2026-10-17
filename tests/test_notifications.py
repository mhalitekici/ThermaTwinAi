"""Notification boundary tests; all HTTP is mocked, no messages are sent."""

import hashlib
import importlib.util
import json
from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from thermatwin.api import app
from thermatwin.config import ROOT
from thermatwin.email_templates import render_email
from thermatwin.monitoring import run_once
from thermatwin.notification_policy import data_gate, dispatch_mode


def facts_alert():
    today = datetime.now(UTC).date().isoformat()
    return {
        "mode": "live",
        "kind": "observed",
        "report": {
            "text": "TEST fixture <script>bad()</script>",
            "facts": {
                "origin_date": today,
                "event_date": today,
                "region_name": "Akkuyu <img>",
                "sst_c": 28.0,
                "reference_c": 25.0,
                "p90_c": 27.0,
                "provider": "Copernicus Marine",
                "data_quality": {"valid": True, "stale": False, "complete_recent_days": 15},
            },
        },
    }


def test_data_gate_rejects_future_nan_no_exceedance_and_calendar_gaps():
    alert = facts_alert()
    assert data_gate(alert) is None
    facts = alert["report"]["facts"]
    facts["sst_c"] = float("nan")
    assert data_gate(alert) == "invalid_temperature"
    facts["sst_c"] = 26.0
    assert data_gate(alert) == "no_observed_exceedance"
    facts["sst_c"] = 28.0
    facts["origin_date"] = facts["event_date"] = "2099-01-01"
    assert data_gate(alert) == "stale_or_future_observation"
    facts["data_quality"]["complete_recent_days"] = 14
    assert data_gate(alert) == "unverified_or_incomplete_data"


def test_approval_and_test_flags_are_independent(monkeypatch):
    for key in (
        "AUTOMATIC_EMAILS_APPROVED",
        "ENABLE_FORECAST_EMAILS",
        "TEST_EMAIL_ENABLED",
        "NOTIFICATION_MODE",
    ):
        monkeypatch.delenv(key, raising=False)
    alert = facts_alert()
    assert dispatch_mode(alert)[0] == "shadow"
    monkeypatch.setenv("NOTIFICATION_MODE", "live")
    assert dispatch_mode(alert)[0] == "shadow"
    monkeypatch.setenv("AUTOMATIC_EMAILS_APPROVED", "true")
    assert dispatch_mode(alert)[0] == "live"
    alert["kind"] = "predicted"
    assert dispatch_mode(alert)[0] is None
    alert["kind"] = "observed"
    alert["mode"] = "replay"
    assert dispatch_mode(alert)[0] is None
    assert dispatch_mode(alert, manual_test=True, only_user="fixture")[0] is None
    monkeypatch.setenv("TEST_EMAIL_ENABLED", "true")
    assert dispatch_mode(alert, manual_test=True, only_user="fixture")[0] == "test"


def test_html_escapes_facts_and_has_plain_text_test_label(monkeypatch):
    monkeypatch.setenv("APP_URL", "https://thermatwin.example")
    alert = facts_alert()
    alert["mode"] = "replay"
    rendered = render_email(alert, test=True)
    assert "[TEST]" in rendered["subject"]
    assert "<script>" not in rendered["html"] and "&lt;script&gt;" in rendered["html"]
    assert "28.00 °C" in rendered["html"] and "25.00 °C" in rendered["html"]
    assert "/subscriptions" in rendered["html"]
    assert "güncel bir uyarı değildir" in rendered["text"]
    monkeypatch.setenv("APP_URL", "javascript:alert(1)")
    with pytest.raises(ValueError):
        render_email(alert, test=True)


@pytest.mark.parametrize(
    "variant,expected", [("expired", 401), ("unconfirmed", 403), ("missing_email", 403), ("timeout", 503)]
)
def test_test_email_authentication_gates(variant, expected, monkeypatch):
    for key, value in {
        "SUPABASE_URL": "https://mock.invalid",
        "SUPABASE_SERVICE_ROLE_KEY": "fixture-only",
        "RESEND_API_KEY": "fixture-only",
        "EMAIL_FROM": "test@example.test",
        "TEST_EMAIL_ENABLED": "true",
    }.items():
        monkeypatch.setenv(key, value)

    def get(_client, url, **_kwargs):
        if variant == "timeout":
            raise httpx.ReadTimeout("TEST ONLY")
        user = {
            "id": "test-user",
            "email": "" if variant == "missing_email" else "alice@example.test",
            "email_confirmed_at": None if variant == "unconfirmed" else "2026-10-16",
        }
        return httpx.Response(
            401 if variant == "expired" else 200, json=user, request=httpx.Request("GET", url)
        )

    monkeypatch.setattr(httpx.Client, "get", get)
    # TestClient.get itself subclasses httpx.Client, so POST directly invokes the API.
    with TestClient(app) as client:
        response = client.post(
            "/replay", json={"send_email": True}, headers={"Authorization": "Bearer TEST_ONLY"}
        )
        assert response.status_code == expected


@pytest.mark.parametrize("field", ["email", "user_id", "to"])
def test_replay_rejects_recipient_overrides_from_client(field):
    with TestClient(app) as client:
        response = client.post("/replay", json={"send_email": True, field: "another-account@example.test"})
        assert response.status_code == 422


def test_unknown_replay_cannot_be_submitted_for_email():
    with TestClient(app) as client:
        assert (
            client.post("/replay", json={"send_email": True, "origin_date": "2099-01-01"}).status_code == 404
        )


def test_monitoring_records_failure_and_never_retrains(monkeypatch):
    class LocalStore:
        def __init__(self):
            self.runs = []

        def upsert(self, table, rows, _):
            self.runs.extend(rows)

    store = LocalStore()
    monkeypatch.setenv("NOTIFICATION_MODE", "shadow")
    with pytest.raises(ValueError):
        run_once(store, None, {"provider": "wrong"}, {"source": {}}, run_key="test-run")
    assert [r["status"] for r in store.runs] == ["running", "failed"]
    assert "error_class" in store.runs[-1]["detail"]


def test_trusted_model_bundle_installation_is_hash_checked_and_non_overwriting(tmp_path, monkeypatch):
    path = ROOT / "scripts/prepare_monitor_model.py"
    spec = importlib.util.spec_from_file_location("test_prepare", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    content = ROOT / "artifacts/thermatwin-runtime.zip"
    if not content.exists():
        pytest.skip("Local model package not in clean checkout")
    expected = json.loads((ROOT / "docs/runtime-model-manifest.json").read_text(encoding="utf8"))
    monkeypatch.setattr(module, "ROOT", tmp_path)
    module.install_bundle(content.read_bytes(), expected)
    installed = tmp_path / "artifacts" / expected["dataset_id"] / "model.joblib"
    assert hashlib.sha256(installed.read_bytes()).hexdigest() == expected["model_sha256"]
    installed.write_bytes(b"OTHER TRUSTED LOCAL MODEL - DO NOT OVERWRITE")
    with pytest.raises(ValueError):
        module.install_bundle(content.read_bytes(), expected)
    assert installed.read_bytes().startswith(b"OTHER TRUSTED")
    with pytest.raises(ValueError):
        module.install_bundle(content.read_bytes() + b"tampered", expected)


def test_real_historical_observation_runs_through_shadow_monitor_without_provider(monkeypatch):
    import joblib
    from thermatwin import notification_policy, pipeline
    from thermatwin.ingest import load_series

    model_path = ROOT / "artifacts/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2/model.joblib"
    if not model_path.exists():
        pytest.skip("Real artifacts not in clean checkout")

    class HistoricalClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2024, 6, 7, tzinfo=UTC)

    monkeypatch.setattr(pipeline, "datetime", HistoricalClock)
    monkeypatch.setattr(notification_policy, "datetime", HistoricalClock)
    monkeypatch.setenv("NOTIFICATION_MODE", "shadow")
    monkeypatch.setenv("AUTOMATIC_EMAILS_APPROVED", "false")
    monkeypatch.setenv("ENABLE_FORECAST_EMAILS", "false")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(
        httpx.Client, "post", lambda *_a, **_k: pytest.fail("Shadow monitor made a provider request")
    )

    class ShadowStore:
        def __init__(self):
            self.alerts = {}
            self.claims = set()
            self.runs = []

        def upsert(self, table, rows, _):
            if table == "monitor_runs":
                self.runs.extend(rows)

        def register(self, event):
            json.dumps(event, allow_nan=False)
            self.alerts.setdefault(event["kind"], {"id": event["kind"], **event})
            return self.alerts[event["kind"]]

        def subscribers(self, _):
            return [
                {
                    "user_id": "fixture",
                    "email_enabled": True,
                    "consent_version": "observed-info-v1",
                    "consented_at": "2024-06-01",
                }
            ]

        def user(self, _):
            return {"email": "fixture@example.test", "email_confirmed_at": "2024-06-01"}

        def claim(self, alert, user, payload, *, dispatch_mode):
            assert dispatch_mode == "shadow"
            key = (alert, user, dispatch_mode)
            if key in self.claims:
                return None
            self.claims.add(key)
            return {"id": "fixture", "payload": payload}

    frame, source = load_series("copernicus")
    frame = frame.loc[:"2024-06-07"]
    source = {**source, "last_observation": "2024-06-07", "valid_days": len(frame)}
    bundle = joblib.load(model_path)
    store = ShadowStore()
    snap, first = run_once(store, frame, source, bundle, run_key="TEST-historical-shadow")
    assert snap["observation"]["mhw"] and first["sent"] == 0 and first["shadow"] == 1
    _, second = run_once(store, frame, source, bundle, run_key="TEST-historical-shadow")
    assert second["shadow"] == 0 and second["sent"] == 0
    assert store.runs[-1]["status"] == "shadow"
