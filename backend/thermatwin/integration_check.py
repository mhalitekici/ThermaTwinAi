"""Read-only integration diagnostics. No OTP, RPC, database writes or mail sends."""

from collections.abc import Mapping
from email.utils import getaddresses
from urllib.parse import urlsplit

import httpx

from .supabase_auth import api_headers, key_role

TABLE_COLUMNS = {
    "regions": "id,active",
    "subscriptions": "user_id,region_id,active,email_enabled,consent_version,consented_at",
    "subscription_events": "id,user_id,region_id,action,consent_version",
    "observations": "region_id,observed_on,sst_c,dataset_id",
    "forecasts": "region_id,origin_date,horizon_days,target_date,lower_c,upper_c",
    "snapshots": "region_id,mode,payload,updated_at",
    "alerts": "id,episode_key,kind,report",
    "deliveries": "id,user_id,dispatch_mode,status,claim_token,first_attempt_at",
    "monitor_runs": "id,run_key,status,dispatch_mode,finished_at",
}
PRIVATE_TABLES = ("subscriptions", "subscription_events", "alerts", "deliveries", "monitor_runs")


def _url(value: str, *, root=False) -> str | None:
    try:
        parsed = urlsplit(value)
        local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or (parsed.scheme != "https" and not local)
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or (root and parsed.path not in ("", "/"))
        ):
            return None
        # Accessing port also validates it; never include the supplied value in an error.
        _ = parsed.port
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    except ValueError:
        return None


def _address(value: str, *, plain=False) -> bool:
    if "\r" in value or "\n" in value:
        return False
    addresses = getaddresses([value])
    if len(addresses) != 1:
        return False
    address = addresses[0][1]
    if plain and address != value:
        return False
    return bool(
        address.count("@") == 1
        and address.split("@")[0]
        and "." in address.split("@")[1]
        and not any(char.isspace() for char in address)
    )


