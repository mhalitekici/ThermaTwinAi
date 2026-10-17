import json

import httpx
from fastapi.testclient import TestClient
from thermatwin.api import app
from thermatwin.reports import generate_report

EVENT = {
    "region_name": "Akkuyu",
    "region_id": "akkuyu",
    "mode": "replay",
    "kind": "observed",
    "event_date": "2024-06-06",
    "origin_date": "2024-06-06",
    "sst_c": 28.5,
    "reference_c": 25.0,
    "p90_c": 26.0,
    "risk": "high",
    "provider": "SYNTHETIC TEST FIXTURE",
}


def test_report_fallback_facts_and_historical_label(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    report = generate_report(EVENT)
    assert report["method"] == "template"
    assert "GEÇMİŞ OLAY TEKRARI" in report["text"]
    assert "28.50" in report["text"] and "+3.50" in report["text"]
    assert report["facts"] == EVENT


def test_invalid_llm_output_cannot_add_claims(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only")

    def post(*_, **__):
        return httpx.Response(
            200,
            json={
                "candidates": [{"content": {"parts": [{"text": '{"codes":["99 degrees plant pollution"]}'}]}}]
            },
            request=httpx.Request("POST", "https://test.invalid"),
        )

    monkeypatch.setattr(httpx.Client, "post", post)
    assert generate_report(EVENT)["method"] == "template"
    assert "99" not in generate_report(EVENT)["text"]


def test_report_attached_to_event_can_be_serialized_for_database(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    event = {**EVENT, "data_quality": {"valid": True}}
    event["report"] = generate_report(event)
    encoded = json.loads(json.dumps(event, allow_nan=False))
    assert encoded["report"]["facts"]["sst_c"] == EVENT["sst_c"]
    event["data_quality"]["valid"] = False
    assert encoded["report"]["facts"]["data_quality"]["valid"]


def test_api_health_and_mode_validation():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/snapshot?mode=invalid").status_code == 400
        response = client.post("/replay", json={"send_email": True})
        assert response.status_code in (401, 409)
