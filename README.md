# ThermaTwin AI

## Ocean Intelligence ürün yükseltmesi

Ürün tasarımı çalışması; bağımsız ThermaTwin AI markası, gerçek tarihli gözlem ve sürümlü bilimsel sonuçları gösteren landing, ortak açık/koyu ocean teması ve görünür Model Performansı gezinmesini kapsar. [Aşamalı uygulama planı](docs/PRODUCT_UPGRADE_PLAN.md), [tasarım sistemi](docs/DESIGN_SYSTEM.md). Üretim modeli ve e-posta gönderim politikası bu görsel aşamada değiştirilmez; PR'lar açık onay olmadan merge edilmez veya Production'a yayınlanmaz.

Yerel ekran incelemesi: izole demo build'i için `node scripts/build-demo-test.mjs`; ardından `node scripts/preview-vercel.mjs --directory dist-demo-test --port 5188` ve ayrı terminalde `node scripts/capture-product.mjs after`. `node scripts/product-gallery.mjs`, `artifacts/product-upgrade/review.html` galerisini oluşturur. CI'ın `product-review-screenshots` artifact'ı yeni landing'in dört genişlikteki açık/koyu görsellerini içerir. Gerçek OTP veya e-posta gönderilmez.

Akkuyu açıkları için günlük deniz yüzeyi sıcaklığı (SST), +1/+2/+3 gün tahmini, mevsimsel anomali ve abonelik tabanlı erken uyarı MVP'si. Climathon teslim hedefi: **21 Ekim 2026**.

Kök klasördeki iki özgün PDF korundu. İnceleme ve kapsam kararları: [docs/REVIEW.md](docs/REVIEW.md). Tamamlanan ve dış hesap bekleyen işler: [PROGRESS.md](PROGRESS.md).

## Vercel production hazırlığı 0.6

Dağıtım mimarisi **Vercel (Vite frontend) + ayrı Render HTTPS FastAPI** olarak hazırlandı. Vercel: repository root, `npm run build`, output `dist`, Node 24. Bilinen React Router sayfaları doğrudan URL/F5 ile açılır; API ve statik dosyalar HTML'e çevrilmez. Production build public Supabase ve gerçek HTTPS API adresi ister. Preview zorunlu demo'dur; canlı Supabase/API bağlantıları derlemeye girmez.

API için `deploy/api/Dockerfile`, hash ile kilitlenmiş hafif bağımlılıklar ve isteğe bağlı `render.yaml` vardır. HTTP runtime ML kütüphanelerini yüklemez; gerçek model/monitoring mevcut GitHub Actions akışında kalır. Production snapshot Supabase'den okunur. CORS kesin HTTPS origin'lerle sınırlıdır; preview backend gönderim bayraklarını zorunlu kapatır. UI/UX tasarımı, mevcut `.env`, modeller/veriler, raporlar ve PDF'ler korunur.

**Vercel veya Render hesabı bağlanmadı, canlı deploy yapılmadı.** Ayrı hazırlık PR'si açık onay olmadan `main` ile birleştirilmez. Windows 11 adımları, bütün environment alanları, ücretsiz katman sınırları, atlanan 7 gerçek-artifact testi ve yayın sonrası kabul listesi: **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)**. Demo öncesi 16 Ekim snapshot'ının güncelliği shadow monitoring ile ayrıca sağlanmalıdır.

## Arayüz ve TEST e-postası 0.5 — 17 Ekim 2026

`npm.cmd run dev` artık hem Vite'ı (5173) hem e-posta API'sini (8000) başlatır; iki servis aynı terminalden kapanır. Ayrı başlatmak gerekirse `npm.cmd run dev:frontend` ve mevcut uvicorn komutu kullanılabilir. Çalışan servisler varsa yeniden başlatmadan önce kendi terminallerinden kapatın.

Anomali uyarıları sayfasındaki TEST alanı günlük görünümde de bulunur. Hesabın doğrulanmış adresine, açık onaylı Akkuyu aboneliğiyle geçmiş olay raporu gönderir. Aynı olay tekrar gönderilmez. Servis bağlantısı, yeniden deneme, engel nedeni ve gönderim sonucu görünürdür. Kişisel bildirim geçmişi görünüm modundan bağımsızdır; **Teslim durumunu kontrol et** düğmesi yalnız oturum sahibinin kaydını sorgular ve yeni e-posta göndermez. Sağlayıcının `delivered` durumu alıcı posta sunucusunun kabulüdür; gelen kutusu yerleşimi değildir.

