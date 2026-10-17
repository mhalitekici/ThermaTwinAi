# ThermaTwin AI — canlı hesap bağlantısı ve kabul testi

**17 Ekim 2026 güncellemesi:** incelemede API çalışmıyordu; yeniden başlatıldı. `npm.cmd run dev` artık frontend ile API'yi birlikte başlatır. Önceki iki TEST mesajı Resend'in salt okunur mesaj sorgusunda `delivered` döndü; alıcı posta sunucusu kabulü doğrulandı, gelen kutusunda görünmesi kullanıcı teyidi gerektirir. Yeni gerçek mesaj gönderilmedi. `/alerts` günlük görünümünde TEST alanı ve geçmiş kayıtlar bulunur; **Teslim durumunu kontrol et** yeni `/deliveries/{id}/status` ucunu kullanır. Oturum doğrulaması ve kullanıcı kimliğiyle sorgu zorunludur; başka hesabın kaydı 404 verir, sağlayıcı içeriği/adresleri tarayıcıya taşınmaz. Eksik servis, tekrar engeli ve hata mesajları görünür; bağlantı yeniden denenebilir.

**16 Ekim 2026 durumu:** Gerçek Supabase projesi bağlandı; gerçek Resend API domain okuması ve SMTP kimlik doğrulaması çalıştı. Yerel `.env` production istemci bağlantısını ve sunucu anahtarlarını içerir; değerler kaynak koduna yazılmadı. Kullanıcı gerçek OTP ile **giriş ve aboneliği tamamladığını bildirdi**. Manuel TEST alıcısı giriş yapan doğrulanmış hesabın kendi adresidir; sabit alıcı ayarı kaldırıldı. **TEST anomali e-postasının gelen kutusuna teslimi henüz doğrulanmadı.** Özgün modeller, veri ve PDF'ler korunur. Mevcut ML denetimi, bağımsız otomatik tahmin uyarısını desteklemiyor.

Gerçek ortamda doğrulananlar:

- Supabase public Auth e-posta sağlayıcısı, sunucu tablo/kolon erişimi, üç RPC'nin metadata'da varlığı ve aktif Akkuyu kaydı. Anonim istekler özel kayıt döndürmedi; bu tek başına iki kullanıcıyla RLS kabulü değildir.
- Mevcut, hash kontrolünden geçen Copernicus/model dosyalarından **6.864 gözlem ve 24/48/72 saat tahminleri** uzaktaki veritabanına kaydedildi. `16 Ekim 2026` snapshot'ı geri okunup gözlem/tahmin eşitliği doğrulandı; `monitor_runs` shadow turu tamamlandı. Yeni veri indirilmedi ve model yeniden eğitilmedi.
- Production dashboard tarayıcıda gerçek Supabase snapshot'ını HTTP 200 ile okudu; giriş formu erişilebilir. Tarayıcı isteklerinde server secret saptanmadı. Yerel API `http://127.0.0.1:8000` üzerinde çalışır.
- Resend `GET /domains`: `mentraweb.com` verified/sending enabled. Gönderici `noreply@mentraweb.com`. SMTP SSL/465 kimlik doğrulaması **235** döndürdü; mesaj gönderilmedi. SMTP'nin kabulü Supabase hosted SMTP'nin ayarlandığı anlamına gelmez.
- Otomatik gönderimler shadow, tahmin e-postaları kapalı. **Doğrulanmış ve açık onaylı her abone kendi adresine manuel TEST** isteyebilir; alıcı Supabase'te doğrulanan oturum sahibinin kimliğinden bulunur. İstemcinin alıcı adresi/kimliği vermesi reddedilir. Shadow turunda alarm adayı/gönderim yoktu; bu tur bir anomali e-postasını doğrulamaz.

