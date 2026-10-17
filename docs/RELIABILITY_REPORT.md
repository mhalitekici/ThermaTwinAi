# ThermaTwin AI — güvenilirlik ve erken uyarı ölçüm raporu

Değerlendirme: **16 Ekim 2026** · Gerçek Copernicus 2008-01-01–2026-10-16, 6.864 gün, sıfır boşluk.

**Karar: yerel araştırma ve gözlem prototipi; bağımsız otomatik kullanıcı erken uyarısı için hazır değil.** Sıcaklık MAE’si baseline’dan iyi; validation’da seçilen uyarı stratejisi testte persistence F1’ını geçmiyor. Toplam aralık kapsaması iyileşse de hızlı ısınma günlerinde ciddi yetersizlik var.

## Koruma ve yeniden üretim

Mevcut iki PDF, Copernicus/NOAA model dosyaları ve gözlem dosyaları korunur. Yeni yıllık deneme modelleri ve CSV’ler `artifacts/reliability/v1/` altında; dashboard’un nokta tahminleri aynı modelden gelir. Supabase, OTP, Resend ve e-posta bu çalışmada kullanılmadı.

```powershell
.venv\Scripts\python.exe -X utf8 scripts\evaluate_reliability.py
```

Tam deney ağırlıkları, her hedef/origin tahmini ve uyarı durum izi yerelde saklanır. [Makinece okunabilir rapor](reliability-report.json), [grafik](assets/reliability-summary.png). `--refresh-snapshots` yalnız mevcut politikayla UI kopyalarını ve ek replay örneklerini yeniler. Temiz checkout’ta önce README’deki gerçek Copernicus veri/model dosyaları hazırlanmalıdır.

## Değerlendirme protokolü ve sızıntı sınırları

2019–2026 için sekiz yıllık test bloğu. Y yılı testi: eğitim 2008’den Y−3 yıl sonuna, validation Y−2 yılı, kalibrasyon Y−1 yılı. Model yılda bir yeniden eğitilir; testte her gün yeni origin oluşturulur. Bu günlük yeniden eğitim değildir. Her blokta hedef tarihi blok sonunu geçemez; ufuk sınırları purge edilir. Son yıl kısmi, 16 Ekim 2026’da biter. Hata yüzdeleri ortalanmaz; günlük sonuçlar birleştirilir.

Özellikler geçmiş/current gözlemden; klimatoloji yalnız ilgili eğitimin verisinden. XGBoost/persistence karışımı validation MAE’siyle seçilir. Uyarı adayları: XGBoost, persistence ve son gözlem + klimatolojik mevsim değişimi; P90/P95 tetikleri; −0.2/0/+0.2 °C marjları (18 aday). Seçim, **sabit gözlenmiş P90 gerçeğine göre validation F1**; eşitlikte daha az FP, küçük marj, persistence. Testte seçim/yeniden ayar yok. P95’in kendi etiketindeki ayrı sonuçları yalnız tanı amaçlıdır, P90 ile aynı başarı problemi sayılmaz.

**Geçmişe dönük çalışma:** önceki sabit test bu projede daha önce incelendi. Yıllık ayrımlar algoritmik sızıntıyı engeller; bu sonuçlar hiç görülmemiş ileriye dönük saha deneyi olarak sunulmaz. Arşiv revizyonları ve ürünün gerçek yayın gecikmesi modellenmedi.

## Sıcaklık tahmini: rolling-origin

| Ufuk | N | Model MAE | RMSE | Persistence MAE | Mevsimsel ort. MAE | Önceki yıl MAE | MAE kazancı |
|---|---|---|---|---|---|---|---|
| +24 saat | 2838 | 0.2484 | 0.3376 | 0.2650 | 0.6952 | 0.9166 | %6.25 |
| +48 saat | 2830 | 0.3335 | 0.4492 | 0.3718 | 0.6949 | 0.9172 | %10.31 |
| +72 saat | 2822 | 0.3626 | 0.4993 | 0.4155 | 0.6945 | 0.9182 | %12.74 |

