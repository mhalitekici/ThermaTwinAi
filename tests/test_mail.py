from datetime import UTC, datetime

import httpx
import pytest
from thermatwin.mail import deliver


class FakeStore:
    """SYNTHETIC TEST FIXTURE; real database claims are checked in test-database.mjs."""

    def __init__(self):
        self.finished = []

    def subscribers(self, _):
        return [
            {
                "user_id": u,
                "email_enabled": True,
                "consent_version": "observed-info-v1",
                "consented_at": "2026-10-16",
            }
            for u in ("alice", "bob")
        ]

    def user(self, user):
        return {"email": f"{user}@example.test", "email_confirmed_at": "2024-01-01"}

    def claim(self, _alert, _user, payload, **__):
        return {
            "id": "delivery-fixture",
            "claim_token": "lease-fixture",
            "payload": {**payload, "text": "frozen report"},
        }

    def finish(self, *args, **kwargs):
        self.finished.append((args, kwargs))


@pytest.fixture
def config(monkeypatch):
    for name, value in {
        "RESEND_API_KEY": "test-key",
        "EMAIL_FROM": "test@example.test",
        "TEST_EMAIL_ENABLED": "true",
        "NOTIFICATION_MODE": "shadow",
        "AUTOMATIC_EMAILS_APPROVED": "false",
        "ENABLE_FORECAST_EMAILS": "false",
    }.items():
        monkeypatch.setenv(name, value)


@pytest.mark.parametrize("user_id", ["alice", "bob"])
def test_only_requested_verified_subscriber_receives_frozen_request(config, monkeypatch, user_id):
    # An obsolete value must not override the authenticated user's address.
    monkeypatch.setenv("REPLAY_TEST_EMAIL", "unrelated@example.test")
    sent = []

    def post(self, url, **kwargs):
        sent.append((url, kwargs))
        return httpx.Response(200, json={"id": "provider-test-id"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.Client, "post", post)
    store = FakeStore()
    alert = fixture_alert("replay")
    result = deliver(store, alert, only_user=user_id, manual_test=True)
    assert result["sent"] == 1 and len(sent) == 1
    assert sent[0][1]["json"]["text"] == "frozen report"
    assert sent[0][1]["json"]["to"] == [f"{user_id}@example.test"]
    assert sent[0][1]["headers"]["Idempotency-Key"] == "thermatwin/delivery-fixture"
    assert store.finished[0][0][1] == "sent"
    with pytest.raises(ValueError, match="tek doğrulanmış"):
        deliver(store, alert)


def test_changed_email_cannot_receive_a_frozen_request_for_another_address(config, monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(
        store,
        "claim",
        lambda *_a, **_k: {
            "id": "delivery-fixture",
            "claim_token": "lease-fixture",
            "payload": {"to": ["previous@example.test"]},
        },
    )
    monkeypatch.setattr(httpx.Client, "post", lambda *_a, **_k: pytest.fail("Changed recipient was sent"))
    result = deliver(store, fixture_alert("replay"), only_user="bob", manual_test=True)
    assert result["sent"] == 0 and result["skipped"] == 1
    assert store.finished[0][0][1] == "skipped"


def test_provider_timeout_recorded_as_failed(config, monkeypatch):
    monkeypatch.setenv("NOTIFICATION_MODE", "live")
    monkeypatch.setenv("AUTOMATIC_EMAILS_APPROVED", "true")

    def fail(*_, **__):
        raise httpx.ReadTimeout("synthetic test timeout")

    monkeypatch.setattr(httpx.Client, "post", fail)
    store = FakeStore()
    result = deliver(
        store,
        fixture_alert("live"),
        only_user="alice",
    )
    assert result["failed"] == 1
    assert store.finished[0][0][1] == "failed"


def fixture_alert(mode="live", kind="observed"):
    """Synthetic policy fixture; never used for ML scores or real messages."""
    today = datetime.now(UTC).date().isoformat()
    return {
        "id": "alert-fixture",
        "region_id": "akkuyu",
        "mode": mode,
        "kind": kind,
        "report": {
            "text": "changed generated report",
            "facts": {
                "mode": mode,
                "kind": kind,
                "provider": "Copernicus Marine",
                "region_name": "Akkuyu",
                "origin_date": today,
                "event_date": today,
                "sst_c": 28.0,
                "reference_c": 25.0,
                "p90_c": 27.0,
                "data_quality": {"valid": True, "stale": False, "complete_recent_days": 15},
            },
        },
    }


def test_shadow_needs_no_provider_key_and_forecast_is_blocked(config, monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY")
    monkeypatch.setattr(httpx.Client, "post", lambda *_a, **_k: pytest.fail("Provider called in shadow"))
    store = FakeStore()
    assert deliver(store, fixture_alert(), only_user="alice")["shadow"] == 1
    assert (
        deliver(store, fixture_alert(kind="predicted"), only_user="alice")["reason"]
        == "forecast_email_disabled"
    )
    monkeypatch.setenv("NOTIFICATION_MODE", "live")
    assert deliver(store, fixture_alert(), only_user="alice")["shadow"] == 1


def test_missing_stale_unconfirmed_and_no_consent_never_send(config, monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *_a, **_k: pytest.fail("Ineligible send"))
    store = FakeStore()
    alert = fixture_alert("replay")
    alert["report"]["facts"]["data_quality"]["complete_recent_days"] = 14
    assert deliver(store, alert, only_user="alice", manual_test=True)["sent"] == 0
    alert = fixture_alert()
    alert["report"]["facts"]["origin_date"] = "2024-01-01"
    alert["report"]["facts"]["event_date"] = "2024-01-01"
    assert deliver(store, alert, only_user="alice")["reason"] == "stale_or_future_observation"
    monkeypatch.setattr(store, "subscribers", lambda _: [{"user_id": "alice", "email_enabled": False}])
    assert deliver(store, fixture_alert("replay"), only_user="alice", manual_test=True)["sent"] == 0
    monkeypatch.setattr(
        store,
        "subscribers",
        lambda _: [
            {
                "user_id": "alice",
                "email_enabled": True,
                "consent_version": "observed-info-v1",
                "consented_at": "2026-10-16",
            }
        ],
    )
    monkeypatch.setattr(store, "user", lambda _: {"email": "alice@example.test"})
    assert deliver(store, fixture_alert("replay"), only_user="alice", manual_test=True)["sent"] == 0
