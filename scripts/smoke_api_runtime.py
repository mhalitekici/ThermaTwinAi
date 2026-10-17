"""Exercise the shipping HTTP dependency set without models, secrets or provider traffic."""

import importlib.util
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
target = os.environ.get("APP_ENV")
assert target in {"preview", "production"}, "Run this smoke check with an explicit deployment environment."
for module in ("numpy", "pandas", "xgboost", "matplotlib", "copernicusmarine"):
    assert importlib.util.find_spec(module) is None, f"Scientific dependency unexpectedly installed: {module}"

import httpx
from fastapi.testclient import TestClient
from thermatwin.api import app


def no_provider_network(*_args, **_kwargs):
    raise httpx.ConnectError("Provider network disabled for the isolated runtime smoke check")


httpx.HTTPTransport.handle_request = no_provider_network

with TestClient(app) as client:
    health = client.get("/health")
    assert health.status_code == 200
    flags = health.json()["notifications"]
    assert flags["mode"] == "shadow" and not flags["automatic_enabled"] and not flags["test_enabled"]
    replay = client.get("/snapshot?mode=replay&origin_date=2024-06-07")
    assert replay.status_code == 200
    assert replay.json()["origin_date"] == "2024-06-07"
    assert len(replay.json()["forecasts"]) == 3
    assert client.get("/snapshot?mode=live").status_code == (503 if target == "production" else 200)
    if target == "preview":
        blocked = client.post(
            "/replay", json={"send_email": True}, headers={"Authorization": "Bearer TEST_ONLY"}
        )
        assert blocked.status_code == 409
    else:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404
        assert client.post("/replay", json={"send_email": True}).status_code == 401
    assert (
        client.post(
            "/replay", json={"send_email": True}, headers={"Origin": "https://untrusted.example"}
        ).status_code
        == 403
    )
    assert client.get("/deliveries/10000000-0000-0000-0000-000000000001/status").status_code == 401
print(f"API runtime smoke passed ({target}): no ML packages, no external requests, dispatch protected.")
