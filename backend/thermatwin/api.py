import json
import os
import threading
from datetime import UTC, date, datetime
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

from .config import ROOT
from .mail import deliver
from .notification_policy import notification_config
from .pipeline import event_candidates, replay_path
from .reports import generate_report
from .store import Store
from .warning import decide

app = FastAPI(title="ThermaTwin AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
replay_lock = threading.Lock()


def authenticated_user(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Doğrulanmış Supabase oturumu gerekli.")
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise HTTPException(503, "Oturum doğrulama yapılandırması eksik.")
    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(
                os.environ["SUPABASE_URL"].rstrip("/") + "/auth/v1/user",
                headers={"apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": authorization},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Oturum doğrulama servisine erişilemiyor.") from None
    if response.status_code != 200:
        raise HTTPException(401, "Geçersiz oturum. Yeniden giriş yapın.")
    user = response.json()
    if not user.get("id") or not user.get("email_confirmed_at") or not user.get("email", "").strip():
        raise HTTPException(403, "TEST e-postası için giriş yaptığınız hesabın e-postasını doğrulayın.")
    return user


@app.get("/health")
def health():
    return {
        "status": "ok",
        "live_configured": bool(os.getenv("SUPABASE_URL")),
        "replay_available": replay_path().exists(),
        "notifications": {
            "mode": notification_config()["mode"],
            "automatic_enabled": notification_config()["mode"] == "live"
            and notification_config()["automatic_approved"],
            "forecast_enabled": notification_config()["forecast_enabled"],
            "test_enabled": notification_config()["test_enabled"],
            "test_configured": all(os.getenv(k) for k in (
                "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_FROM"
            )),
            "test_recipient_policy": "authenticated_user",
        },
    }


@app.get("/deliveries/{delivery_id}/status")
def delivery_status(delivery_id: UUID, authorization: str | None = Header(default=None)):
    user = authenticated_user(authorization)
    try:
        with Store() as store:
            rows = store.request("GET", "/rest/v1/deliveries", params={
                "id": f"eq.{delivery_id}", "user_id": f"eq.{user['id']}",
                "select": "status,provider_id", "limit": "1",
            })
    except (RuntimeError, httpx.HTTPError):
        raise HTTPException(503, "Bildirim kaydı okunamadı. Yeniden deneyin.") from None
    if not rows:
        raise HTTPException(404, "Bu hesaba ait bildirim bulunamadı.")
    result = {"status": rows[0]["status"], "provider_status": None}
    provider_id = rows[0].get("provider_id")
    if result["status"] != "sent" or not provider_id:
        return result
    if not os.getenv("RESEND_API_KEY"):
        raise HTTPException(503, "Teslim sorgulama yapılandırması eksik.")
    try:
        # Only query the provider ID from this authenticated user's stored delivery.
        with httpx.Client(timeout=15) as client:
            response = client.get(
                f"https://api.resend.com/emails/{provider_id}",
                headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
            )
            response.raise_for_status()
            event = response.json().get("last_event")
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Teslim durumu alınamadı. Sağlayıcı okuma yetkisini kontrol edin veya yeniden deneyin.") from None
    known = {"sent", "delivered", "delivery_delayed", "bounced", "complained", "opened", "clicked", "failed", "suppressed", "scheduled", "queued"}
    result["provider_status"] = event if event in known else None
    return result


@app.get("/snapshot")
def get_snapshot(mode: str = "live", origin_date: str | None = None):
    if mode not in ("live", "replay"):
        raise HTTPException(400, "Geçersiz mod")
    path = replay_path() if mode == "replay" else ROOT / "artifacts/live.json"
    if not path.exists():
        return {"status": "unavailable", "mode": mode, "message": "Henüz doğrulanmış veri yok."}
    snap = json.loads(path.read_text(encoding="utf-8"))
    if origin_date:
        if mode != "replay":
            raise HTTPException(400, "Tarih seçimi yalnız geçmiş tekrarında kullanılabilir.")
        candidates = [snap]
        for name in ("replay-events", "reliability-replays"):
            catalog = ROOT / f"public/{name}.json"
            if catalog.exists():
                candidates += json.loads(catalog.read_text(encoding="utf-8"))["events"]
        snap = next((item for item in candidates if item["origin_date"] == origin_date), None)
        if snap is None:
            raise HTTPException(404, "Seçilen gerçek geçmiş olay bulunamadı.")
    overlay_path = ROOT / "public/reliability-snapshots.json"
    if not snap.get("early_warning") and overlay_path.exists():
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
        candidate = next(
            (
                s
                for s in overlay["snapshots"]
                if s["mode"] == mode and s["origin_date"] == snap["origin_date"]
            ),
            None,
        )
        if candidate and overlay["dataset_id"] == snap["source"]["dataset_id"]:
            if any(
                a["sst_c"] != b["sst_c"] or a["target_date"] != b["target_date"]
                for a, b in zip(snap["forecasts"], candidate["forecasts"], strict=True)
            ):
                raise HTTPException(409, "Uyarı politikası mevcut tahminlerle eşleşmiyor.")
            snap.update(candidate)
    if mode == "live":
        snap["age_days"] = max(
            0, (datetime.now(UTC).date() - datetime.fromisoformat(snap["origin_date"]).date()).days
        )
        snap["stale"] = snap["stale"] or snap["age_days"] > 3
        if snap["stale"]:
            snap["reports"] = []
            snap["early_warning"] = {
                **(snap.get("early_warning") or {}),
                **decide(snap["observation"], snap["forecasts"], snap["origin_date"], stale=True),
                "data_date": snap["origin_date"],
                "notify": False,
                "alert_id": None,
                "suppression_reason": "Güncel olmayan veri.",
            }
    return snap


class ReplayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    send_email: bool = False
    origin_date: date | None = None


@app.post("/replay")
def run_replay(body: ReplayRequest, authorization: str | None = Header(default=None)):
    snap = get_snapshot("replay", body.origin_date.isoformat() if body.origin_date else None)
    if snap["status"] != "ready":
        raise HTTPException(409, "Önce gerçek veriyle replay artifact üretin.")
    if not body.send_email:
        return {"snapshot": snap, "delivery": "not_requested"}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Doğrulanmış Supabase oturumu gerekli.")
    if not notification_config()["test_enabled"]:
        raise HTTPException(409, "Manuel TEST gönderimi kapalı; otomatik gönderimler shadow modunda.")
    if not all(
        os.getenv(k)
        for k in (
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "RESEND_API_KEY",
            "EMAIL_FROM",
        )
    ):
        raise HTTPException(503, "Test e-postası için sunucu yapılandırması eksik.")
    user = authenticated_user(authorization)
    if not replay_lock.acquire(blocking=False):
        raise HTTPException(429, "Bir tekrar çalışması sürüyor.")
    try:
        with Store() as store:
            if not any(
                s["user_id"] == user["id"]
                and s.get("email_enabled")
                and s.get("consented_at")
                and s.get("consent_version") == "observed-info-v1"
                for s in store.subscribers("akkuyu")
            ):
                raise HTTPException(
                    409, "Önce Akkuyu aboneliğini açıp bilgi e-postaları için açık onay verin."
                )
            results = []
            for kind, event in event_candidates(snap):
                # One observed historical event is sufficient for the jury test mail.
                if kind != "observed":
                    continue
                event["report"] = generate_report(event)
                results.append(deliver(store, store.register(event), user["id"], manual_test=True))
            if not results:
                raise HTTPException(409, "Bu tarihte TEST için gözlemlenmiş eşik aşımı yok. 7 Haziran 2024 olayını seçin.")
            return {"delivery": results}
    except (RuntimeError, httpx.HTTPError):
        raise HTTPException(503, "Gönderim kaydı işlenemedi. Bağlantıyı ve bildirim geçmişini kontrol edip yeniden deneyin.") from None
    finally:
        replay_lock.release()