Mevsimsel ortalama eğitimden donmuş takvim referansıdır. Seasonal naive, hedefin bir önceki yıldaki aynı takvim günü (29 Şubat için 28 Şubat) gözlemidir; tümü origin’de bilinir. Aynı tarihlerde karşılaştırılır.

## Mevcut modelin eski/yeni sonucu

Orijinal eğitim 19 Mart 2020, validation 4 Şubat 2022, kalibrasyon 22 Aralık 2023’te biter. Test başlangıçları 23 Aralık 2023 sonrası, hedefler 16 Ekim 2026’ya kadar; horizon nedeniyle N farklıdır. Nokta tahminleri ve MAE değişmedi; değişen uyarı politikası ve aralıklardır.

| Ufuk | MAE (eski=yeni) | Persistence MAE | Kazanç | Eski model F1 | Yeni politika F1 | Persistence F1 |
|---|---|---|---|---|---|---|
| +24 saat | 0.2649 | 0.2807 | %5.63 | 0.8416 | 0.8435 | 0.8465 |
| +48 saat | 0.3520 | 0.3910 | %9.97 | 0.7611 | 0.7793 | 0.7858 |
| +72 saat | 0.3799 | 0.4358 | %12.84 | 0.7558 | 0.7509 | 0.7594 |

Yeni kural +24/+48 saatte eski model F1’ını yükseltti, +72 saatte düşürdü; üçünde de persistence’ın altında kaldı. Bu olumsuz sonuçlar nedeniyle testte başka kural seçilmedi.

| Ufuk | Validation seçimi | Precision | Recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|
| +24 saat | seasonal_drift_c P90 +0.0 °C | 0.8454 | 0.8415 | 361 | 66 | 68 | 533 |
| +48 saat | seasonal_drift_c P90 +0.0 °C | 0.7830 | 0.7757 | 332 | 92 | 96 | 507 |
| +72 saat | persistence_c P95 -0.2 °C | 0.7365 | 0.7658 | 327 | 117 | 100 | 482 |

FP günlük yanlış pozitif **sinyal** sayısıdır; gönderilen bildirim/e-posta sayısı değildir. Her ufukta farklı hedef/gün çifti olduğundan FP’ler toplanıp benzersiz yanlış alarm diye sunulmaz.

## Aralıklar ve zor günler

Her ufuk için ayrı mutlak calibration residual’ı sıralanır; `ceil((n+1)×0.8)`’inci hata alınır. Eski `quantile(..., higher)` interpolasyonu bir sıra fazla genişletebiliyordu; yeni kod doğrudan sıra istatistiğini kullanır. Önceden belirlenmiş mevsimsel zarf: mevsimde en az 60 kalibrasyon örneği varsa max(genel, mevsimsel), yoksa genel yarıçap. Bu seçim test hedef %80’e zorlanarak yapılmadı. Zamansal bağımlılık nedeniyle formal conformal kapsama garantisi iddia edilmez.

| Ufuk | Eski kapsama | Yeni kapsama | Yeni ort. genişlik °C | Rolling kapsama | Hızlı ısınma kapsama |
|---|---|---|---|---|---|
| +24 saat | %80.25 | %81.71 | 0.884 | %83.54 | %6.74 |
| +48 saat | %78.19 | %81.21 | 1.166 | %84.95 | %36.13 |
| +72 saat | %77.78 | %81.09 | 1.236 | %84.94 | %39.77 |

Hızlı yükseliş, hedef SST’nin origin’e göre ≥0.5 °C artmasıdır; ekstrem gün, hedef SST’nin eğitim P95’ini aşmasıdır. Bunlar sonuç analizi alt gruplarıdır; uyarı üretirken gelecek etiket olarak kullanılmaz.

