"""Delivery read-back is authenticated, owner-scoped, and never sends a message."""

import httpx
import pytest
from fastapi.testclient import TestClient
from thermatwin.api import app
from thermatwin.store import Store

DELIVERY = "10000000-0000-0000-0000-000000000001"


@pytest.fixture
def status_service(monkeypatch):
    for name, value in {
        "SUPABASE_URL": "https://supabase.example.test",
        "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_fixture",
        "RESEND_API_KEY": "fixture-only",
    }.items():
        monkeypatch.setenv(name, value)
    calls = []
    original_get = httpx.Client.get

    def mock_get(_self, url, **kwargs):
        if isinstance(_self, TestClient):
            return original_get(_self, url, **kwargs)
        calls.append((url, kwargs))
        if url.endswith("/auth/v1/user"):
            body = {"id": "alice", "email": "alice@example.test", "email_confirmed_at": "2026-10-16"}
        else:
            assert url == "https://api.resend.com/emails/provider-fixture"
            body = {"last_event": "delivered", "to": ["PRIVATE"], "html": "PRIVATE"}
        return httpx.Response(200, json=body, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    def database(_self, method, path, **kwargs):
        assert method == "GET" and path == "/rest/v1/deliveries"
        assert kwargs["params"]["id"] == f"eq.{DELIVERY}"
        assert kwargs["params"]["user_id"] == "eq.alice"
        calls.append((path, kwargs))
        return [{"status": "sent", "provider_id": "provider-fixture"}]

    monkeypatch.setattr(Store, "request", database)
    return calls


def test_delivery_status_requires_authentication():
    with TestClient(app) as client:
        assert client.get(f"/deliveries/{DELIVERY}/status").status_code == 401


def test_status_read_is_owner_scoped_and_does_not_return_provider_content(status_service):
    with TestClient(app) as client:
        result = client.get(f"/deliveries/{DELIVERY}/status", headers={"Authorization": "Bearer fixture"})
    assert result.status_code == 200
    assert result.json() == {"status": "sent", "provider_status": "delivered"}
    assert len(status_service) == 3
    assert "PRIVATE" not in result.text


def test_other_accounts_delivery_is_not_queried_at_provider(status_service, monkeypatch):
    monkeypatch.setattr(Store, "request", lambda *_args, **_kwargs: [])
    with TestClient(app) as client:
        result = client.get(f"/deliveries/{DELIVERY}/status", headers={"Authorization": "Bearer fixture"})
    assert result.status_code == 404
    assert not any("api.resend.com" in url for url, _ in status_service)


@pytest.mark.parametrize("event", ["bounced", "delivery_delayed", "complained", "unexpected-provider-content"])
def test_provider_event_is_explicit_and_allowlisted(status_service, monkeypatch, event):
    get = httpx.Client.get

    def provider(self, url, **kwargs):
        if "api.resend.com" in url:
            return httpx.Response(200, json={"last_event": event}, request=httpx.Request("GET", url))
        return get(self, url, **kwargs)

    monkeypatch.setattr(httpx.Client, "get", provider)
    with TestClient(app) as client:
        result = client.get(f"/deliveries/{DELIVERY}/status", headers={"Authorization": "Bearer fixture"})
    assert result.json()["provider_status"] == (None if event.startswith("unexpected") else event)


def test_provider_failure_keeps_acceptance_distinct_from_delivery(status_service, monkeypatch):
    get = httpx.Client.get

    def unavailable(self, url, **kwargs):
        if "api.resend.com" in url:
            raise httpx.ReadTimeout("PRIVATE provider response")
        return get(self, url, **kwargs)

    monkeypatch.setattr(httpx.Client, "get", unavailable)
    with TestClient(app) as client:
        result = client.get(f"/deliveries/{DELIVERY}/status", headers={"Authorization": "Bearer fixture"})
    assert result.status_code == 503
    assert "PRIVATE" not in result.text
