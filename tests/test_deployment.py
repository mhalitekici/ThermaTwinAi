import json

import pytest
from fastapi.testclient import TestClient
from thermatwin.api import app
from thermatwin.config import ROOT
from thermatwin.deployment import validate_runtime
from thermatwin.notification_policy import dispatch_mode, notification_config
from thermatwin.store import Store


def hosted(monkeypatch):
    for key, value in {
        "APP_ENV": "production",
        "APP_URL": "https://thermatwin.example",
        "ALLOWED_ORIGINS": "https://thermatwin.example",
        "SUPABASE_URL": "https://project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "fixture",
        "RESEND_API_KEY": "fixture",
        "EMAIL_FROM": "test@example.test",
    }.items():
        monkeypatch.setenv(key, value)


@pytest.mark.parametrize("marker", ["APP_ENV", "VERCEL_ENV"])
def test_preview_disables_all_delivery_even_if_production_flags_leaked(monkeypatch, marker):
    monkeypatch.setenv(marker, "preview")
    for key, value in {
        "TEST_EMAIL_ENABLED": "true",
        "AUTOMATIC_EMAILS_APPROVED": "true",
        "ENABLE_FORECAST_EMAILS": "true",
        "NOTIFICATION_MODE": "live",
    }.items():
        monkeypatch.setenv(key, value)
    assert notification_config() == {
        "mode": "shadow",
        "automatic_approved": False,
        "forecast_enabled": False,
        "test_enabled": False,
    }
    assert (
        dispatch_mode({"kind": "observed", "mode": "replay"}, manual_test=True, only_user="alice")[0] is None
    )


@pytest.mark.parametrize(
    "origin", ["*", "https://*.vercel.app", "http://localhost:5173", "https://app.test/path", "null"]
)
def test_production_cors_rejects_broad_or_non_origin_values(monkeypatch, origin):
    hosted(monkeypatch)
    monkeypatch.setenv("ALLOWED_ORIGINS", origin)
    with pytest.raises(ValueError):
        validate_runtime()


def test_production_requires_explicit_configuration_and_matching_app_origin(monkeypatch):
    hosted(monkeypatch)
    validate_runtime()
    monkeypatch.setenv("APP_URL", "https://other.example")
    with pytest.raises(ValueError):
        validate_runtime()
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY")
    with pytest.raises(ValueError):
        validate_runtime()


def test_disallowed_browser_origin_cannot_trigger_server_side_email_work():
    with TestClient(app) as client:
        response = client.post(
            "/replay", json={"send_email": True}, headers={"Origin": "https://untrusted.example"}
        )
        assert response.status_code == 403
        assert client.get("/health").headers["cache-control"] == "no-store"


def test_hosted_live_snapshot_reads_shared_storage_instead_of_local_artifacts(monkeypatch):
    hosted(monkeypatch)
    snapshot = json.loads((ROOT / "public/live.json").read_text(encoding="utf-8"))
    requests = []

    def read(_store, method, path, **kwargs):
        requests.append((method, path, kwargs))
        return [{"payload": snapshot}]

    monkeypatch.setattr(Store, "request", read)
    with TestClient(app) as client:
        response = client.get("/snapshot?mode=live")
    assert response.status_code == 200
    assert response.json()["origin_date"] == snapshot["origin_date"]
    assert requests[0][0:2] == ("GET", "/rest/v1/snapshots")
    assert requests[0][2]["params"]["mode"] == "eq.live"


def test_hosted_storage_failure_does_not_fall_back_to_a_bundled_live_snapshot(monkeypatch):
    hosted(monkeypatch)

    def fail(*_args, **_kwargs):
        raise RuntimeError("PRIVATE provider failure")

    monkeypatch.setattr(Store, "request", fail)
    with TestClient(app) as client:
        response = client.get("/snapshot?mode=live")
    assert response.status_code == 503
    assert "PRIVATE" not in response.text