Kullanıcının sıradaki işlemi: uygulamada e-postaya gelen kodun tamamıyla OTP girişi ve açık bildirim onayı vermek; ardından manuel TEST anomali e-postasını doğrulamak. Hosted SMTP/OTP kurulumu aşağıda belgelenir; proje secret anahtarı hosted Auth ayarlarını değiştiremez.

## Modlar ve izin sınırları

| Ayar | Varsayılan | Etki |
|---|---|---|
| `VITE_APP_MODE` | `demo` | Demo: yalnız tarayıcı tercihleri, Auth/gerçek abonelik yok. `production`: Supabase SDK, OTP ve RLS ile kişisel kayıtlar. Eksik bağlantı sessizce demoya düşmez. |
| `NOTIFICATION_MODE` | `shadow` | Gözlem/anomali/rapor çalışır, uygun abonelere gönderilmeyen prova kaydı oluşur. |
| `AUTOMATIC_EMAILS_APPROVED` | `false` | Gerçek otomatik gönderim kapalı; `live` seçilmesi tek başına yeterli değildir. |
| `ENABLE_FORECAST_EMAILS` | `false` | Öngörülen risk e-postaları engellenir; dashboard analizi korunur. |
| `TEST_EMAIL_ENABLED` | `false` | Yalnız açıkça tıklanan, giriş yapan doğrulanmış/izinli hesabın kendi adresine TEST gönderimi için ayrı kapı. |

Supabase OTP, kullanıcının giriş isteğiyle oluşan kimlik doğrulama e-postasıdır. Anomali shadow ayarı OTP'yi kapatmaz. Giriş yapmak, bildirim onayı değildir.

Test sunucusu yalnız `tests/integration_server.py` içindedir. Uygulamada sahte oturum veya OTP arka kapısı bulunmaz. Test üretimi `dist-integration-test/`, normal üretim `dist/` altındadır; test çıktısı yayımlanmamalıdır.

Demo regresyonları `dist-demo-test/` altında ayrıca üretilir. Gerçek `.env` sonradan doldurulsa da testler gerçek servisleri kullanmaz. Yerel HTML önizlemesi için `python scripts/preview_email.py`: `artifacts/email-preview.html` ve `.txt` üretir, hiçbir gönderim yapmaz.

## Kullanıcıdan beklenen işlemler — sırasıyla

### 1. Supabase projesi ve SQL

Önce bir staging projesi oluşturun. Dashboard'dan proje URL'sini, publishable/legacy anon anahtarını ve **sunucu için** secret/legacy service-role anahtarını alın. Değerleri sohbete veya kaynak koda yazmayın; yerel `.env` ya da hosting/GitHub secret alanlarına girin. `SUPABASE_SERVICE_ROLE_KEY` uyumluluk alanı yeni `sb_secret_` anahtarını da kabul eder; yeni anahtar JWT gibi Bearer başlığına konmaz.

Yeni veritabanında SQL Editor üzerinden sırayla:

1. `supabase/migrations/202610160001_initial.sql`
2. `supabase/migrations/202610160002_consent_shadow.sql`

İlk migration zaten uygulandıysa yalnız ikinciyi uygulayın. CLI migration geçmişi kurulmuş projede alternatif `supabase db push` kullanılabilir; SQL Editor ve CLI geçmişini kontrol etmeden ilk migration'ı yeniden uygulamayın.

İkinci migration eski kayıtları silmez; eski `active=true` durumu e-posta izni sayılmaz. Bütün mevcut abonelikler ayrıca açık e-posta onayı vermelidir. Abonelik değişimleri `manage_subscription` RPC'sinden, doğrulanmış `auth.uid()` ile yapılır. İstemcinin doğrudan insert/update/delete yetkisi kaldırılır. Kullanıcı bazında RLS; sunucuya özel gönderim RPC'si ve monitor geçmişi korunur.

### 2. Resend domain ve Supabase Custom SMTP

