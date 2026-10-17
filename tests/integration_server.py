"""TEST ONLY: Supabase/Resend protocol doubles + the REAL FastAPI mail engine.

No provider request can escape MockTransport. This module is never bundled or
imported by production. PostgreSQL/RLS semantics are tested separately in PGlite.
"""

import base64
import json
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.update(
    {
        "SUPABASE_URL": "http://127.0.0.1:5177",
        "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_test_service_only",
        "RESEND_API_KEY": "test-resend-only",
        "EMAIL_FROM": "test@thermatwin.invalid",
        "TEST_EMAIL_ENABLED": "true",
        "NOTIFICATION_MODE": "shadow",
        "AUTOMATIC_EMAILS_APPROVED": "false",
        "ENABLE_FORECAST_EMAILS": "false",
        "APP_URL": "http://127.0.0.1:5176",
        "ALLOWED_ORIGINS": "http://127.0.0.1:5176",
        "GEMINI_API_KEY": "",
    }
)
from thermatwin.api import app as real_api
from thermatwin.config import ROOT
from thermatwin.pipeline import event_candidates
from thermatwin.reports import generate_report
from thermatwin.store import Store

USERS = {
    "alice@example.test": "00000000-0000-0000-0000-000000000001",
    "bob@example.test": "00000000-0000-0000-0000-000000000002",
}
state = {}


def reset():
    state.clear()
    state.update(
        {
            "tokens": {},
            "subscriptions": {},
            "alerts": {},
            "deliveries": {},
            "mails": [],
            "runs": [],
            "otp_requests": [],
        }
    )


def user_record(email):
    return {
        "id": USERS[email],
        "aud": "authenticated",
        "role": "authenticated",
        "email": email,
        "email_confirmed_at": "2026-10-16T00:00:00Z",
        "confirmed_at": "2026-10-16T00:00:00Z",
        "created_at": "2026-10-16T00:00:00Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {},
        "identities": [],
    }


def session(email):
    def b64(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")

    token = (
        b64({"alg": "HS256", "typ": "JWT"})
        + "."
        + b64(
            {
                "sub": USERS[email],
                "aud": "authenticated",
                "email": email,
                "exp": int((datetime.now(UTC) + timedelta(hours=2)).timestamp()),
                "iat": int(datetime.now(UTC).timestamp()),
                "jti": str(uuid.uuid4()),
            }
        )
        + ".test-signature"
    )
    state["tokens"][token] = email
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 7200,
        "refresh_token": "fixture-refresh-" + email,
        "user": user_record(email),
    }