| Ufuk | Alt grup | N | Model MAE | Persistence MAE | Model bias | Kapsama |
|---|---|---|---|---|---|---|
| +24 saat | rising | 89 | 0.6961 | 0.7518 | -0.6961 | %6.74 |
| +24 saat | extreme_p95 | 324 | 0.2579 | 0.2633 | -0.1341 | %81.48 |
| +24 saat | DJF | 248 | 0.1892 | 0.2036 | -0.0050 | %87.10 |
| +24 saat | MAM | 276 | 0.3058 | 0.3187 | -0.0145 | %76.09 |
| +24 saat | JJA | 276 | 0.3238 | 0.3392 | -0.0688 | %76.81 |
| +24 saat | SON | 228 | 0.2263 | 0.2476 | +0.0142 | %88.60 |
| +48 saat | rising | 155 | 0.7233 | 0.8299 | -0.7233 | %36.13 |
| +48 saat | extreme_p95 | 323 | 0.3392 | 0.3489 | -0.2260 | %82.97 |
| +48 saat | DJF | 247 | 0.2433 | 0.2736 | -0.0150 | %91.50 |
| +48 saat | MAM | 276 | 0.4156 | 0.4527 | -0.0262 | %75.00 |
| +48 saat | JJA | 276 | 0.4266 | 0.4689 | -0.1225 | %77.17 |
| +48 saat | SON | 228 | 0.3026 | 0.3493 | +0.0307 | %82.46 |
| +72 saat | rising | 176 | 0.7409 | 0.9211 | -0.7409 | %39.77 |
| +72 saat | extreme_p95 | 322 | 0.3621 | 0.3761 | -0.2594 | %83.23 |
| +72 saat | DJF | 246 | 0.2554 | 0.3064 | -0.0133 | %91.06 |
| +72 saat | MAM | 276 | 0.4509 | 0.4951 | -0.0334 | %77.54 |
| +72 saat | JJA | 276 | 0.4553 | 0.5118 | -0.1654 | %74.64 |
| +72 saat | SON | 228 | 0.3368 | 0.4117 | +0.0521 | %82.46 |

Rolling testinde P95 ekstrem gün MAE’si üç ufukta da persistence’tan daha kötü. Hızlı yükseliş günlerinde model çoğunlukla düşük tahmin ediyor. Ortalama kapsama, bu koşullu başarısızlığı gizlememeli.

## Günlük sinyal, olay ve bildirim ayrımı

Gerçek olay, ≥5 ardışık gözlenmiş P90 günüdür. İki günlük soğuk aralar birleştirilmez; pencere kenarında açık kalan seriler sansürlüdür. Günlük anomali ilk günden gösterilir; gözlemsel MHW teyidi ancak beşinci gündedir. Olay eşleştirmesi yalnız ölçüm sonrası değerlendirmedir, uyarı motoruna geleceği vermez.

| Ufuk | Olay | Saptanan | Önceden | Precision | Recall | F1 | Kayıt | Bastırılan | Yanlış olay kaydı |
|---|---|---|---|---|---|---|---|---|---|
| +24 saat | 18 | 11 | 0 | 0.2245 | 0.6111 | 0.3284 | 50 | 377 | 38 |
| +48 saat | 18 | 13 | 0 | 0.2653 | 0.7222 | 0.3881 | 50 | 374 | 36 |
| +72 saat | 18 | 10 | 2 | 0.2703 | 0.5556 | 0.3636 | 40 | 404 | 27 |

Yukarıdaki ufuklar ayrı tanı provasıdır. Bildirimde ilk pozitif, sonra iki normal günle yeniden kurulum uygulanır. Olay precision’ı benzersiz saptanan olay / (saptanan olay + olaya denk gelmeyen kayıt) olarak tanımlıdır; aynı gerçek olayın tekrar saptanması precision’ı büyütmez. Sansürlü olay kayıtları yanlış alarm payına alınmaz. Kısa sıcak ataklar günlük doğru sinyal olup beş günlük olay hedefinde yanlış sayılabilir.

### Dashboard’un birleşik motoru

1.026 ortak başlangıçta **49 bildirim kaydı provası**: 11 öngörü ve 38 gözlem teyidi. **439 tekrar bastırıldı.** 18 olaydan 8 saptandı, 10 kaçırıldı; **yalnız 2 başlamadan yakalandı**. 38 kayıt beş günlük bir olaya denk gelmedi; 1 kayıt sınırda sansürlü. Olay precision/recall/F1: 0.1739/0.4444/0.2500.