Resend'de sahip olduğunuz domain veya gönderim alt domain'ini ekleyin. Dashboard'un verdiği **o domaine özel SPF/DKIM DNS kayıtlarını** DNS sağlayıcınıza ekleyin; doğrulama tamamlanana kadar gerçek gönderime geçmeyin. Resend'de gönderim yetkili bir API anahtarı oluşturun.

Supabase Authentication → Email/SMTP ayarlarında:

| Alan | Değer |
|---|---|
| SMTP host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API anahtarı — yalnız Supabase'in gizli SMTP alanına |
| Sender email | Doğrulanmış domaindeki adresiniz |
| Sender name | `ThermaTwin AI` |

Bu yerel bağlantıda doğrulanmış gönderici **`noreply@mentraweb.com`** olarak seçildi. Password alanına `.env` içindeki güncel `RESEND_API_KEY` değerini yalnız Supabase'in SMTP gizli alanında kullanın. Yereldeki `supabase/config.toml` bu hosted ayarları kendiliğinden uygulamaz.

Domain olmadan geliştirme yapılırsa `onboarding@resend.dev` yalnız Resend hesabının kendi adresine test gönderebilir. Başka kullanıcılar için DNS ile doğrulanmış domain gerekir; API anahtarı oluşturmak domain doğrulaması oluşturmaz. Sending-only anahtarın `GET /domains` için `401 restricted_api_key` vermesi anahtarın geçersiz olduğunu göstermez; gönderim yetkisi ile domain okuma yetkisi ayrıdır.

Email provider/signup açık, e-posta doğrulaması açık olsun. Hosted projede çalışan **8 haneli OTP** ayarını koruyabilirsiniz; yerel CLI config de 8 hane kullanır. İstemci Supabase'in desteklediği **6–10 haneli** sayısal kodları aynı giriş/submit kuralıyla kabul eder. Kod sayı tipine çevrilmez, baştaki sıfır korunur ve kısaltılmaz; geçerliliğine sunucu karar verir. Önceki “6 hane olmalı” talimatı kaldırılmıştır. OTP süresi için **600 saniye**, istek limiti için en az 60 saniye kullanın. Site URL/CORS adresleri kullandığınız uygulama adresiyle aynı olsun. Staging'de `http://127.0.0.1:5173`, gerçek hosting'de kendi HTTPS adresiniz.

`supabase/templates/otp.html` içeriğini hem **Magic Link** hem **Confirm signup** şablonuna uygulayın. Kod değişkeni `{{ .Token }}` korunmalıdır. Projedeki `supabase/config.toml` CLI için aynı ayarların karşılığıdır; dosya hosted Dashboard ayarlarını kendiliğinden değiştirmez.

### 3. Yerel environment ve uygulama

`.env.example` dosyasını `.env` olarak kopyalayıp yalnız kendi cihazınızda doldurun:

| Alanlar | Nerede kullanılır? |
|---|---|
| `VITE_APP_MODE=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Tarayıcıya açık Supabase bağlantısı. Yalnız publishable/anon anahtar; service-role/Resend anahtarı burada kullanılamaz. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Python sunucusu / GitHub Secrets. Anahtar alanı yeni secret veya legacy service-role kabul eder. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_SENDER_EMAIL` | Sunucu ve SMTP yapılandırması. `EMAIL_FROM` API göndericisi, `SMTP_SENDER_EMAIL` düz e-posta adresidir. |
| `VITE_API_URL`, `APP_URL`, `ALLOWED_ORIGINS` | API, uygulama ve izinli origin adresleri. |

Bu aşamada **`NOTIFICATION_MODE=shadow`, `AUTOMATIC_EMAILS_APPROVED=false`, `ENABLE_FORECAST_EMAILS=false` kalır.** Manuel TEST'e hazır olduğunuzda yalnız `TEST_EMAIL_ENABLED=true` yapın. `VITE_ENABLE_LIVE_INTEGRATIONS` eski uyumluluk bayrağıdır; `VITE_APP_MODE` önceliklidir.

