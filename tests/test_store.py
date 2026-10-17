from datetime import datetime

from thermatwin.store import Store


def test_sent_timestamp_and_lease_token_filter(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only")
    calls = []
    with Store() as store:
        monkeypatch.setattr(store, "request", lambda *args, **kwargs: calls.append((args, kwargs)))
        store.finish(
            {"id": "fixture", "claim_token": "specific-lease"}, "sent", provider_id="provider-fixture"
        )
    payload = calls[0][1]["json"]
    assert datetime.fromisoformat(payload["sent_at"]).tzinfo is not None
    assert calls[0][1]["params"]["claim_token"] == "eq.specific-lease"
    assert payload["status"] == "sent"