Motor normal, gözlenmiş anomali, öngörülen risk ve yetersiz/eski veri durumlarını ayırır. Aynı olayda ilk sinyal ve gözlemsel anomaliye geçiş bir kez kaydedilir; iki normal gün olmadan yeniden kurulmaz. Eksik gün normal sayılmaz. Aynı gün tekrar çağrı ve olay kimliği tekrar bildirimi engeller. Bu azaltım bazı yakın olayları birleştirip kaçırabilir; e-posta/abonelik entegrasyonu henüz etkin değildir.

Statik UI kopyaları üretildiği tarihe aittir; tarayıcıda üç günden eski güncel veri yeni alarm olarak gösterilmez. Geçmiş replay tarihleri güncel alarm değildir. Motorun neden, ufuk, veri tarihi, aralık ve karar izi JSON’da korunur.

## P90/P95 tanısı

| Ufuk | Gerçek etiket | Model Precision | Recall | F1 | FP | FN | Persistence F1 |
|---|---|---|---|---|---|---|---|
| +24 saat | P90 | 0.8537 | 0.8298 | 0.8416 | 61 | 73 | 0.8465 |
| +24 saat | P95 | 0.8426 | 0.7932 | 0.8172 | 48 | 67 | 0.7883 |
| +48 saat | P90 | 0.7827 | 0.7407 | 0.7611 | 88 | 111 | 0.7858 |
| +48 saat | P95 | 0.7816 | 0.7090 | 0.7435 | 64 | 94 | 0.7200 |
| +72 saat | P90 | 0.7854 | 0.7283 | 0.7558 | 85 | 116 | 0.7594 |
| +72 saat | P95 | 0.7440 | 0.6770 | 0.7089 | 75 | 104 | 0.7034 |

Bu tabloda etiket değiştiği için P95 F1 artışı P90 uyarısının iyileştiği anlamına gelmez. Kural seçimi tablosundaki bütün 18 aday aynı P90 etiketine karşı değerlendirilir.

## Referans duyarlılığı

Eğitimden dondurulmuş referans ve yalnız eğitimdeki son 10 tamamlanmış yıl tanısal olarak karşılaştırıldı. Test oranlarına bakılarak referans seçilmedi; mevcut referans korunur. Her ikisi de standart 30 yıl değildir.

| Referans | Dönem | N | P90 aşımı | P95 aşımı | Ort. anomali °C |
|---|---|---|---|---|---|
| frozen_training | training | 4462 | %9.52 | %4.73 | -0.000 |
| frozen_training | validation | 687 | %30.71 | %21.54 | +0.405 |
| frozen_training | calibration | 686 | %21.28 | %14.43 | +0.234 |
| frozen_training | test | 1029 | %41.79 | %31.58 | +0.667 |
| last_10_complete_training_years | training | 4462 | %7.75 | %3.99 | -0.038 |
| last_10_complete_training_years | validation | 687 | %28.38 | %19.51 | +0.370 |
| last_10_complete_training_years | calibration | 686 | %19.24 | %13.41 | +0.196 |
| last_10_complete_training_years | test | 1029 | %38.39 | %28.86 | +0.625 |

## Yıl bazında rolling hata