Sabit TEST alıcısı kullanılmaz. Önceki `REPLAY_TEST_EMAIL` alanı kaldırılmıştır; eski ortamda kalsa da gönderimi etkilemez. Sunucu `Authorization` oturumunu Supabase üzerinden doğrular, yalnız o kullanıcının kimliğini mail motoruna geçirir. Mail motoru bu kimliğin güncel doğrulanmış adresini sunucudan okur. İstek gövdesinde `email`, `to`, `user_id` gibi alıcı alanları kabul edilmez. Gönderim öncesinde etkin abonelik/açık onay ve donmuş gövdenin güncel alıcıyla eşleşmesi tekrar denetlenir.

Frontend ve API'yi tek terminalde başlatın:

```powershell
npm.cmd run dev
```

Yalnız frontend için `npm.cmd run dev:frontend`; yalnız API için `.venv\Scripts\python.exe -m uvicorn thermatwin.api:app --host 127.0.0.1 --port 8000` kullanılabilir. Aynı portlarda çalışan mevcut servisleri kendi terminallerinden kapatmadan ikinci kopya başlatmayın.

Vite environment değişikliklerinden sonra frontend'i yeniden başlatın. Sunucu anahtarları `VITE_` alanlarına konursa build bunu reddeder; yalnız publishable/anon anahtarı tarayıcıya girebilir.

Önce e-posta göndermeyen yapılandırma kontrolünü çalıştırın:

```powershell
.venv\Scripts\python.exe -X utf8 scripts\check_integrations.py
.venv\Scripts\python.exe -X utf8 scripts\check_integrations.py --remote
```

İlk komut yalnız yerel alanları, anahtar türlerini, proje/origin eşleşmesini ve shadow güvenlik ayarlarını kontrol eder. `.env` dosyasını oluşturmaz/değiştirmez; anahtar, adres veya servis hata gövdesi yazdırmaz. İkinci komut, yerel kontroller geçerse **yalnız GET** ile Supabase Auth e-posta sağlayıcısını, beklenen tablo/kolonları, aktif Akkuyu kaydını ve anonim erişimin özel kayıt döndürmediğini kontrol eder. OTP istemez, RPC çağırmaz, veritabanına yazmaz, Resend'e bağlanmaz. Yönlendirmeler takip edilmez.

`--json` değer içermeyen makine okunabilir rapor verir. Eksik/hatalı ayarda veya istenen uzak kontrol başarısızsa çıkış kodu `1`, istenen teknik kontroller geçerse `0` olur. **Başarılı sonuç canlı uçtan uca kabul anlamına gelmez:** boş tabloda anonim kayıt görülmemesi RLS politikasını kanıtlamaz; hosted SQL/RPC yetkileri iki gerçek kullanıcıyla ayrıca test edilmelidir. Domain/DNS/SMTP şablonları, gerçek OTP ve gelen kutusu teslimi daima ayrı bekleyen kontrollerdir. `TEST_EMAIL_ENABLED=true` olsa da bu komut gönderim yapmaz.

### 4. Gerçek kabul testi

1. `/login`: kendi adresinize OTP isteyin; gelen kutusunda gerçek kodu görün, girin. Yanlış/süresi dolmuş kod ve 60 saniye bekleme davranışını kontrol edin.
2. Sayfayı yenileyin: oturum korunmalı. Çıkış yapıp tekrar giriş yapın.
3. Akkuyu izlemeyi etkinleştirin. Kutucuk işaretlenmeden e-posta izni oluşmamalı. Açık onayla bildirimleri açın.
4. `/alerts?mode=replay&event=2024-06-07`: gerçek Copernicus geçmiş raporunu inceleyin. **TEST e-postası gönder** düğmesinin yanındaki alıcı kendi oturumunuzun adresi olmalı; düğmeye basın.
5. Resend kabul kimliğini ve `deliveries` kaydını kontrol edin. **API kabulü gelen kutusuna teslim değildir.** Gelen kutusu/spam klasöründe TEST başlığı, 7 Haziran 2024 tarihi, bölge, 27.01 °C gözlem, referans ve sınır açıklamalarını ayrıca doğrulayın.
   Bildirim geçmişindeki **Teslim durumunu kontrol et** ile sağlayıcının teslim, gecikme veya ret durumunu okuyabilirsiniz. Kontrol yalnız GET yapar; API anahtarının e-posta okuma yetkisi gerekir. Sağlayıcı hatası teslim başarısı olarak sunulmaz.
