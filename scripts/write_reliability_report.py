"""Render the measured JSON report as a readable report and standalone figure."""

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from thermatwin.config import ROOT


def table(headers, rows):
    return "\n".join(
        ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
        + ["| " + " | ".join(map(str, row)) + " |" for row in rows]
    )


def write_report(report=None):
    r = report or json.loads((ROOT / "docs/reliability-report.json").read_text(encoding="utf-8"))
    horizons = ("1", "2", "3")
    deployed = r["deployed"]["horizons"]
    pooled = r["rolling_pooled"]
    lines = [
        "# ThermaTwin AI — güvenilirlik ve erken uyarı ölçüm raporu",
        "",
        "Değerlendirme: **16 Ekim 2026** · Gerçek Copernicus 2008-01-01–2026-10-16, 6.864 gün, sıfır boşluk.",
        "",
        (
            "**Karar: yerel araştırma ve gözlem prototipi; bağımsız otomatik kullanıcı erken uyarısı için hazır değil.** "
            "Sıcaklık MAE’si baseline’dan iyi; validation’da seçilen uyarı stratejisi testte persistence F1’ını geçmiyor. "
            "Toplam aralık kapsaması iyileşse de hızlı ısınma günlerinde ciddi yetersizlik var."
        ),
        "",
        "## Koruma ve yeniden üretim",
        "",
        (
            "Mevcut iki PDF, Copernicus/NOAA model dosyaları ve gözlem dosyaları korunur. "
            "Yeni yıllık deneme modelleri ve CSV’ler `artifacts/reliability/v1/` altında; dashboard’un nokta tahminleri aynı modelden gelir. "
            "Supabase, OTP, Resend ve e-posta bu çalışmada kullanılmadı."
        ),
        "",
        "```powershell",
        ".venv\\Scripts\\python.exe -X utf8 scripts\\evaluate_reliability.py",
        "```",
        "",
        (
            "Tam deney ağırlıkları, her hedef/origin tahmini ve uyarı durum izi yerelde saklanır. "
            "[Makinece okunabilir rapor](reliability-report.json), [grafik](assets/reliability-summary.png). "
            "`--refresh-snapshots` yalnız mevcut politikayla UI kopyalarını ve ek replay örneklerini yeniler. "
            "Temiz checkout’ta önce README’deki gerçek Copernicus veri/model dosyaları hazırlanmalıdır."
        ),
        "",
        "## Değerlendirme protokolü ve sızıntı sınırları",
        "",
        (
            "2019–2026 için sekiz yıllık test bloğu. Y yılı testi: eğitim 2008’den Y−3 yıl sonuna, validation Y−2 yılı, "
            "kalibrasyon Y−1 yılı. Model yılda bir yeniden eğitilir; testte her gün yeni origin oluşturulur. "
            "Bu günlük yeniden eğitim değildir. Her blokta hedef tarihi blok sonunu geçemez; ufuk sınırları purge edilir. "
            "Son yıl kısmi, 16 Ekim 2026’da biter. Hata yüzdeleri ortalanmaz; günlük sonuçlar birleştirilir."
        ),
        "",
        (
            "Özellikler geçmiş/current gözlemden; klimatoloji yalnız ilgili eğitimin verisinden. "
            "XGBoost/persistence karışımı validation MAE’siyle seçilir. Uyarı adayları: XGBoost, persistence ve "
            "son gözlem + klimatolojik mevsim değişimi; P90/P95 tetikleri; −0.2/0/+0.2 °C marjları (18 aday). "
            "Seçim, **sabit gözlenmiş P90 gerçeğine göre validation F1**; eşitlikte daha az FP, küçük marj, persistence. "
            "Testte seçim/yeniden ayar yok. P95’in kendi etiketindeki ayrı sonuçları yalnız tanı amaçlıdır, P90 ile aynı başarı problemi sayılmaz."
        ),
        "",
        (
            "**Geçmişe dönük çalışma:** önceki sabit test bu projede daha önce incelendi. Yıllık ayrımlar algoritmik sızıntıyı engeller; "
            "bu sonuçlar hiç görülmemiş ileriye dönük saha deneyi olarak sunulmaz. Arşiv revizyonları ve ürünün gerçek yayın gecikmesi modellenmedi."
        ),
        "",
        "## Sıcaklık tahmini: rolling-origin",
        "",
        table(
            [
                "Ufuk",
                "N",
                "Model MAE",
                "RMSE",
                "Persistence MAE",
                "Mevsimsel ort. MAE",
                "Önceki yıl MAE",
                "MAE kazancı",
            ],
            [
                [
                    f"+{int(h) * 24} saat",
                    pooled[h]["n"],
                    f"{pooled[h]['model']['mae_c']:.4f}",
                    f"{pooled[h]['model']['rmse_c']:.4f}",
                    f"{pooled[h]['persistence']['mae_c']:.4f}",
                    f"{pooled[h]['seasonal']['mae_c']:.4f}",
                    f"{pooled[h]['seasonal_naive']['mae_c']:.4f}",
                    f"%{pooled[h]['mae_improvement_pct']:.2f}",
                ]
                for h in horizons
            ],
        ),
        "",
        (
            "Mevsimsel ortalama eğitimden donmuş takvim referansıdır. Seasonal naive, hedefin bir önceki yıldaki aynı takvim günü "
            "(29 Şubat için 28 Şubat) gözlemidir; tümü origin’de bilinir. Aynı tarihlerde karşılaştırılır."
        ),
        "",
        "## Mevcut modelin eski/yeni sonucu",
        "",
        (
            "Orijinal eğitim 19 Mart 2020, validation 4 Şubat 2022, kalibrasyon 22 Aralık 2023’te biter. "
            "Test başlangıçları 23 Aralık 2023 sonrası, hedefler 16 Ekim 2026’ya kadar; horizon nedeniyle N farklıdır. "
            "Nokta tahminleri ve MAE değişmedi; değişen uyarı politikası ve aralıklardır."
        ),
        "",
        table(
            [
                "Ufuk",
                "MAE (eski=yeni)",
                "Persistence MAE",
                "Kazanç",
                "Eski model F1",
                "Yeni politika F1",
                "Persistence F1",
            ],
            [
                [
                    f"+{int(h) * 24} saat",
                    f"{deployed[h]['evaluation']['model']['mae_c']:.4f}",
                    f"{deployed[h]['evaluation']['persistence']['mae_c']:.4f}",
                    f"%{deployed[h]['evaluation']['mae_improvement_pct']:.2f}",
                    *[
                        f"{deployed[h]['evaluation']['daily'][name]['f1']:.4f}"
                        for name in ("old_model_p90", "optimized", "persistence_p90")
                    ],
                ]
                for h in horizons
            ],
        ),
        "",
        (
            "Yeni kural +24/+48 saatte eski model F1’ını yükseltti, +72 saatte düşürdü; üçünde de persistence’ın altında kaldı. "
            "Bu olumsuz sonuçlar nedeniyle testte başka kural seçilmedi."
        ),
        "",
        table(
            ["Ufuk", "Validation seçimi", "Precision", "Recall", "TP", "FP", "FN", "TN"],
            [
                [
                    f"+{int(h) * 24} saat",
                    f"{deployed[h]['warning_policy']['source']} P{deployed[h]['warning_policy']['percentile']} {deployed[h]['warning_policy']['margin_c']:+.1f} °C",
                    *[
                        f"{deployed[h]['evaluation']['daily']['optimized'][k]:.4f}"
                        for k in ("precision", "recall")
                    ],
                    *[deployed[h]["evaluation"]["daily"]["optimized"][k] for k in ("tp", "fp", "fn", "tn")],
                ]
                for h in horizons
            ],
        ),
        "",
        (
            "FP günlük yanlış pozitif **sinyal** sayısıdır; gönderilen bildirim/e-posta sayısı değildir. "
            "Her ufukta farklı hedef/gün çifti olduğundan FP’ler toplanıp benzersiz yanlış alarm diye sunulmaz."
        ),
        "",
        "## Aralıklar ve zor günler",
        "",
        (
            "Her ufuk için ayrı mutlak calibration residual’ı sıralanır; `ceil((n+1)×0.8)`’inci hata alınır. "
            "Eski `quantile(..., higher)` interpolasyonu bir sıra fazla genişletebiliyordu; yeni kod doğrudan sıra istatistiğini kullanır. "
            "Önceden belirlenmiş mevsimsel zarf: mevsimde en az 60 kalibrasyon örneği varsa max(genel, mevsimsel), yoksa genel yarıçap. "
            "Bu seçim test hedef %80’e zorlanarak yapılmadı. Zamansal bağımlılık nedeniyle formal conformal kapsama garantisi iddia edilmez."
        ),
        "",
        table(
            [
                "Ufuk",
                "Eski kapsama",
                "Yeni kapsama",
                "Yeni ort. genişlik °C",
                "Rolling kapsama",
                "Hızlı ısınma kapsama",
            ],
            [
                [
                    f"+{int(h) * 24} saat",
                    f"%{deployed[h]['old_interval_coverage'] * 100:.2f}",
                    f"%{deployed[h]['evaluation']['interval']['coverage'] * 100:.2f}",
                    f"{deployed[h]['evaluation']['interval']['mean_width_c']:.3f}",
                    f"%{pooled[h]['interval']['coverage'] * 100:.2f}",
                    f"%{deployed[h]['evaluation']['subgroups']['rising']['coverage'] * 100:.2f}",
                ]
                for h in horizons
            ],
        ),
        "",
        (
            "Hızlı yükseliş, hedef SST’nin origin’e göre ≥0.5 °C artmasıdır; ekstrem gün, hedef SST’nin eğitim P95’ini aşmasıdır. "
            "Bunlar sonuç analizi alt gruplarıdır; uyarı üretirken gelecek etiket olarak kullanılmaz."
        ),
        "",
        table(
            ["Ufuk", "Alt grup", "N", "Model MAE", "Persistence MAE", "Model bias", "Kapsama"],
            [
                [
                    f"+{int(h) * 24} saat",
                    name,
                    v["n"],
                    f"{v['model']['mae_c']:.4f}",
                    f"{v['persistence']['mae_c']:.4f}",
                    f"{v['model']['bias_c']:+.4f}",
                    f"%{v['coverage'] * 100:.2f}",
                ]
                for h in horizons
                for name, v in deployed[h]["evaluation"]["subgroups"].items()
            ],
        ),
        "",
        (
            "Rolling testinde P95 ekstrem gün MAE’si üç ufukta da persistence’tan daha kötü. "
            "Hızlı yükseliş günlerinde model çoğunlukla düşük tahmin ediyor. Ortalama kapsama, bu koşullu başarısızlığı gizlememeli."
        ),
        "",
        "## Günlük sinyal, olay ve bildirim ayrımı",
        "",
        (
            "Gerçek olay, ≥5 ardışık gözlenmiş P90 günüdür. İki günlük soğuk aralar birleştirilmez; "
            "pencere kenarında açık kalan seriler sansürlüdür. Günlük anomali ilk günden gösterilir; gözlemsel MHW teyidi ancak beşinci gündedir. "
            "Olay eşleştirmesi yalnız ölçüm sonrası değerlendirmedir, uyarı motoruna geleceği vermez."
        ),
        "",
        table(
            [
                "Ufuk",
                "Olay",
                "Saptanan",
                "Önceden",
                "Precision",
                "Recall",
                "F1",
                "Kayıt",
                "Bastırılan",
                "Yanlış olay kaydı",
            ],
            [
                [
                    f"+{int(h) * 24} saat",
                    *[
                        deployed[h]["evaluation"]["events"]["optimized"][k]
                        for k in ("events", "detected_events", "early_events")
                    ],
                    *[
                        f"{deployed[h]['evaluation']['events']['optimized'][k]:.4f}"
                        for k in ("precision", "recall", "f1")
                    ],
                    *[
                        deployed[h]["evaluation"]["events"]["optimized"][k]
                        for k in ("notifications", "suppressed_repeats", "false_notifications")
                    ],
                ]
                for h in horizons
            ],
        ),
        "",
        (
            "Yukarıdaki ufuklar ayrı tanı provasıdır. Bildirimde ilk pozitif, sonra iki normal günle yeniden kurulum uygulanır. "
            "Olay precision’ı benzersiz saptanan olay / (saptanan olay + olaya denk gelmeyen kayıt) olarak tanımlıdır; "
            "aynı gerçek olayın tekrar saptanması precision’ı büyütmez. Sansürlü olay kayıtları yanlış alarm payına alınmaz. "
            "Kısa sıcak ataklar günlük doğru sinyal olup beş günlük olay hedefinde yanlış sayılabilir."
        ),
        "",
    ]
    engine = r["deployed"]["combined_engine"]
    lines += [
        "### Dashboard’un birleşik motoru",
        "",
        (
            f"1.026 ortak başlangıçta **{engine['notifications']} bildirim kaydı provası**: "
            f"{engine['forecast_notifications']} öngörü ve {engine['observed_notifications']} gözlem teyidi. "
            f"**{engine['suppressed_repeats']} tekrar bastırıldı.** {engine['events']} olaydan {engine['detected_events']} saptandı, "
            f"{engine['missed_events']} kaçırıldı; **yalnız {engine['early_events']} başlamadan yakalandı**. "
            f"{engine['false_event_notifications']} kayıt beş günlük bir olaya denk gelmedi; {engine['censored_notifications']} kayıt sınırda sansürlü. "
            f"Olay precision/recall/F1: {engine['precision']:.4f}/{engine['recall']:.4f}/{engine['f1']:.4f}."
        ),
        "",
        (
            "Motor normal, gözlenmiş anomali, öngörülen risk ve yetersiz/eski veri durumlarını ayırır. "
            "Aynı olayda ilk sinyal ve gözlemsel anomaliye geçiş bir kez kaydedilir; iki normal gün olmadan yeniden kurulmaz. "
            "Eksik gün normal sayılmaz. Aynı gün tekrar çağrı ve olay kimliği tekrar bildirimi engeller. "
            "Bu azaltım bazı yakın olayları birleştirip kaçırabilir; e-posta/abonelik entegrasyonu henüz etkin değildir."
        ),
        "",
        (
            "Statik UI kopyaları üretildiği tarihe aittir; tarayıcıda üç günden eski güncel veri yeni alarm olarak gösterilmez. "
            "Geçmiş replay tarihleri güncel alarm değildir. Motorun neden, ufuk, veri tarihi, aralık ve karar izi JSON’da korunur."
        ),
        "",
        "## P90/P95 tanısı",
        "",
        table(
            ["Ufuk", "Gerçek etiket", "Model Precision", "Recall", "F1", "FP", "FN", "Persistence F1"],
            [
                [
                    f"+{int(h) * 24} saat",
                    f"P{p}",
                    *[f"{v['model'][k]:.4f}" for k in ("precision", "recall", "f1")],
                    v["model"]["fp"],
                    v["model"]["fn"],
                    f"{v['persistence']['f1']:.4f}",
                ]
                for h in horizons
                for p, v in deployed[h]["evaluation"]["threshold_diagnostics"].items()
            ],
        ),
        "",
        (
            "Bu tabloda etiket değiştiği için P95 F1 artışı P90 uyarısının iyileştiği anlamına gelmez. "
            "Kural seçimi tablosundaki bütün 18 aday aynı P90 etiketine karşı değerlendirilir."
        ),
        "",
        "## Referans duyarlılığı",
        "",
        (
            "Eğitimden dondurulmuş referans ve yalnız eğitimdeki son 10 tamamlanmış yıl tanısal olarak karşılaştırıldı. "
            "Test oranlarına bakılarak referans seçilmedi; mevcut referans korunur. Her ikisi de standart 30 yıl değildir."
        ),
        "",
    ]
    if r.get("reference_diagnostics"):
        lines += [
            table(
                ["Referans", "Dönem", "N", "P90 aşımı", "P95 aşımı", "Ort. anomali °C"],
                [
                    [
                        name,
                        period,
                        v["n"],
                        f"%{v['p90_rate'] * 100:.2f}",
                        f"%{v['p95_rate'] * 100:.2f}",
                        f"{v['mean_anomaly_c']:+.3f}",
                    ]
                    for name, ref in r["reference_diagnostics"].items()
                    for period, v in ref["periods"].items()
                ],
            ),
            "",
        ]
    lines += [
        "## Yıl bazında rolling hata",
        "",
        table(
            ["Ufuk", "Hedef yılı", "N", "Model MAE", "RMSE", "Persistence MAE"],
            [
                [
                    f"+{int(h) * 24} saat",
                    year,
                    v["n"],
                    f"{v['model']['mae_c']:.4f}",
                    f"{v['model']['rmse_c']:.4f}",
                    f"{v['persistence']['mae_c']:.4f}",
                ]
                for h in horizons
                for year, v in pooled[h]["by_year"].items()
            ],
        ),
        "",
        "## Gerçek kullanıcıya hazırlık ve kalan işler",
        "",
        *[f"- {s}" for s in r["limitations"]],
        "",
        (
            "İzleyen deney: politikayı dondurup yeni gelecek günlerde gölge izleme; gecikme ve veri revizyonlarını kaydetme; "
            "olay başlangıcına odaklı validation hedefi ve bağımsız meteoroloji/akıntı değişkenleri. "
            "Mevcut testte düşen F1’ı düzeltmek amacıyla bu test üzerinde yeniden ayar yapılmamalı."
        ),
        "",
        "## Yöntem kaynakları",
        "",
        "- [Hyndman & Athanasopoulos: zaman serisi çapraz doğrulama](https://otexts.com/fpp3/tscv.html).",
        "- [Angelopoulos & Bates: conformal prediction](https://arxiv.org/abs/2107.07511). Sıra istatistiği için temel; bu zaman serisinde exchangeability garantisi varsayılmadı.",
        "- [Xu & Xie: zaman serisinde conformal aralıklar](https://proceedings.mlr.press/v139/xu21h.html). Zamansal bağımlılık bağlamı; EnbPI bu projede uygulanmadı.",
        "- [Marine Heatwaves araştırmacıları: tanım](https://www.marineheatwaves.org/mhw-overview.html). Buradaki kısa referans ve araları birleştirmeyen uygulama tam standart uzun klimatoloji değildir.",
        "",
    ]
    (ROOT / "docs/RELIABILITY_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    x = np.arange(3)
    labels = ["24h", "48h", "72h"]
    for name, title in (
        ("model", "XGBoost blend"),
        ("persistence", "Persistence"),
        ("seasonal", "Seasonal mean"),
    ):
        axes[0, 0].plot(x, [pooled[h][name]["mae_c"] for h in horizons], "o-", label=title)
    axes[0, 0].set(title="Rolling-origin MAE (2019–2026)", ylabel="MAE (°C)")
    for name, title in (
        ("optimized", "New warning rule"),
        ("old_model_p90", "Old model P90"),
        ("persistence_p90", "Persistence P90"),
    ):
        axes[0, 1].plot(
            x, [deployed[h]["evaluation"]["daily"][name]["f1"] for h in horizons], "o-", label=title
        )
    axes[0, 1].set(title="Frozen-model held-out daily anomaly F1", ylabel="F1")
    axes[1, 0].plot(
        x, [deployed[h]["evaluation"]["interval"]["coverage"] for h in horizons], "o-", label="All test days"
    )
    axes[1, 0].plot(
        x,
        [deployed[h]["evaluation"]["subgroups"]["rising"]["coverage"] for h in horizons],
        "o-",
        label="Rising >=0.5°C",
    )
    axes[1, 0].axhline(0.8, color="grey", linestyle="--", label="80% nominal")
    axes[1, 0].set(
        title="New interval coverage; conditional failures", ylabel="Empirical coverage", ylim=(0, 1)
    )
    axes[1, 1].bar(
        x - 0.18,
        [deployed[h]["evaluation"]["events"]["optimized"]["detected_events"] for h in horizons],
        width=0.36,
        label="Detected during/before event",
    )
    axes[1, 1].bar(
        x + 0.18,
        [deployed[h]["evaluation"]["events"]["optimized"]["early_events"] for h in horizons],
        width=0.36,
        label="Before onset",
    )
    axes[1, 1].set(title="Per-horizon notices: 18 sustained P90 events", ylabel="Events", ylim=(0, 18))
    for ax in axes.ravel():
        ax.set_xticks(x, labels)
        ax.grid(axis="y", alpha=0.2)
        ax.legend(fontsize=8)
    fig.suptitle("ThermaTwin: temperature skill is stronger than early-warning skill", fontsize=14)
    fig.tight_layout()
    fig.savefig(ROOT / "docs/assets/reliability-summary.png", dpi=180)
    plt.close(fig)


if __name__ == "__main__":
    write_report()