| Ufuk | Hedef yılı | N | Model MAE | RMSE | Persistence MAE |
|---|---|---|---|---|---|
| +24 saat | 2019 | 364 | 0.2241 | 0.3104 | 0.2392 |
| +24 saat | 2020 | 365 | 0.2338 | 0.3317 | 0.2461 |
| +24 saat | 2021 | 364 | 0.2304 | 0.3069 | 0.2433 |
| +24 saat | 2022 | 364 | 0.2467 | 0.3262 | 0.2598 |
| +24 saat | 2023 | 364 | 0.2626 | 0.3656 | 0.2886 |
| +24 saat | 2024 | 365 | 0.2660 | 0.3690 | 0.2845 |
| +24 saat | 2025 | 364 | 0.2618 | 0.3428 | 0.2772 |
| +24 saat | 2026 | 288 | 0.2653 | 0.3444 | 0.2853 |
| +48 saat | 2019 | 363 | 0.3048 | 0.4184 | 0.3417 |
| +48 saat | 2020 | 364 | 0.3216 | 0.4702 | 0.3564 |
| +48 saat | 2021 | 363 | 0.3175 | 0.4190 | 0.3551 |
| +48 saat | 2022 | 363 | 0.3191 | 0.4181 | 0.3562 |
| +48 saat | 2023 | 363 | 0.3502 | 0.4625 | 0.3893 |
| +48 saat | 2024 | 364 | 0.3568 | 0.5046 | 0.4009 |
| +48 saat | 2025 | 363 | 0.3494 | 0.4444 | 0.3729 |
| +48 saat | 2026 | 287 | 0.3522 | 0.4492 | 0.4098 |
| +72 saat | 2019 | 362 | 0.3376 | 0.4745 | 0.3915 |
| +72 saat | 2020 | 363 | 0.3692 | 0.5639 | 0.4300 |
| +72 saat | 2021 | 362 | 0.3477 | 0.4617 | 0.4067 |
| +72 saat | 2022 | 362 | 0.3328 | 0.4413 | 0.3847 |
| +72 saat | 2023 | 362 | 0.3662 | 0.4802 | 0.4022 |
| +72 saat | 2024 | 363 | 0.3977 | 0.5864 | 0.4514 |
| +72 saat | 2025 | 362 | 0.3835 | 0.4837 | 0.4312 |
| +72 saat | 2026 | 286 | 0.3670 | 0.4795 | 0.4294 |

## Gerçek kullanıcıya hazırlık ve kalan işler

- Tek bölge ve günlük bölgesel SST; kıyı sensörü veya ekolojik zarar etiketi yok.
- 2019–2026 geçmiş değerlendirmesi; daha önce incelenmiş seri üzerinde ileriye dönük bağımsız saha testi değildir.
- Zamansal bağımlılık ve iklim kayması nedeniyle %80 kapsama garantisi yok; mevsim ve ekstrem kapsaması ayrıca izlenmeli.
- Referans standart 30 yıl değil; sabit eski referans ısınan iklimde daha fazla eşik aşımı üretebilir.
- Olay başlangıcından önce uyarı başarısı, olay sürerken anomaliyi saptama başarısından düşüktür.
- Bildirim azaltımı yerel deterministik motorla ölçülür; e-posta teslimatı veya kullanıcı davranışı ölçülmedi.
- Arşiv revizyonları ve gerçek yayın gecikmesi için point-in-time kaynak sürümleri bulunmuyor; operasyonel gecikme backtestte modellenmedi.

İzleyen deney: politikayı dondurup yeni gelecek günlerde gölge izleme; gecikme ve veri revizyonlarını kaydetme; olay başlangıcına odaklı validation hedefi ve bağımsız meteoroloji/akıntı değişkenleri. Mevcut testte düşen F1’ı düzeltmek amacıyla bu test üzerinde yeniden ayar yapılmamalı.

## Yöntem kaynakları

- [Hyndman & Athanasopoulos: zaman serisi çapraz doğrulama](https://otexts.com/fpp3/tscv.html).
- [Angelopoulos & Bates: conformal prediction](https://arxiv.org/abs/2107.07511). Sıra istatistiği için temel; bu zaman serisinde exchangeability garantisi varsayılmadı.
- [Xu & Xie: zaman serisinde conformal aralıklar](https://proceedings.mlr.press/v139/xu21h.html). Zamansal bağımlılık bağlamı; EnbPI bu projede uygulanmadı.
- [Marine Heatwaves araştırmacıları: tanım](https://www.marineheatwaves.org/mhw-overview.html). Buradaki kısa referans ve araları birleştirmeyen uygulama tam standart uzun klimatoloji değildir.