17 Ekim kontrolünde önceki iki gerçek TEST kaydı Resend'de `delivered` döndü. Bu inceleme yeni gerçek mesaj göndermedi. Otomatik gönderimler shadow ve tahmin e-postaları kapalı kalır. Mobil üst çubuk, 44 px temel kontroller, buton etiketleri, abonelik kartı, hesap eylemleri, menü odağı ve bildirim düzeni düzeltildi. Beş tasarım becerisinin kaynakları ve uygulama kararları: [UI_REPAIR_PLAN.md](docs/UI_REPAIR_PLAN.md).

## Auth, abonelik ve e-posta 0.4

Mevcut uygulamada Supabase e-posta OTP, kalıcı oturum/çıkış, Akkuyu aboneliği ve ayrı açık e-posta onayı tamamlandı. PostgreSQL/RLS ve server-only RPC'ler başka hesabın kayıtlarına erişimi engeller. Bildirimleri durdurmak aboneliği silmez; iptal edip yeniden abone olmak mükerrer kayıt oluşturmaz.

Giriş ekranı Supabase'in 6–10 haneli OTP kodlarını kısaltmadan ve baştaki sıfırları koruyarak kabul eder. Hosted projeden 8 haneli kod geliyorsa tamamını girin; ayarı 6 haneye düşürmeniz gerekmez. Yerel Supabase config 8 hane kullanır, gerçek kodu sunucu doğrular.

**Başlangıç durumu shadow:** otomatik gerçek gönderimler ve tahmin e-postaları kapalıdır. Gözlemlenmiş anomaliler de yalnız doğrulanmış, açık onaylı aboneler için değerlendirilebilir. Manuel geçmiş TEST gönderimi sunucu bayrağı, doğrulanmış oturum ve açık bildirim onayı gerektirir; alıcı giriş yapan hesabın Supabase üzerinden doğrulanan kendi adresidir. Sabit alıcı ayarı yoktur; istemci başka bir alıcı adresi/kullanıcı kimliği gönderemez. E-posta HTML ve düz metin içerir; Resend kabulü teslim garantisi diye gösterilmez. Eski/eksik veri, aynı olay, onay iptali ve değişmiş alıcı tekrar kontrol edilir.

**Canlı bağlantının bütün adımları ve gerçek ortam test durumu:** [docs/LIVE_INTEGRATION.md](docs/LIVE_INTEGRATION.md). Sıra: Supabase ve iki migration → Resend domain/DNS → Custom SMTP ve OTP şablonları → yalnız yerel `.env` → gerçek kullanıcı kabul testi → GitHub shadow monitoring. Anahtarlar sohbete veya kaynak koda yazılmamalıdır.

**Yerel bağlantı kuruldu:** gerçek Supabase'e 6.864 korunmuş Copernicus gözlemi, üç tahmin ufku ve 16 Ekim 2026 snapshot'ı shadow turuyla kaydedilip geri okundu; production dashboard gerçek snapshot'ı gösteriyor. Resend verified domain okuması ve SMTP SSL kimlik doğrulaması başarılı. Kullanıcı gerçek OTP ile giriş ve abonelik tamamladığını bildirdi. Manuel TEST, giriş yapan doğrulanmış/izinli abonenin kendi adresine açık; otomatik/tahmin e-postaları kapalı. TEST anomali e-postasının gelen kutusu kabulü henüz tamamlanmadı.

`VITE_APP_MODE=demo` varsayılandır; `production` Supabase bağlantısını açar. Demo ve bağlı test üretimleri ayrı klasörlerde tutulur. `VITE_` alanlarında service-role/Resend/secret anahtarı build'i durdurur. Testler gerçek `.env` hesaplarından izole edilir; test servisleri production'a gömülmez.

