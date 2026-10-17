"""Pure branded HTML/plain rendering. Consent and dispatch stay in mail/policy."""

import math
import os
from datetime import date
from html import escape
from urllib.parse import urlencode, urlsplit


def application_origin() -> str:
    value = os.getenv("APP_URL", "http://localhost:5173")
    try:
        parsed = urlsplit(value)
        local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
        valid_scheme = parsed.scheme == "https" or (
            parsed.scheme == "http" and local and os.getenv("APP_ENV") != "production"
        )
        if (
            not valid_scheme or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment
            or any(c.isspace() or ord(c) < 32 for c in value) or "\\" in value
            or parsed.port == 0
        ):
            raise ValueError
    except ValueError:
        raise ValueError("APP_URL güvenli bir uygulama origin adresi olmalı.") from None
    return value.rstrip("/")


def render_email(alert: dict, *, test: bool, preview: bool = False) -> dict:
    """`preview` adds a historical/no-send label; it never invokes a transport."""
    report = alert["report"]
    facts = report.get("facts", {})
    values = {k: float(facts[k]) for k in ("sst_c", "reference_c", "p90_c")}
    if not all(math.isfinite(v) and -2 <= v <= 40 for v in values.values()):
        raise ValueError("E-posta sıcaklık verileri geçersiz.")
    origin_day = date.fromisoformat(facts["origin_date"]).isoformat()
    target_day = date.fromisoformat(facts.get("event_date", alert.get("event_date", origin_day))).isoformat()
    base = application_origin()
    historical = test or alert.get("mode") == "replay"
    forecast = alert.get("kind") == "predicted"
    if historical:
        title = "TEST — ThermaTwin AI Geçmiş Analiz Raporu"
        label = "GEÇMİŞ ANALİZ · MANUEL TEST"
        subject = "[TEST] ThermaTwin AI | Geçmiş Analiz Raporu"
        warning = "Bu bir TEST e-postasıdır. Geçmiş olay tekrarı güncel bir uyarı değildir."
    elif forecast:
        title = "ThermaTwin AI | Deneysel tahmin"
        label = "DENEYSEL TAHMİN · ARAŞTIRMA ÖNİZLEMESİ"
        subject = "[Deneysel tahmin] ThermaTwin AI | Araştırma önizlemesi"
        warning = "Deneysel tahmin: gözlenmiş bir olay değildir. Tahmin-risk otomatik gönderimi kapalıdır."
    else:
        title = "ThermaTwin AI | Deniz Sıcaklığında Gözlemlenen Anomali"
        label = "GÖZLEMLENEN ANOMALİ · BİLGİLENDİRME"
        subject = "ThermaTwin AI | Deniz Sıcaklığında Gözlemlenen Anomali"
        warning = "Abonelik onayınızla gönderilen bilgi amaçlı bildirimdir. Acil durum mesajı değildir."
    if preview:
        warning = "YEREL ÖNİZLEME — geçmiş kayıt kullanılır; gönderilmedi, güncel bildirim değildir. " + warning
    delta = values["sst_c"] - values["reference_c"]
    rows = [
        ("Bölge", facts.get("region_name", "Akkuyu açıkları")),
        ("Son gözlem / tahmin başlangıcı", origin_day),
        ("Tahmin hedef tarihi" if forecast else "Gerçek gözlem tarihi", target_day),
        ("Tahmin edilen SST" if forecast else "Gözlenen SST", f"{values['sst_c']:.2f} °C"),
        ("Mevsimsel referans SST", f"{values['reference_c']:.2f} °C"),
        ("Referanstan fark", f"{delta:+.2f} °C"),
        ("P90 sıcak gün eşiği", f"{values['p90_c']:.2f} °C"),
        ("Veri kaynağı", facts.get("provider", "Raporda belirtilmedi")),
        ("Veri kümesi", facts.get("dataset_id", "Raporda belirtilmedi")),
    ]
    if forecast and "lower_c" in facts and "upper_c" in facts:
        lower, upper = float(facts["lower_c"]), float(facts["upper_c"])
        if not math.isfinite(lower) or not math.isfinite(upper) or lower > upper:
            raise ValueError("Tahmin aralığı geçersiz.")
        rows.append(("Ampirik tahmin aralığı", f"{lower:.2f} – {upper:.2f} °C"))
    reason = (
        "Geçmiş kayıt, manuel TEST akışının görünümünü ve rapor içeriğini incelemek için seçildi."
        if historical else
        "Validation'da seçilen deneysel tahmin kuralı tetiklendi; gözlenen anomali veya olay olasılığı değildir."
        if forecast else
        "Günlük uydu analizindeki SST, eğitim döneminden dondurulan mevsimsel P90 eşiğini aşıyor."
    )
    footer = (
        "Günlük L4 uydu analizi, anlık saha sensörü değildir. Kıyı çözünürlüğü, yayın gecikmesi ve tahmin hatası yorumu sınırlar. "
        "Tahmin aralığı her koşul için güvence veya olay olasılığı değildir; hızlı ısınmada kapsama düşebilir. "
        "Bağımsız otomatik erken uyarı doğrulanmış değildir. Bu analiz santral kaynaklı ısınmayı veya biyolojik zararı kanıtlamaz."
    )
    query = urlencode({"mode": "replay", "event": origin_day}) if historical or preview else ""
    report_url = base + ("/history?" + query if query else "/forecasts" if forecast else "/alerts")
    management_url = base + "/subscriptions"
    e = escape
    table = "".join(
        f'<tr><th scope="row" align="left" valign="top" style="padding:12px 10px;border-bottom:1px solid #d2e2e5;color:#536b76;font-size:13px;font-weight:400;width:44%">{e(str(k))}</th>'
        f'<td valign="top" style="padding:12px 10px;border-bottom:1px solid #d2e2e5;color:#102c3a;font-size:14px;overflow-wrap:anywhere">{e(str(v))}</td></tr>'
        for k, v in rows
    )
    html = f'''<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>{e(title)}</title>
<style>@media(max-width:620px){{.mail-pad{{padding:24px 18px!important}}.mail-title{{font-size:25px!important}}}}@media(prefers-color-scheme:dark){{.mail-canvas{{background:#071826!important}}.mail-surface{{background:#102737!important;color:#eaf7f6!important}}.mail-copy,.mail-surface h2{{color:#eaf7f6!important}}.mail-muted{{color:#adc5cf!important}}.mail-facts th{{color:#adc5cf!important;border-color:#2d4a59!important}}.mail-facts td{{color:#eaf7f6!important;border-color:#2d4a59!important}}.mail-link{{color:#68ddc6!important}}}}</style></head>
<body class="mail-canvas" style="margin:0;padding:0;background:#eef5f5;color:#102c3a;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{e(warning)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:28px 10px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mail-surface" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #d2e2e5;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 30px;background:#071826;color:#eaf7f6;border-top:4px solid #12c6c8"><p style="margin:0;color:#68ddc6;font-size:22px;letter-spacing:-.5px;font-weight:700">≈ ThermaTwin AI</p><p style="margin:5px 0 0;font-size:11px;letter-spacing:1.5px;color:#adc5cf">OCEAN INTELLIGENCE &amp; PREDICTIVE THERMAL ANALYTICS</p></td></tr>
<tr><td class="mail-pad" style="padding:32px 30px"><p style="margin:0 0 12px;color:#086a77;font-size:11px;letter-spacing:1.2px;font-weight:700" class="mail-link">{e(label)}</p>
<h1 class="mail-title mail-copy" style="font-size:29px;line-height:1.25;letter-spacing:-.7px;margin:0 0 24px;color:#102c3a">{e(title)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:16px;background:#fff1da;color:#70460b;border-left:4px solid #b76b10;font-size:14px">{e(warning)}</td></tr></table>
<h2 style="font-size:18px;margin:28px 0 12px;color:#102c3a">{e('Tahmin kaydı' if forecast else 'Gözlem kaydı')}</h2>
<table class="mail-facts" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed"><caption style="text-align:left;font-size:12px;color:#536b76" class="mail-muted">Sayısal değerler kayıtlı bilimsel rapordan gelir.</caption><tbody>{table}</tbody></table>
<h2 style="font-size:18px;margin:28px 0 10px;color:#102c3a">Bu rapor neden oluşturuldu?</h2><p class="mail-copy" style="font-size:14px;margin:0 0 16px;color:#102c3a">{e(reason)}</p>
<div class="mail-copy" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;color:#102c3a">{e(report['text'])}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td bgcolor="#12c6c8" style="border-radius:8px;background:#12c6c8"><a href="{e(report_url,quote=True)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#071826;text-decoration:none;min-height:20px">İlgili analizi incele →</a></td></tr></table>
<h2 style="font-size:16px;margin:28px 0 10px;color:#102c3a">Ölçülü yorum, açık sınırlar</h2><p class="mail-muted" style="font-size:12px;line-height:1.75;color:#536b76;margin:0">{e(footer)}</p>
</td></tr><tr><td class="mail-pad" style="padding:24px 30px;border-top:1px solid #d2e2e5"><p class="mail-muted" style="font-size:12px;color:#536b76;margin:0 0 12px">Bu ileti, bildirim tercihinizle ilişkilidir. Manuel TEST tek seferlik kullanıcı eylemidir; tahmin-risk otomatik gönderimi kapalı kalır.</p><a class="mail-link" href="{e(management_url,quote=True)}" style="font-size:13px;color:#086a77;text-decoration:underline;display:inline-block;padding:10px 0">Bildirimleri yönet · Gönderimleri durdur veya aboneliği iptal et</a><p class="mail-muted" style="font-size:11px;color:#536b76;margin:12px 0 0">ThermaTwin AI · Akkuyu açıkları / Doğu Akdeniz</p></td></tr>
</table></td></tr></table></body></html>'''
    facts_text = "\n".join(f"{k}: {v}" for k, v in rows)
    text = f"{title}\n{label}\n\n{warning}\n\n{facts_text}\n\nBu rapor neden oluşturuldu?\n{reason}\n\n{report['text']}\n\n{footer}\n\nİlgili analiz: {report_url}\nBildirimleri kapat veya aboneliği iptal et: {management_url}\nTahmin-risk otomatik gönderimi kapalıdır."
    return {"subject": subject, "html": html, "text": text}