def check_integrations(
    environment: Mapping[str, str], *, remote=False, transport: httpx.BaseTransport | None = None
) -> dict:
    """Return only fixed messages/field names, never values, provider bodies or exceptions."""
    env = {name: value.strip() for name, value in environment.items() if isinstance(value, str)}
    checks = []

    def add(name, passed, ok_message, error_message):
        checks.append(
            {
                "name": name,
                "status": "ok" if passed else "error",
                "message": ok_message if passed else error_message,
            }
        )

    required = (
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "VITE_API_URL",
        "APP_URL",
        "ALLOWED_ORIGINS",
        "RESEND_API_KEY",
        "EMAIL_FROM",
        "SMTP_SENDER_EMAIL",
    )
    for name in required:
        add(
            name,
            bool(env.get(name)),
            "Alan tanımlı; gerçek servis doğrulaması ayrıca gerekir.",
            "Alan eksik.",
        )
    add(
        "app_mode",
        env.get("VITE_APP_MODE") == "production",
        "Bağlı uygulama modu seçili.",
        "Canlı kabul testi için VITE_APP_MODE=production gerekli.",
    )

    server_url = _url(env.get("SUPABASE_URL", ""), root=True)
    public_url = _url(env.get("VITE_SUPABASE_URL", ""), root=True)
    add(
        "supabase_urls",
        bool(server_url and public_url and server_url == public_url),
        "İstemci ve sunucu aynı geçerli proje adresini kullanıyor.",
        "Supabase adresleri aynı kök HTTPS adresi olmalı; HTTP yalnız localhost için geçerli.",
    )
    add(
        "public_key_format",
        key_role(env.get("VITE_SUPABASE_ANON_KEY", "")) == "anon",
        "Public/publishable anahtar biçimi uygun; henüz doğrulanmadı.",
        "İstemci alanında publishable/anon anahtar gerekli.",
    )
    add(
        "server_key_format",
        key_role(env.get("SUPABASE_SERVICE_ROLE_KEY", "")) == "service_role",
        "Sunucu secret/service-role anahtar biçimi uygun; henüz doğrulanmadı.",
        "Sunucu alanında secret/service-role anahtar gerekli.",
    )
    secrets = {env[name] for name in ("SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY") if env.get(name)}
    exposed_secret = any(
        value
        and name.startswith("VITE_")
        and (
            any(token in name.upper() for token in ("SERVICE_ROLE", "RESEND", "SECRET", "PASSWORD"))
            or value in secrets
            or key_role(value) == "service_role"
        )
        for name, value in env.items()
    )
    add(
        "client_secret_separation",
        not exposed_secret,
        "İstemci alanlarında sunucu sırrı saptanmadı.",
        "VITE_ alanında sunucu sırrı bulundu; değeri kaldırın ve gerekiyorsa anahtarı yenileyin.",
    )

    app_origin = _url(env.get("APP_URL", ""))
    api_origin = _url(env.get("VITE_API_URL", ""))
    allowed = [part.strip() for part in env.get("ALLOWED_ORIGINS", "").split(",") if part.strip()]
    add(
        "app_api_origins",
        bool(
            app_origin
            and api_origin
            and app_origin in allowed
            and all(_url(origin, root=True) for origin in allowed)
        ),
        "Uygulama/API adresleri geçerli ve uygulama origin'i CORS listesinde.",
        "APP_URL, VITE_API_URL ve açık ALLOWED_ORIGINS listesini kontrol edin.",
    )
    for name in ("EMAIL_FROM", "SMTP_SENDER_EMAIL"):
        add(
            f"{name}_format",
            _address(env.get(name, ""), plain=name != "EMAIL_FROM"),
            "Tek e-posta adresi biçimi uygun; domain/teslim henüz doğrulanmadı.",
            "Tek geçerli e-posta adresi gerekli.",
        )

    safe = env.get("NOTIFICATION_MODE", "shadow") == "shadow" and all(
        env.get(name, "false") == "false" for name in ("AUTOMATIC_EMAILS_APPROVED", "ENABLE_FORECAST_EMAILS")
    )
    add(
        "notification_safety",
        safe,
        "Shadow etkin; otomatik ve tahmin e-postaları kapalı.",
        "Bu aşamada NOTIFICATION_MODE=shadow, AUTOMATIC_EMAILS_APPROVED=false ve ENABLE_FORECAST_EMAILS=false gerekli.",
    )
    add(
        "manual_test_flag",
        env.get("TEST_EMAIL_ENABLED", "false") in ("true", "false"),
        "Manuel TEST bayrağı geçerli; bu komut e-posta göndermez.",
        "TEST_EMAIL_ENABLED true veya false olmalı.",
    )
    local_ready = not any(check["status"] == "error" for check in checks)
    remote_ready = None
    if remote and local_ready:
        remote_checks = _remote_checks(env, transport)
        checks.extend(remote_checks)
        remote_ready = not any(check["status"] == "error" for check in remote_checks)
    else:
        checks.append(
            {
                "name": "remote_checks",
                "status": "pending",
                "message": (
                    "Yerel eksikler nedeniyle uzak kontrol yapılmadı."
                    if remote
                    else "Uzak kontrol istenmedi; yalnız yerel yapılandırma incelendi."
                ),
            }
        )
    checks.extend(
        [
            {
                "name": "hosted_smtp_domain",
                "status": "pending",
                "message": "Resend domain/DNS ve hosted SMTP/OTP şablonları Dashboard'da ayrıca doğrulanmalı.",
            },
            {
                "name": "live_acceptance",
                "status": "pending",
                "message": "Gerçek OTP, iki oturumla kullanıcı izolasyonu ve TEST gelen kutusu teslimi ayrıca doğrulanmalı.",
            },
        ]
    )
    return {
        "local_ready": local_ready,
        "remote_checks_requested": remote,
        "remote_ready": remote_ready,
        "live_acceptance_verified": False,
        "emails_sent": 0,
        "checks": checks,
    }