Hesap alanları hazır olunca `.venv\Scripts\python.exe -X utf8 scripts\check_integrations.py --remote` ile gönderimsiz kontrol çalıştırın. Anahtar değerlerini göstermez; Supabase üzerinde yalnız GET yapar ve eksik ayarda uzak isteği engeller. Teknik kontrolün geçmesi gerçek OTP/SMTP/teslim veya iki hesapla RLS kabulü anlamına gelmez. Sunucudaki `SUPABASE_SERVICE_ROLE_KEY` alanı yeni secret ve legacy service-role anahtarlarını destekler.

```powershell
.venv\Scripts\python.exe -X utf8 -m pytest -q
npm.cmd test
npm.cmd run build
```

`npm test`: public/secret yapılandırma kapıları, frontend birim testleri, iki migration üzerinde PostgreSQL/RLS, mevcut dashboard E2E ve masaüstü/mobil bağlı hesap akışı. Bağlı akış gerçek frontend SDK'sı ve FastAPI kullanır; **Supabase/Resend servisleri kontrollü test servisleridir, gerçek e-posta göndermez**.

Monitoring artık modeli otomatik yeniden eğitmez. Mevcut model/kalibrasyon paketi SHA-256 ile doğrulanır. `monitor_runs`, shadow kayıtları ve hata durumları saklanır. GitHub workflow'u elle tetiklenebilir; zamanlama repository değişkeniyle açılır, gerçek otomatik e-posta ayrıca onay olmadan açılmaz.

Aşağıdaki 0.2/0.3 bölümleri önceki geliştirme aşamalarının kaydıdır; güncel hesap/SMTP adımlarında 0.4 rehberini izleyin.

## ML Reliability 0.3 — ölçülen erken uyarı

Mevcut modellerin ağırlıkları ve dashboard tasarımı korunur. Sekiz yıllık rolling-origin deneyi, validation'da seçilen P90/P95 uyarı politikaları, ayrı ufuk/mevsim kalibrasyonu ve tekrar bastıran dört durumlu yerel motor eklendi. Dashboard'un sıcaklık nokta tahminleri değişmez; aralık ve uyarı açıklamaları yeni ölçümlere bağlıdır.

Gerçek sonuç: rolling MAE **0.248 / 0.333 / 0.363 °C**, persistence'a göre **%6.25 / %10.31 / %12.74** düşük. Buna rağmen yeni uyarı politikasının mevcut model testindeki F1'ı **0.843 / 0.779 / 0.751**; üç ufukta persistence'ın altında. Yeni toplam aralık kapsaması **%81.7 / %81.2 / %81.1**, hızlı yükselişlerde çok daha zayıf. **Bağımsız otomatik erken uyarı için hazır değildir.** Ayrıntılar ve tüm yanlış alarmlar: [ölçüm raporu](docs/RELIABILITY_REPORT.md), [model kartı](docs/MODEL_CARD.md), [grafik](docs/assets/reliability-summary.png).

Yerelde mevcut gerçek veri/model dosyalarıyla deneyi yeniden üretmek için:

```powershell
.venv\Scripts\python.exe -X utf8 scripts\evaluate_reliability.py
```

Bu komut ağ veya e-posta kullanmaz. Yeni yıllık modeller ve günlük tahmin/uyarı izleri `artifacts/reliability/v1/` altında, özgün dosyaların dışında tutulur. Rapor `docs/` ve `public/` altında üretilir. Eski `live.json`, `replay.json` ve üç özgün olay dosyası korunur; istemci doğrulanan ayrı UI kopyasını uygular. Ek replay'de 27 Ocak 2025 başarılı ön sinyali ve 21 Kasım 2024 yanlış olay uyarısı birlikte incelenebilir. Bu tarihler güncel gözlem tarihi değildir; son veri **16 Ekim 2026**.

Yalnız mevcut politikadan UI kopyalarını yenilemek için `--refresh-snapshots` eklenebilir. Orijinal model yeniden eğitilirse hash uyuşmazlığında politika reddedilir; aynı veri ayrımlarıyla yeniden kalibre edilmelidir. Supabase, OTP, Resend ve gerçek bildirimler kapalı kalır.

## UI/UX 0.2 — yerel prototip

Mevcut uygulama kapsamlı biçimde yeniden düzenlendi: Inter tipografi, kalıcı açık/koyu tema, daha büyük sıcaklık göstergeleri, sade navigasyon, gözlem/tahmin ayrımı olan grafik ve açıklamalı risk kartları. Başlangıç açık temadır. Tasarım: [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), ekran karşılaştırması: [UI_COMPARISON.md](docs/UI_COMPARISON.md).

