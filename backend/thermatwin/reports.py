"""LLM output cannot introduce numbers or free-form causal claims."""

import json
import os
from copy import deepcopy

import httpx

COMMENTARY = {
    "inspect": "Bağımsız saha ölçümleri ve komşu açık-deniz hücreleriyle karşılaştırma önerilir.",
    "follow": "Bir sonraki günlük uydu analizinde süreklilik ve veri kalitesi yeniden kontrol edilmelidir.",
    "uncertainty": "Uydu analizi yüzeyi temsil eder; kıyı çözünürlüğü ve tahmin hatası yorumu sınırlar.",
}


def generate_report(event: dict, *, allow_llm: bool = True) -> dict:
    codes, method = ["follow", "uncertainty", "inspect"], "template"
    if allow_llm and os.getenv("GEMINI_API_KEY"):
        try:
            schema = {
                "type": "object",
                "properties": {
                    "codes": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 3,
                        "items": {"type": "string", "enum": list(COMMENTARY)},
                    }
                },
                "required": ["codes"],
            }
            with httpx.Client(timeout=15) as client:
                r = client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')}:generateContent",
                    headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {
                                        "text": "Veriye göre yalnız takip yorum kodlarını seç. "
                                        + json.dumps(event, ensure_ascii=False)
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "responseJsonSchema": schema,
                            "temperature": 0,
                        },
                    },
                )
                r.raise_for_status()
                parsed = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
                chosen = parsed["codes"]
                if (
                    not isinstance(chosen, list)
                    or not 1 <= len(chosen) <= 3
                    or any(c not in COMMENTARY for c in chosen)
                ):
                    raise ValueError("Geçersiz yorum kodları")
                codes, method = list(dict.fromkeys(chosen)), "gemini-constrained"
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            pass
    prefix = "GEÇMİŞ OLAY TEKRARI — güncel uyarı değildir.\n" if event["mode"] == "replay" else ""
    label = "Gözlemlenen" if event["kind"] == "observed" else "Tahmin edilen"
    risk_label = {
        "watch": "İzleme; mevsimsel P90 eşiği aşılıyor",
        "high": "Yüksek; referans üzerindeki fark, P90 ile referans farkının en az iki katı",
    }.get(event["risk"], "Normal")
    text = (
        f"{prefix}{event['region_name']} | {event['event_date']}\n"
        f"{label} SST: {event['sst_c']:.2f} °C. Mevsimsel referans: {event['reference_c']:.2f} °C. "
        f"Anomali: {event['sst_c'] - event['reference_c']:+.2f} °C. "
        f"90. yüzdelik: {event['p90_c']:.2f} °C. İnceleme önceliği: {risk_label}.\n"
        f"Kaynak: {event['provider']}. Tahmin başlangıcı/son gözlem: {event['origin_date']}.\n"
        "Bu sonuç santral kaynaklı ısınmayı veya biyolojik zararı kanıtlamaz.\n"
        + " ".join(COMMENTARY[c] for c in codes)
    )
    if event.get("lower_c") is not None:
        text += f"\nAmpirik %80 tahmin aralığı: {event['lower_c']:.2f}–{event['upper_c']:.2f} °C."
    if event.get("reason"):
        text += f"\nUyarı nedeni: {event['reason']}"
    if event.get("horizon_hours") is not None:
        text += f"\nTahmin ufku: {event['horizon_hours']} saat. Veri tarihi: {event.get('data_date', event['origin_date'])}."
    # A report is attached back to its event before registration. An alias here
    # would create event -> report -> facts -> event and break JSON publishing.
    facts = deepcopy({key: value for key, value in event.items() if key != "report"})
    return {"text": text, "method": method, "facts": facts}