def _remote_checks(env: Mapping[str, str], transport) -> list[dict]:
    checks = []
    url = env["SUPABASE_URL"].rstrip("/")
    public_headers = api_headers(env["VITE_SUPABASE_ANON_KEY"])
    server_headers = api_headers(env["SUPABASE_SERVICE_ROLE_KEY"])
    with httpx.Client(timeout=10, follow_redirects=False, transport=transport) as client:

        def get(name, path, headers, *, params=None):
            try:
                response = client.get(url + path, headers=headers, params=params)
                if response.status_code != 200:
                    checks.append(
                        {
                            "name": name,
                            "status": "error",
                            "message": f"Salt okunur kontrol başarısız (HTTP {response.status_code}); erişim/şemayı kontrol edin.",
                        }
                    )
                    return None
                return response.json()
            except (httpx.HTTPError, ValueError):
                checks.append(
                    {
                        "name": name,
                        "status": "error",
                        "message": "Bağlantı/zaman aşımı veya geçersiz yanıt; gizli servis ayrıntıları gösterilmedi.",
                    }
                )
                return None

        settings = get("auth_settings", "/auth/v1/settings", public_headers)
        if settings is not None:
            external = settings.get("external") if isinstance(settings, dict) else None
            ok = isinstance(external, dict) and external.get("email") is True
            checks.append(
                {
                    "name": "auth_settings",
                    "status": "ok" if ok else "error",
                    "message": (
                        "Public Auth erişimi ve e-posta sağlayıcısı doğrulandı; OTP gönderilmedi."
                        if ok
                        else "Auth e-posta sağlayıcısını kontrol edin."
                    ),
                }
            )
        for table, columns in TABLE_COLUMNS.items():
            rows = get(
                f"schema_{table}",
                f"/rest/v1/{table}",
                server_headers,
                params={"select": columns, "limit": "0"},
            )
            if rows is not None:
                checks.append(
                    {
                        "name": f"schema_{table}",
                        "status": "ok" if rows == [] else "error",
                        "message": "Sunucu erişimi ve beklenen kolonlar kontrol edildi; satır alınmadı."
                        if rows == []
                        else "Beklenmeyen şema yanıtı.",
                    }
                )
        region = get(
            "akkuyu",
            "/rest/v1/regions",
            public_headers,
            params={"select": "id,active", "id": "eq.akkuyu", "active": "eq.true", "limit": "1"},
        )
        if region is not None:
            ok = region == [{"id": "akkuyu", "active": True}]
            checks.append(
                {
                    "name": "akkuyu",
                    "status": "ok" if ok else "error",
                    "message": "Aktif Akkuyu bölgesi public erişimde mevcut."
                    if ok
                    else "Aktif Akkuyu bölgesi bulunamadı.",
                }
            )
        for table in PRIVATE_TABLES:
            # Select one non-personal constant-sized field, never reports or email addresses.
            column = "region_id" if table == "subscriptions" else "id"
            try:
                response = client.get(
                    url + f"/rest/v1/{table}", headers=public_headers, params={"select": column, "limit": "1"}
                )
                denied = response.status_code == 403 or (
                    response.status_code == 200 and response.json() == []
                )
                checks.append(
                    {
                        "name": f"anonymous_{table}",
                        "status": "ok" if denied else "error",
                        "message": "Anonim istek özel kayıt döndürmedi; bu kontrol tek başına tam RLS kanıtı değildir."
                        if denied
                        else "Anonim erişim engeli doğrulanamadı; izin/RLS ayarlarını inceleyin.",
                    }
                )
            except (httpx.HTTPError, ValueError):
                checks.append(
                    {
                        "name": f"anonymous_{table}",
                        "status": "error",
                        "message": "Anonim erişim kontrolü tamamlanamadı.",
                    }
                )
    return checks