- `/dashboard`: bölge, son gözlem, normal aralık durumu, üç günlük tahmin ve gözlenen/tahmin edilen açıklamalar.
- `/regions`: tek desteklenen Akkuyu alanı; gerçek temel harita, uydu katmanı ve yeniden ortalama.
- `/forecasts`: model tahminleri ve ampirik aralıklar.
- `/alerts`: ayrı gözlem/tahmin filtreleri ve rapor indirme.
- `/history`: **25 Aralık 2023, 7 Haziran 2024, 5 Aralık 2025** gerçek olaylarını seçme; olaydan önce aynı ayda gözlenmiş normal günle karşılaştırma.
- `/performance`: yeniden hesaplanmış gerçek metrikler, baseline, kapsama, en büyük hatalar ve denetim sonuçları.
- `/subscriptions`: **yalnız tarayıcıda saklanan yerel tercih provası**. Gerçek abonelik açmaz, e-posta göndermez.
- `/settings`: tema, veri kaynağı ve model ayrıntıları.

Replay modu ve olay tarihi URL'de taşınır; ekranlar arası gezinme ve yenilemede korunur. “Son gözleme dön” açık mod geçişidir. Statik snapshot'ın eski olması ayrıca belirtilir. Model performansı ve veri kalitesi artık ana ekrana yığılmaz.

**Bu aşamada canlı servisler kapalıdır.** `VITE_ENABLE_LIVE_INTEGRATIONS=false` varsayılandır; anahtarlar mevcut olsa bile istemci Supabase'e bağlanmaz. Eski bağlı ekranlar `src/integrations/`, migration ve backend servisleri yerinde tutulur. Aşağıdaki canlı entegrasyon talimatları sonraki aşama içindir; bu çalışma kapsamında uygulanmadı. [Entegrasyon TODO](docs/INTEGRATION_TODO.md).

Model denetimini, mevcut modelleri yeniden eğitmeden çalıştırmak için:

```powershell
.venv\Scripts\python.exe -X utf8 scripts\audit_model.py --catalogue
```

Bu komut kayıtlı hindcast'leri gerçek gözlemler ve kaydedilmiş modelle karşılaştırır; ham veri hash'ini, kronolojik ayrımı, dondurulmuş referansı ve dashboard tahminlerini doğrular. Yeni `model-audit.json` ve üç olaylık `replay-events.json` üretir; önceki `model.joblib`, gözlemler ve `public/replay.json` değiştirilmez. Ağsız denetim için `--catalogue` seçeneğini çıkarın. Denetim, bulunmayan/gelecekteki başlangıç tarihini kabul edebilen inference kontrolünü düzeltti.

**Önemli sonuç:** Model üç ufukta MAE'yi düşürüyor; P90 sıcak gün F1'ında persistence'ı geçmiyor. Ortalama hata, tekil büyük sapmaları gizlememeli; +72 saatte en büyük test hatası 3.455 °C. Ayrıntılar model performansı ekranında ve model kartında açıkça gösterilir.

## Hemen açın — Windows PowerShell

Bu çalışma klasöründe frontend bağımlılıkları ve Python 3.12 ortamı kurulmuştur:

```powershell
Set-Location 'C:\Users\halit\Desktop\Therma_Twin_Ai'
npm.cmd run dev
```

Tarayıcı: **http://127.0.0.1:5173**. Başlangıç sayfasından gözlem merkezini açın. Günlük görünümde gerçek **16 Ekim 2026 Copernicus** gözlemi; “Geçmiş olay tekrarı” açıkken **7 Haziran 2024** olayı görünür. Statik snapshot kendiliğinden güncellenmez; eski veri tarihi ve gecikme uyarısı gösterilir. Gerçek harita katmanları internet gerektirir.

## Temiz kurulum

Node.js 24 ve Python 3.12 kullanılır. `uv.lock` ve `package-lock.json` sürümleri sabitler.

```powershell
npm.cmd ci
python -m pip install uv
python -m uv sync --python 3.12 --frozen --extra dev
Copy-Item .env.example .env  # Yalnız .env henüz yoksa; mevcut sır dosyasını ezmeyin.
npm.cmd run dev
```