6. Aynı olay için ikinci tıklama yeni e-posta üretmemeli. Bildirimleri durdurun; abonelik açık kalırken e-posta izni kapanmalı. İptal/yeniden abonelik tek `(user_id,region_id)` kaydı olmalı; yeniden açık onay gerekir.
7. İkinci gerçek hesapla ilk hesabın abonelik ve gönderim geçmişini göremediğinizi doğrulayın. İkinci hesap onaysız/abonesizse TEST reddedilmeli; doğrulanmış ve açık onaylı abonelikten sonra yalnız ikinci hesabın kendi adresine TEST gitmeli. Aynı olayın tekrarında yeni mesaj gitmemeli.

Bu kabul adımları **henüz gerçek kullanıcıyla tamamlanmadı**. Domain okuması, SMTP kimlik doğrulaması ve Supabase shadow izleme yukarıda ayrıca doğrulandı. Hosted SMTP/OTP şablonlarının uygulanması, gerçek kod alımı, token yenileme ve gelen kutusu kabulü tamamlandıkça işaretlenecek.

### 5. GitHub Actions — yalnız shadow monitoring

Mevcut workflow elle tetiklenebilir. Zamanlama ancak repository variable `MONITORING_ENABLED=true` ise çalışır. Workflow gönderim bayraklarını doğrudan **shadow / false / false / false** olarak sabitler; Resend anahtarına ihtiyaç duymaz ve otomatik gerçek e-posta göndermez.

Monitoring mevcut modeli yeniden eğitmez. Yerel paket hazır: `artifacts/thermatwin-runtime.zip`. Yeniden paketlemek için:

```powershell
.venv\Scripts\python.exe -X utf8 scripts\package_monitor_model.py
```

Bu paket yalnız özgün model ve kalibrasyon politikasını içerir; `docs/runtime-model-manifest.json` SHA-256 değerlerini sabitler. Güvendiğiniz kendi repository release asset'ine yükleyip kalıcı HTTPS indirme adresini `MODEL_BUNDLE_URL` variable'ına koyun. Özel GitHub asset'i için `https://api.github.com/repos/OWNER/REPO/releases/assets/ASSET_ID` adresi mevcut `GITHUB_TOKEN`/contents:read ile desteklenir. Başka kişinin joblib/pickle dosyasını kullanmayın.

Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; isteğe bağlı Copernicus Toolbox hesapları. Önce `workflow_dispatch`, sonra `monitor_runs` durum/tarih/hata kaydını ve `snapshots` güncellemesini inceleyin. Ardından günlük shadow zamanlamayı açabilirsiniz. Model/dataset sürüm uyuşmazlığı, eski/eksik veri ve sağlayıcı hataları gönderim üretmez. Model hazırlama hataları da monitoring hata kaydına girer; veritabanına erişilemiyorsa uzakta kayıt yazılamaz, GitHub job hatası esas alınır.

Gerçek otomatik bilgi e-postalarını açmak **ayrı bir kullanıcı onayı ve workflow değişikliği** gerektirir. Bu doküman ve geliştirme otomatik gönderimleri etkinleştirmez. Öngörülen risklerin ML sınırlamaları sürer.

## Kayıt ve idempotency