def provider(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    auth = request.headers.get("authorization", "").removeprefix("Bearer ")
    service = request.headers.get("apikey") == "sb_secret_test_service_only" and not auth
    email = state["tokens"].get(auth)
    uid = USERS.get(email)
    data = json.loads(request.content) if request.content else {}
    query = dict(request.url.params)

    def reply(value=None, status=200):
        return httpx.Response(
            status, json=value, request=request, headers={"x-supabase-api-version": "2024-01-01"}
        )

    if request.url.host == "api.resend.com":
        assert request.headers.get("authorization") == "Bearer test-resend-only"
        if request.method == "GET" and path.startswith("/emails/mock-resend-"):
            return reply({"last_event": "delivered"})
        assert path == "/emails" and request.method == "POST"
        state["mails"].append(data)
        return reply({"id": f"mock-resend-{len(state['mails'])}"})
    if request.url.host != "127.0.0.1":
        raise AssertionError("Unexpected external provider request in isolated tests")
    if path == "/auth/v1/otp":
        if data.get("email") not in USERS:
            return reply({"code": "invalid_credentials", "msg": "test user missing"}, 400)
        state["otp_requests"].append(data["email"])
        return reply({})
    if path == "/auth/v1/verify":
        if data.get("token") not in ("123456", "01234567", "0123456789") or data.get("email") not in USERS:
            return reply({"code": "otp_expired", "msg": "test OTP expired"}, 403)
        return reply(session(data["email"]))
    if path == "/auth/v1/token":
        return reply(session(data["refresh_token"].removeprefix("fixture-refresh-")))
    if path == "/auth/v1/logout":
        state["tokens"].pop(auth, None)
        return reply({})
    if path == "/auth/v1/user":
        return reply(user_record(email)) if email else reply({"message": "Unauthorized"}, 401)
    if path.startswith("/auth/v1/admin/users/") and service:
        target = path.rsplit("/", 1)[-1]
        address = next(e for e, u in USERS.items() if u == target)
        return reply(user_record(address))
    if path == "/rest/v1/snapshots":
        mode = query.get("mode", "eq.live").removeprefix("eq.")
        return reply(
            {
                "payload": json.loads(
                    (ROOT / f"public/{'replay' if mode == 'replay' else 'live'}.json").read_text(
                        encoding="utf8"
                    )
                )
            }
        )
    if path == "/rest/v1/subscriptions":
        if not uid and not service:
            return reply({"message": "Unauthorized"}, 401)
        if request.method != "GET":
            return reply({"message": "permission denied"}, 403)
        if service:
            return reply([r for r in state["subscriptions"].values() if r["active"] and r["email_enabled"]])
        row = state["subscriptions"].get(uid)
        if query.get("user_id", f"eq.{uid}") != f"eq.{uid}":
            row = None
        return reply(row)
    if path == "/rest/v1/rpc/manage_subscription":
        if not uid:
            return reply({"message": "Unauthorized"}, 401)
        action = data["p_action"]
        consent = data.get("p_consent") is True
        if action == "email_on" and not consent:
            return reply({"message": "Explicit consent required"}, 400)
        row = state["subscriptions"].get(
            uid,
            {
                "user_id": uid,
                "region_id": "akkuyu",
                "active": False,
                "email_enabled": False,
                "consented_at": None,
                "consent_version": None,
            },
        )
        if action == "subscribe":
            row["active"] = True
            row["email_enabled"] = consent
        elif action == "email_on" and row["active"]:
            row["email_enabled"] = True
        elif action in ("email_off", "cancel"):
            row["email_enabled"] = False
        if action == "cancel":
            row["active"] = False
        row["consented_at"] = datetime.now(UTC).isoformat() if row["email_enabled"] else None
        row["consent_version"] = "observed-info-v1" if row["email_enabled"] else None
        state["subscriptions"][uid] = row
        return reply(row)
    if path == "/rest/v1/rpc/register_alert" and service:
        event = data["p_event"]
        key = (event["mode"], event["kind"], event.get("episode_key") or event["event_date"])
        row = state["alerts"].get(key)
        if row is None:
            row = {
                "id": str(uuid.uuid4()),
                **{
                    k: event[k]
                    for k in ("region_id", "mode", "kind", "event_date", "dataset_id", "risk", "report")
                },
            }
            state["alerts"][key] = row
        return reply(row)
    if path == "/rest/v1/rpc/claim_delivery" and service:
        sub = state["subscriptions"].get(data["p_user"])
        if not sub or not sub["active"] or not sub["email_enabled"]:
            return reply([])
        key = (data["p_alert"], data["p_user"], data["p_dispatch_mode"])
        row = state["deliveries"].get(key)
        if row and row["status"] in ("sent", "sending", "shadow"):
            return reply([])
        if row is None:
            row = {
                "id": str(uuid.uuid4()),
                "alert_id": data["p_alert"],
                "user_id": data["p_user"],
                "payload": data["p_payload"],
                "dispatch_mode": data["p_dispatch_mode"],
                "created_at": datetime.now(UTC).isoformat(),
                "claim_token": str(uuid.uuid4()),
            }
            state["deliveries"][key] = row
        row["status"] = "shadow" if data["p_dispatch_mode"] == "shadow" else "sending"
        return reply([row])
    if path == "/rest/v1/deliveries":
        if request.method == "PATCH" and service:
            for row in state["deliveries"].values():
                if (
                    query.get("id") == f"eq.{row['id']}"
                    and query.get("claim_token") == f"eq.{row['claim_token']}"
                ):
                    row.update(data)
            return reply(None, 204)
        if service:
            return reply([
                {"status": row["status"], "provider_id": row.get("provider_id")}
                for row in state["deliveries"].values()
                if query.get("id") == f"eq.{row['id']}"
                and query.get("user_id") == f"eq.{row['user_id']}"
            ])
        if not uid:
            return reply({"message": "Unauthorized"}, 401)
        rows = []
        for row in state["deliveries"].values():
            if row["user_id"] == uid and query.get("user_id", f"eq.{uid}") == f"eq.{uid}":
                alert = next(a for a in state["alerts"].values() if a["id"] == row["alert_id"])
                rows.append(
                    {k: row[k] for k in ("id", "status", "created_at", "dispatch_mode")}
                    | {"alerts": {"mode": alert["mode"], "report": alert["report"]}}
                )
        return reply(rows)
    if path == "/rest/v1/monitor_runs" and service:
        state["runs"] += data
        return reply(None, 204)
    if (
        service
        and request.method == "POST"
        and path in ("/rest/v1/observations", "/rest/v1/forecasts", "/rest/v1/snapshots")
    ):
        return reply(None, 204)
    raise AssertionError(f"Unhandled TEST provider route: {request.method} {path}")


OriginalClient = httpx.Client


class IsolatedClient(OriginalClient):
    def __init__(self, *args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(provider)
        super().__init__(*args, **kwargs)


httpx.Client = IsolatedClient

app = FastAPI(title="TEST ONLY — no real email")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5176"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-supabase-api-version"],
)
app.mount("/api", real_api)


@app.get("/__test__/ready")
def ready():
    return {"test_only": True}


@app.post("/__test__/reset")
def reset_route():
    reset()
    return {"reset": True}


@app.get("/__test__/state")
def inspect_state():
    return {
        "mails": state["mails"],
        "subscriptions": list(state["subscriptions"].values()),
        "runs": state["runs"],
        "otp_requests": state["otp_requests"],
    }


@app.post("/__test__/monitor")
def monitor_replay():
    snap = json.loads((ROOT / "public/replay.json").read_text(encoding="utf8"))
    snap["stale"] = False
    with Store() as store:
        events = []
        for _, event in event_candidates(snap):
            event["report"] = generate_report(event, allow_llm=False)
            events.append(store.register(event))
        store.upsert(
            "monitor_runs",
            [
                {
                    "run_key": "TEST-historical-monitor",
                    "status": "shadow",
                    "observation_date": snap["origin_date"],
                }
            ],
            "run_key",
        )
    return {"mode": "TEST historical shadow", "alerts": len(events), "sent": 0}


@app.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def supabase_double(request: Request, path: str):
    response = provider(
        httpx.Request(
            request.method, str(request.url), headers=dict(request.headers), content=await request.body()
        )
    )
    return JSONResponse(
        response.json() if response.content else None,
        status_code=response.status_code,
        headers={"x-supabase-api-version": "2024-01-01"},
    )


reset()
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5177, access_log=False)