Gerekirse Python komutlarında `.venv\Scripts\python.exe -X utf8` kullanın. Ortam aktivasyonu gerekmez; PowerShell yürütme politikasını değiştirmeye gerek yoktur.

## Yapı

```text
src/                       React, TypeScript, Tailwind, Leaflet ve Recharts
backend/thermatwin/         ingestion, ML, anomali, rapor, e-posta, API
supabase/migrations/        şema, RLS ve atomik olay/gönderim RPC'leri
scripts/run_monitor.py     scheduled monitoring giriş noktası
.github/workflows/          CI ve zamanlanmış izleme
public/live.json           tarihli son günlük snapshot (gerçek veri)
public/replay.json         etiketli geçmiş olay (gerçek veri)
data/raw/, data/processed/  indirilen NetCDF/CSV ve veri manifestleri (gitignore)
artifacts/                 modeller, metrikler, hindcast CSV/PNG (gitignore)
docs/                      rapor incelemesi, model kartı, metrik kopyaları
tests/, e2e/               Python, PostgreSQL RLS ve tarayıcı testleri
```

## Gerçek Copernicus pipeline

[Resmî MED NRT kataloğu](https://data.marine.copernicus.eu/product/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004/services) ve `copernicusmarine.describe` ile ürün kimliği, sürüm, `analysed_sst`, `mask` ve zaman ekseni kontrol edildi. Varsayılan dataset: `SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2`, sürüm `202311`.

Hesap olmadan **kataloğun doğrudan yayımladığı, açık okunabilir ARCO Zarr** servisi kullanılır. Özel/korumalı bir uç noktaya erişim denenmez. `COPERNICUS_ACCESS=toolbox` veya kullanıcı adı tanımlandığında resmî Toolbox subset yolu, kullanıcı adı/şifreyle çalışır. Açık servis ileride erişim isterse anonim indirme hata verir; `.env` üzerinden resmî hesap yoluna geçin. Kimlik bilgili indirme bu oturumda denenmedi.

```powershell
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli download --provider copernicus
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli train --provider copernicus
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli monitor --provider copernicus
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli replay --provider copernicus
```

ROI: 35.95–36.15° N, 33.40–33.70° E. NetCDF'de ölçek/fill değerleri xarray ile çözülür; yalnız `mask == 1` deniz hücreleri alınır. Kelvin doğrulanıp °C'ye çevrilir. Geçersiz sıcaklıklar dışlanır; deniz alanı cos(enlem) ağırlığıyla ortalanır. Eksik takvim günleri korunur, enterpolasyon yapılmaz. İndirme manifesti kaynak URL'sini, sürümü, SHA-256'yı, alanı ve gerçek gözlem tarihlerini saklar. Son tarih katalog metninden değil, indirilen zaman koordinatından alınır.

NOAA OISST yalnız **ayrı karşılaştırma** kaynağıdır; Copernicus ile birleştirilmez ve canlı monitoring sağlayıcısı yapılamaz:

```powershell
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli download --provider noaa --end 2025-12-31
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli train --provider noaa
```

NOAA replay komutu `public/replay.json` dosyasını NOAA olayıyla değiştirir. Jüri demosu için tekrar Copernicus replay komutunu çalıştırın. Kaynak: [NOAA CoastWatch OISST v2.1](https://coastwatch.pfeg.noaa.gov/erddap/info/ncdcOisst21Agg_LonPM180/index.html); tek açık-deniz hücresi 35.875° N, 33.625° E, 0.25°. NOAA verisi Copernicus sonucu olarak sunulmaz.

## Model ve gerçek sonuçlar

XGBoost + geçmiş SST, lag, hareketli ortalama, standart sapma, trend ve mevsimsellik. Model sıcaklık değişimini tahmin eder; XGBoost/persistence ağırlığı yalnız ayarlama bloğunda seçilir. Eğitim %65, ayarlama %10, bağımsız aralık kalibrasyonu %10, test %15. Ufuk hedefleri kendi blok sınırını geçemez. Karıştırılmış train/test yoktur. Kalibrasyondan önceki tarihte replay reddedilir.

**Copernicus, test: 23 Aralık 2023–16 Ekim 2026**:

| Ufuk | MAE °C | RMSE °C | Persistence MAE °C | P90 sıcak gün F1 | %80 aralık gerçek kapsama |
|---|---:|---:|---:|---:|---:|
| +1 gün | 0.265 | 0.355 | 0.281 | 0.842 | %80.3 |
| +2 gün | 0.352 | 0.467 | 0.391 | 0.761 | %78.2 |
| +3 gün | 0.380 | 0.513 | 0.436 | 0.756 | %77.8 |

Bu sonuçlar bölgesel ortalama günlük SST içindir. F1, **sıcak gün P90 eşik aşımıdır**; yüksek ekolojik risk, santral etkisi veya MHW olay başarısı değildir. +2/+3 gün aralık kapsaması hedefin altındadır. PDR'deki hedefleri genel olarak karşılanmış ilan etmiyoruz. Ayrıntılar: [docs/MODEL_CARD.md](docs/MODEL_CARD.md), `docs/copernicus-evaluation.json` ve yerel `artifacts/.../hindcast_*.csv`.

Klimatoloji yalnız eğitim döneminden hesaplanır; ±5 takvim günü havuzu ve 31 günlük dairesel yumuşatma uygulanır. MVP'nin kısa referansı standart 30 yıllık klimatoloji değildir. P90 üstü tek gün “eşik aşımı”; **en az 5 ardışık gözlenen gün** “MHW koşulu” olarak işaretlenir. Öngörülen eşik aşımı doğrulanmış gözlemsel MHW sayılmaz. Yüksek inceleme önceliği: pozitif farkın `(P90 − referans)` farkının en az iki katı olması; uzman kalibrasyonu yapılmamış tarama kuralıdır.

## Supabase: OTP, abonelik ve RLS

**Sonraki aşama — şu anda kapalı.** Gerçek bağlantı ayrıca ele alındığında `VITE_ENABLE_LIVE_INTEGRATIONS=true` ve uygun ortam değerleri gerekir. Aşağıdaki adımlar henüz canlı servislerle doğrulanmadı.

1. Bir Supabase projesi oluşturun. [SQL migration](supabase/migrations/202610160001_initial.sql) dosyasını SQL Editor'de bir kez uygulayın.
2. Authentication → Email provider açık olsun. Projede OTP uzunluğunu **6** olarak ayarlayın.
3. Magic Link/e-posta giriş şablonunda link yerine `{{ .Token }}` kullanın. Örnek gövde: `ThermaTwin doğrulama kodunuz: {{ .Token }}`. [Resmî OTP kılavuzu](https://supabase.com/docs/guides/auth/auth-email-passwordless).
4. Site URL/redirect allowlist'e yerel adresi, yayınlanınca gerçek uygulama adresini ekleyin. Gerçek kullanıcılar için SMTP göndericisini yapılandırın; prototip sağlayıcı kotaları geçerlidir.
5. `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Vite'ı yeniden başlatın. **Service role asla `VITE_` değişkeni olamaz.**
6. E-posta koduyla giriş yapın → Deniz bölgeleri → Akkuyu → Aboneliklerim → İzlemeyi etkinleştir.

Bilimsel bölge/gözlem/snapshot verileri okunabilir. Abonelikler ve gönderim geçmişi yalnız `auth.uid()` sahibine açıktır. Bilimsel tablolar, uyarılar ve RPC yazımları servis rolüne ayrılmıştır. E-posta alıcısı tarayıcıdan alınmaz; sunucu doğrulanmış auth hesabından okur. İptal edilen abonelik yeniden denemede de kontrol edilir.

## Yerel API ve gerçek geçmiş test e-postası

```powershell
.venv\Scripts\python.exe -X utf8 -m uvicorn thermatwin.api:app --host 127.0.0.1 --port 8000
```

Sağlık: http://127.0.0.1:8000/health · API şeması: http://127.0.0.1:8000/docs.

Resend hesabını ve doğrulanmış göndericiyi ayarlayın. `.env`: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`; Gemini isteğe bağlıdır. Alıcı giriş yapan doğrulanmış hesabın kendi adresinden bulunur; `REPLAY_TEST_EMAIL` kaldırılmıştır ve eski bir ortamda bulunsa da kullanılmaz. Resend sandbox kullanılıyorsa sağlayıcının kendi test adresi kısıtı sürer; farklı kullanıcılara gönderim için doğrulanmış domain gerekir.

Geçmiş tekrarını açın → **Anomali uyarıları** → **TEST e-postası gönder**. Bu işlem doğrulanmış oturum, etkin Akkuyu aboneliği ve açık bildirim onayıyla çalışır. Ekranda alıcı olarak giriş yapılan hesap görünür; sunucu kullanıcıyı bearer token ile Supabase'ten doğrular. `email`, `to` veya `user_id` alanlarıyla alıcı seçen istek reddedilir. Geçmiş olay güncel gibi sunulmaz; konu ve rapor “GEÇMİŞ TEKRAR / TEST” etiketlidir. Sunucu atomik gönderim hakkı alır ve sonucu kaydeder. Her abone yalnız kendi adresine TEST isteyebilir; aynı olay/kullanıcı/gönderim modu tekrarlanmaz.

CLI alternatifi, yalnız sizin doğrulanmış test kullanıcı UUID'nizle:

```powershell
.venv\Scripts\python.exe -X utf8 -m thermatwin.cli replay --provider copernicus --publish --send-email --user-id YOUR_VERIFIED_TEST_USER_UUID
```

`sent`, sağlayıcının isteği kabul etmesidir; gelen kutusuna teslim kanıtı değildir. Webhook ile teslim/bounce takibi bu sürümde yoktur. **Bu oturumda gerçek OTP ve gerçek e-posta gönderilmedi**; kullanıcı hesapları sonraya bıraktı.

## Otomatik izleme

`monitor.yml` UTC 05:17, 11:17, 17:17'de (Moskova/Türkiye 08:17, 14:17, 20:17) yeni günlük veriyi kontrol eder. GitHub schedule gecikebilir; kesin zaman garantisi yoktur. Kalıcı gözlemler, tahminler, abonelikler, olaylar ve gönderim kilitleri Supabase'tedir. Runner her çalışmada gerçek veriden modeli yeniden oluşturur ve değerlendirmeyi saklar; sır içeren model cache'i kullanılmaz.

Repo Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`; opsiyonel Copernicus kimlik bilgileri ve `GEMINI_API_KEY`. Repo Variables: `APP_URL`, opsiyonel `GEMINI_MODEL`, en son **`MONITORING_ENABLED=true`**. Varsayılan kapalıdır; migration ve gönderici doğrulamasından sonra etkinleştirin. İlk denemeyi workflow_dispatch ile çalıştırın. Bu klasör henüz GitHub'a gönderilmedi; zamanlama sunucuda etkin değil.

Canlı veri 3 günden eskiyse uyarı üretilmez. Gözlenen ve öngörülen olaylar ayrı kayıtlanır. Aynı kaynak/bölge/tür için süreklilik gösteren olaylar tekilleştirilir; üç sessiz günden sonra yeni bölüm açılır. Gönderim lease'i yarışları önler. Resend idempotency anahtarı ve istek gövdesi kalıcıdır. Başarısız gönderimler, anomali sonlansa bile outbox'tan yeniden denenir. İlk denemeden **23 saat** sonra belirsiz gönderimler otomatik tekrar edilmez; Resend panelinden mutabakat gerekir ([24 saat sağlayıcı penceresi](https://resend.com/docs/dashboard/emails/idempotency-keys)).

Gemini yalnız sabit takip/inceleme yorum kodları seçebilir; sayısal gövde ve nedensellik sınırları uygulamada hazırlanır. API/şema hatasında şablon rapor kullanılır. Bu nedenle serbest LLM metni, uydurma sayılar veya doğrulanmamış atıf rapora giremez.

## Doğrulama ve derleme

```powershell
.venv\Scripts\python.exe -X utf8 -m pytest -q
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run test:db
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
```

Gerçek model/veri artefaktları indirilmemiş temiz checkout'ta bunlara bağlı testler açıkça skip edilir. Yerelde hem Copernicus hem NOAA artefaktlarıyla çalıştırıldı. PostgreSQL testleri PGlite üzerinde gerçek SQL/RLS semantiğini sınar; canlı Supabase deployment testi değildir. Tarayıcı testleri masaüstü ve mobil Chromium'da gerçek snapshot, harita, filtre, rapor indirme, giriş yapılandırması ve responsive taşma kontrolünü kapsar.

UI 0.2 testleri 1920/1366/768/390 px Chromium, tema kalıcılığı, replay URL'si, yerel tercih, hata/yeniden deneme ve açık/koyu görünümde axe-core erişilebilirlik denetimini kapsar. Önce/sonra ekranları `docs/screenshots/` altında. Yeniden almak için dev server açıkken `node scripts/capture-ui.mjs after`.

`test:e2e` önce production build oluşturur, ardından 5175 portunda geçici Vite preview başlatır. Geliştirme sunucusunun 5173 portundan bağımsızdır. CI bu adım üzerinden production build'i de doğrular.

## Performance Lab

`/performance`, sürümlü rolling-origin raporunu 8.490 gerçek held-out tahminle birleştirir. Ufuk/yıl/mevsim/olay filtreleri, aynı hedef tarihlerde baseline karşılaştırması, açık tolerans oranları ve kapsamı kayıtlı indirilebilir/yazdırılabilir HTML raporu sunar. Veri kaynağı/hash uyuşmazlığında sonuç gösterilmez. Üretim: `.venv/Scripts/python.exe -X utf8 scripts/export_performance_traces.py`; yöntem ve sınırlar [PERFORMANCE_LAB.md](docs/PERFORMANCE_LAB.md). Bu komut mevcut CSV'leri okur; eğitim yapmaz ve eski artefaktları değiştirmez.

## E-posta önizlemeleri

Manuel geçmiş TEST, gözlenen anomali ve deneysel tahmin şablonlarının yerel HTML/düz metin ve ekran kontrolleri [EMAIL_EXPERIENCE.md](docs/EMAIL_EXPERIENCE.md) içinde. `.venv/Scripts/python.exe -X utf8 scripts/preview_emails.py` yalnız gerçek geçmiş raporları render eder; mesaj göndermez. Otomatik tahmin ve gerçek otomatik e-posta izinleri değişmez.

## Ayrı challenger araştırması

Eğitimden önce ilan edilmiş koşullarla `ThermaTwin Forecasting Engine — candidate vNext` denendi. 72 saatte sıcaklık hatası azaldı; 24/48 saat ve erken olay kapıları geçilemedi. **Champion korunur; terfi önerilmez.** [Tam karşılaştırma, protokol ve ayrı hash doğrulamalı paket](research/candidate-vnext/REPORT.md). Deney üründeki tahminleri veya otomatik bildirimleri değiştirmez.

## Veri güncelliği

Dashboard gözlem gününü, kaynak erişimini, analiz işlem zamanını ve tahmin başlangıcını ayırır. Yeni bir erişim, eski gözlemi güncel yapmaz. Snapshot'ın doğrulamadığı yayın zamanı veya başarılı monitoring turu bilinmiyor olarak gösterilir. Sınıflandırma ve değiştirilmeden incelenen operasyon sınırları [FRESHNESS_OPERATIONS.md](docs/FRESHNESS_OPERATIONS.md) içinde. Son inceleme galerisi: `node scripts/capture-product.mjs final`, ardından `node scripts/product-gallery.mjs final`.

## Yayına hazırlama

`npm.cmd run build` sonucu `dist/` statik host'a verilebilir. SPA için `/dashboard`, `/regions`, `/subscriptions`, `/alerts`, `/login` istekleri `index.html` dosyasına yönlendirilmelidir. Üretim `VITE_` değerlerini build öncesinde tanımlayın. Gerçek snapshot'lar Supabase'ten okunur; hesap yokken tarihli statik dosya fallback'i kullanılır. Test e-postası API'si ayrıca HTTPS Python sunucusu gerektirir; CORS allowlist'i gerçek frontend adresiyle sınırlandırın. Bu oturumda dağıtım yapılmadı.

## Kapsam sınırları

Uydu L4 foundation SST, anlık sensör veya gerçek tesis deşarj telemetrisi değildir. Bölgesel referans nedensel counterfactual değildir. Akıntı/ERA5 füzyonu, fiziksel plume yayılımı, tür bazlı biyolojik eşik, tesis etkisi ayrıştırması ve bağımsız saha doğrulaması bu MVP'de uygulanmadı. Üründe bu çıktılara ilişkin başarı iddiası yoktur.
