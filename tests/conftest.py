"""Local tests must never use real account credentials or provider transports."""

import httpx
import pytest


@pytest.fixture(autouse=True)
def isolated_provider_environment(monkeypatch):
    for name in (
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RESEND_API_KEY",
        "EMAIL_FROM",
        "REPLAY_TEST_EMAIL",
        "GEMINI_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    for name, value in {
        "APP_ENV": "test",
        "NOTIFICATION_MODE": "shadow",
        "AUTOMATIC_EMAILS_APPROVED": "false",
        "ENABLE_FORECAST_EMAILS": "false",
        "TEST_EMAIL_ENABLED": "false",
        "APP_URL": "https://thermatwin.example",
    }.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("VERCEL_ENV", raising=False)

    def block_network(*_args, **_kwargs):
        raise RuntimeError("External provider network disabled in unit tests; use a mock transport")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", block_network)