- Sabit model/olay kimliği ve SQL kilidi aynı olayı tekilleştirir. Önceki kayıtlar için tarih tabanlı uyumluluk korunur.
- `deliveries` benzersiz anahtarı `(alert_id,user_id,dispatch_mode)`; shadow kayıtlar gerçek gönderime dönüştürülmez.
- Gerçek TEST/live denemesinde gövde dondurulur, lease/claim token eşzamanlı göndereni engeller. Aynı Resend idempotency key/gövdeyle yalnız 23 saat içinde tekrar denenebilir; sonrası `uncertain`, manuel kontrol. Bu Resend'in 24 saatlik idempotency penceresinin altındadır.
- Onay iptali SQL claim sırasında tekrar kontrol edilir. Değişmiş e-posta adresine ait eski donmuş gövde gönderilmez. Eski veri/eksik gözlem, normal gözlem ve varsayılan tahmin riskleri gönderim katmanında da engellenir.
- Olay raporu immutable tutulur; uzun olayda ilk rapor artık eskiyse yeni aboneye de eski bildirim gönderilmez. Yeni analiz dashboard'da görülür. Bu bilinçli koruma, devam eden eski bir olayda yeni abonenin e-posta almamasına yol açabilir.
- `sent`, Resend'in isteği kabul ettiği anlamına gelir. Teslim/bounce webhook'u bu aşamada yoktur; gelen kutusu teslimi kullanıcı ve Resend paneliyle doğrulanmalıdır.

## Yerelde doğrulanan / gerçek ortamda bekleyen

| Kontrol | Durum |
|---|---|
| Python gönderim kapıları, şablon fallback'i, JSON rapor kaydı, timeout/lease | Yerelde, HTTP mock'larıyla |
| PostgreSQL/RLS, onay, iki hesap izolasyonu, iptal, shadow/test ayrımı | Yerel gerçek PostgreSQL semantiği (PGlite); hosted Supabase değil |
| OTP → oturum → abonelik → tarihsel monitoring → rapor → TEST → tekrar engeli → ikinci hesap | Masaüstü/mobil tarayıcı + gerçek FastAPI; Supabase/Resend test servisleriyle |
| Mevcut ML, veri, PDF ve dashboard regresyonları | Yerel testler ve hash manifesti |
| Gönderimsiz bağlantı kontrolü ve secret/legacy anahtar başlıkları | Yerel hata senaryoları ve gerçek Supabase GET kontrolleri başarılı; tam kullanıcı kabulü ayrı bekler |
| Gerçek Supabase bağlantısı / şema / shadow yazma ve geri okuma | Başarılı; iki gerçek kullanıcıyla Auth/RLS kabulü bekliyor |
| Gerçek production dashboard → Supabase snapshot | Başarılı; 16 Ekim 2026 gerçek gözlem/tahminleri |
| Gerçek Resend domain okuması / SMTP SSL kimlik doğrulaması | Başarılı; verified domain ve SMTP 235. E-posta gönderimi değildir |
| Hosted Custom SMTP / OTP şablonları / gerçek OTP alımı | Kullanıcı 8 haneli gerçek OTP aldığını bildirdi; hosted ayarların programatik denetimi yapılmadı, oturum kabulü bekliyor |
| Gerçek Resend mesaj kabulü ve gelen kutusu teslimi | Hesap anahtarları hazır; doğrulanmış/izinli test oturumu bekliyor. Gönderim iddia edilmez |
| GitHub hosted runner ve zamanlanmış shadow | Repository/secrets/model paketi bekliyor |

## Resmî yapılandırma kaynakları

- [Supabase e-posta OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Auth yapılandırma kaynağı — e-posta OTP uzunluğu 6–10](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)
- [Supabase public/secret anahtar türleri ve başlıkları](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend ile Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Resend idempotency penceresi](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend domain/test adresi ve restricted key hata ayrımı](https://resend.com/docs/api-reference/errors)
