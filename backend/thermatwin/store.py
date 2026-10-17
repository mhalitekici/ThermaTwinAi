"""Server-only Supabase REST adapter. Service credentials never enter public artifacts."""

from datetime import UTC, datetime

import httpx

from .config import required
from .supabase_auth import api_headers


class Store:
    def __init__(self):
        self.url = required("SUPABASE_URL").rstrip("/")
        self.key = required("SUPABASE_SERVICE_ROLE_KEY")
        self.client = httpx.Client(timeout=30, headers=api_headers(self.key))

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.client.close()

    def request(self, method: str, path: str, **kwargs):
        r = self.client.request(method, self.url + path, **kwargs)
        if r.is_error:
            # Avoid logging URLs containing tokens, response bodies or personal data.
            raise RuntimeError(
                f"Supabase işlem hatası ({r.status_code}). Migration/yapılandırmayı kontrol edin."
            )
        return r.json() if r.content else None

    def upsert(self, table: str, values: list[dict], conflict: str):
        if not values:
            return
        for i in range(0, len(values), 500):
            self.request(
                "POST",
                f"/rest/v1/{table}",
                params={"on_conflict": conflict},
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                json=values[i : i + 500],
            )

    def register(self, event: dict):
        result = self.request("POST", "/rest/v1/rpc/register_alert", json={"p_event": event})
        return result[0] if isinstance(result, list) else result

    def subscribers(self, region: str) -> list[dict]:
        return self.request(
            "GET",
            "/rest/v1/subscriptions",
            params={
                "region_id": f"eq.{region}",
                "active": "eq.true",
                "email_enabled": "eq.true",
                "select": "user_id,email_enabled,consent_version,consented_at",
            },
        )

    def user(self, user_id: str) -> dict:
        return self.request("GET", f"/auth/v1/admin/users/{user_id}")

    def claim(self, alert_id: str, user_id: str, payload: dict, *, dispatch_mode="shadow") -> dict | None:
        rows = self.request(
            "POST",
            "/rest/v1/rpc/claim_delivery",
            json={
                "p_alert": alert_id,
                "p_user": user_id,
                "p_payload": payload,
                "p_dispatch_mode": dispatch_mode,
            },
        )
        return rows[0] if rows else None

    def finish(self, delivery: dict, status: str, provider_id=None, error=None):
        self.request(
            "PATCH",
            "/rest/v1/deliveries",
            params={"id": f"eq.{delivery['id']}", "claim_token": f"eq.{delivery['claim_token']}"},
            json={
                "status": status,
                "provider_id": provider_id,
                "error": error,
                "lease_until": None,
                **({"sent_at": datetime.now(UTC).isoformat()} if status == "sent" else {}),
            },
        )
