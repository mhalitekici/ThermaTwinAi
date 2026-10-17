"""Escaped HTML + plain text. Numeric facts always come from the report engine."""

import os
from html import escape
from urllib.parse import urlparse


def render_email(alert: dict, *, test: bool) -> dict:
    report = alert["report"]
    facts = report.get("facts", {})
    app_url = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
    parsed = urlparse(app_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("APP_URL geçerli bir uygulama adresi olmalı.")
    title = "TEST · Geçmiş olay raporu" if alert["mode"] == "replay" else "Deniz sıcaklığı bilgi bildirimi"
    if test and alert["mode"] != "replay":
        title = "TEST · " + title
    kind = (
        "Gözlemlenmiş sıcaklık anomalisi"
        if alert.get("kind") == "observed"
        else "Öngörülen sıcaklık riski — deneysel"
    )
    rows = [
        ("Bölge", facts.get("region_name", "Akkuyu açıkları")),
        ("Olay tarihi", facts.get("event_date", alert.get("event_date", ""))),
        ("Veri tarihi", facts.get("origin_date", "")),
        ("Sıcaklık", f"{facts['sst_c']:.2f} °C"),
        ("Mevsimsel referans", f"{facts['reference_c']:.2f} °C"),
        ("P90 eşiği", f"{facts['p90_c']:.2f} °C"),
    ]
    table = "".join(
        f'<tr><td style="padding:10px;color:#536174">{escape(k)}</td><td style="padding:10px;font-weight:600">{escape(str(v))}</td></tr>'
        for k, v in rows
    )
    warning = (
        "Bu bir TEST e-postasıdır. Geçmiş olay tekrarı güncel bir uyarı değildir."
        if test
        else "Abonelik onayınızla gönderilen bilgi amaçlı bildirimdir. Acil durum mesajı değildir."
    )
    footer = (
        "Tahminler belirsizlik içerir; bağımsız otomatik erken uyarı doğrulanmış değildir. "
        "Bu analiz santral kaynaklı ısınmayı veya biyolojik zararı kanıtlamaz."
    )
    html = f'''<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7fa;color:#17283d;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px"><tr><td style="padding:32px">
<p style="color:#007f80;font-weight:700;letter-spacing:2px">THERMATWIN AI</p><h1 style="font-size:24px">{escape(title)}</h1>
<p style="padding:12px;background:#fff5da;border-radius:8px">{escape(warning)}</p><h2 style="font-size:18px">{escape(kind)}</h2>
<table style="width:100%;border-collapse:collapse">{table}</table><h2 style="font-size:18px">Analiz açıklaması</h2>
<div style="white-space:pre-wrap;line-height:1.7">{escape(report["text"])}</div>
<p style="font-size:13px;color:#536174;line-height:1.6">{escape(footer)}</p>
<p><a href="{escape(app_url + "/subscriptions", quote=True)}" style="color:#007f80">Bildirimleri kapat veya aboneliği iptal et</a></p>
</td></tr></table></td></tr></table></body></html>'''
    return {
        "subject": ("[TEST] " if test else "[ThermaTwin Bilgi] ") + kind,
        "html": html,
        "text": f"{title}\n{warning}\n{report['text']}\n\n{footer}\nAbonelik yönetimi: {app_url}/subscriptions",
    }
