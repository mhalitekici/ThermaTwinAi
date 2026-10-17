"""The no-send diagnostic must fail closed and never disclose provider details."""

import base64
import json

import httpx
import pytest
from thermatwin.integration_check import PRIVATE_TABLES, check_integrations
from thermatwin.store import Store
from thermatwin.supabase_auth import key_role


def configured_environment():
    return {
        "VITE_APP_MODE": "production",
        "VITE_SUPABASE_URL": "https://configured.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "sb_publishable_fixture_value",
        "SUPABASE_URL": "https://configured.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_fixture_value",
        "RESEND_API_KEY": "re_fixture_do_not_print",
        "EMAIL_FROM": "ThermaTwin AI <information@configured.test>",
        "SMTP_SENDER_EMAIL": "information@configured.test",
        "APP_URL": "http://127.0.0.1:5173",
        "VITE_API_URL": "http://127.0.0.1:8000",
        "ALLOWED_ORIGINS": "http://127.0.0.1:5173",
        "NOTIFICATION_MODE": "shadow",
        "AUTOMATIC_EMAILS_APPROVED": "false",
        "ENABLE_FORECAST_EMAILS": "false",
        "TEST_EMAIL_ENABLED": "true",
    }


def assert_redacted(result, env):
    output = json.dumps(result)
    for name in (
        "SUPABASE_SERVICE_ROLE_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "RESEND_API_KEY",
        "SUPABASE_URL",
        "EMAIL_FROM",
        "SMTP_SENDER_EMAIL",
    ):
        assert env[name] not in output


def test_local_check_never_requests_network_or_claims_live_acceptance():
    env = configured_environment()

    def no_request(request):
        pytest.fail("Local check attempted a provider request")

    result = check_integrations(env, transport=httpx.MockTransport(no_request))
    assert result["local_ready"] and result["remote_ready"] is None
    assert not result["live_acceptance_verified"] and result["emails_sent"] == 0
    assert_redacted(result, env)


def test_incomplete_environment_blocks_even_requested_remote_check():
    def no_request(request):
        pytest.fail("Incomplete configuration attempted a provider request")

    result = check_integrations({}, remote=True, transport=httpx.MockTransport(no_request))
    assert not result["local_ready"] and result["remote_ready"] is None
    assert any(c["name"] == "SUPABASE_URL" and c["status"] == "error" for c in result["checks"])


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("NOTIFICATION_MODE", "live"),
        ("AUTOMATIC_EMAILS_APPROVED", "true"),
        ("ENABLE_FORECAST_EMAILS", "true"),
        ("TEST_EMAIL_ENABLED", "yes"),
        ("SUPABASE_URL", "https://different.supabase.co"),
        ("VITE_API_URL", "http://external.test"),
        ("SUPABASE_URL", "https://username:password@configured.supabase.co"),
        ("ALLOWED_ORIGINS", "*"),
    ],
)
def test_unsafe_dispatch_or_connection_settings_block_preflight(name, value):
    env = {**configured_environment(), name: value}
    result = check_integrations(env)
    assert not result["local_ready"]
    assert_redacted(result, env)


def test_server_secret_cannot_be_hidden_in_arbitrary_vite_field():
    env = configured_environment()
    env["VITE_UNRELATED"] = env["SUPABASE_SERVICE_ROLE_KEY"]
    result = check_integrations(env)
    assert not result["local_ready"]
    assert next(c for c in result["checks"] if c["name"] == "client_secret_separation")["status"] == "error"
    assert_redacted(result, env)


def remote_handler(request):
    assert request.method == "GET"
    assert "authorization" not in request.headers  # New keys belong only in apikey.
    path = request.url.path
    if path == "/auth/v1/settings":
        assert request.headers["apikey"].startswith("sb_publishable_")
        return httpx.Response(200, json={"external": {"email": True}})
    assert path.startswith("/rest/v1/") and "/rpc/" not in path
    if request.headers["apikey"].startswith("sb_secret_"):
        assert request.url.params["limit"] == "0"
        return httpx.Response(200, json=[])
    if path == "/rest/v1/regions":
        return httpx.Response(200, json=[{"id": "akkuyu", "active": True}])
    assert path.rsplit("/", 1)[1] in PRIVATE_TABLES
    return httpx.Response(403, json={"message": "Permission denied"})


def test_remote_check_uses_only_gets_and_validates_current_schema_without_reading_personal_records():
    env = configured_environment()
    result = check_integrations(env, remote=True, transport=httpx.MockTransport(remote_handler))
    assert result["local_ready"] and result["remote_ready"]
    assert not result["live_acceptance_verified"]
    assert all(c["status"] == "ok" for c in result["checks"] if c["name"].startswith("schema_"))
    assert_redacted(result, env)


@pytest.mark.parametrize(
    "failure", ["missing_migration", "timeout", "redirect", "anonymous_leak", "bad_auth"]
)
def test_remote_failure_is_redacted_and_does_not_pass(failure):
    env = configured_environment()
    private_value = "PRIVATE_PROVIDER_VALUE_DO_NOT_PRINT"

    def handler(request):
        if failure == "bad_auth" and request.url.path == "/auth/v1/settings":
            return httpx.Response(200, json={"external": None})
        if request.url.path == "/rest/v1/subscriptions":
            if failure == "timeout":
                raise httpx.ReadTimeout(private_value, request=request)
            if failure == "missing_migration":
                return httpx.Response(400, json={"message": private_value})
            if failure == "redirect":
                return httpx.Response(302, headers={"Location": "https://credential-leak.invalid"})
            if failure == "anonymous_leak" and request.headers["apikey"].startswith("sb_publishable_"):
                return httpx.Response(200, json=[{"region_id": private_value}])
        return remote_handler(request)

    result = check_integrations(env, remote=True, transport=httpx.MockTransport(handler))
    assert result["remote_ready"] is False
    assert private_value not in json.dumps(result)
    assert_redacted(result, env)


@pytest.mark.parametrize("new_key", [False, True])
def test_store_headers_support_new_secret_and_legacy_service_role(monkeypatch, new_key):
    encoded = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode()).decode().rstrip("=")
    key = "sb_secret_fixture_value" if new_key else f"header.{encoded}.signature"
    monkeypatch.setenv("SUPABASE_URL", "https://configured.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", key)
    assert key_role(key) == "service_role"
    with Store() as store:
        assert store.client.headers["apikey"] == key
        if new_key:
            assert "authorization" not in store.client.headers
        else:
            assert store.client.headers["authorization"] == f"Bearer {key}"
    assert key_role("sb_secret_\nunsafe") is None
    assert key_role("not-a-key") is None
