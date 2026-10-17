# ThermaTwin AI — Vercel ve HTTPS API dağıtımı

17 Ekim 2026 güncellemesi: PR #2 kullanıcı onayıyla `main` dalına birleştirildi. Kullanıcının bildirdiği mevcut durumda Render API `https://thermatwin-api.onrender.com` adresinde, GitHub'a bağlı Vercel projesi `thermatwin-ai`; ilk Production build başarısız. Hosted Supabase/Resend bağlantıları henüz hazır değil. İlk hedef **Preview demo**. Yeni düzeltme dalı `fix/vercel-build-environment`, kullanıcı onayı olmadan `main` ile birleştirilmez. Bu düzeltme hesap ayarlarını/migration'ları değiştirmez ve gerçek e-posta göndermez.

## Mimari ve neden

```text
Tarayıcı ── HTTPS ── Vercel: React/Vite, dist/
         ├─ HTTPS ── Supabase: OTP, oturum, abonelik/RLS, son snapshot
         └─ HTTPS ── Render: FastAPI, geçmiş TEST, kişisel teslim sorgusu
                              ├─ Supabase: doğrulanmış kullanıcı, onay ve outbox
                              └─ Resend: e-posta API'si
GitHub Actions ── mevcut model + Copernicus ── Supabase snapshot (shadow)
```

Seçim: **Vercel frontend + Render Free üzerinde ayrı FastAPI Docker servisi**. Vercel Python, ASGI/FastAPI destekler; ancak mevcut bilimsel bağımlılıkları, Git'te bulunmayan modelleri ve monitoring işini doğrudan bir HTTP function içine taşımak uygun değil. Vercel'in standart Python paket sınırı 500 MB açılmış boyuttur. Yerel Windows bilimsel kurulumu yaklaşık 593 MiB; bu bir Linux/Vercel bundle ölçümü değildir. Hafif API kurulumu yaklaşık 16 MiB ve 18 pakettir. [Vercel Python kapsamı ve sınırları](https://vercel.com/docs/functions/runtimes/python).

API import zinciri artık ML eğitim/indirme kütüphanelerini yüklemez. `events.py` ve `warning_decision.py` var olan saf hesapları paylaşır; `pipeline`/`warning` bunları yeniden dışa aktarır. Modeller, kalibrasyon, sayılar ve geçmiş JSON raporları korunur. HTTP isteğinde eğitim, Copernicus indirme veya Gemini çağrısı yapılmaz. Üretimde son snapshot Supabase'den okunur; bağlantı hatası eski bir dosyaya sessiz dönüş yapmaz. Kalıcı abonelik/gönderim durumu Supabase'dedir; API diski yalnız paketlenmiş geçmiş veriyi okur.

Render Free 15 dakika trafik almayan servisi uyutabilir; sonraki açılış yaklaşık bir dakika sürebilir. Ayda workspace başına 750 ücretsiz servis saati ve diğer kullanım limitleri vardır; kesintisiz production SLA'sı vaat edilmez. Demo öncesi `/health` adresini açıp hazır olduğunu kontrol edin. Bir soğuk başlangıçtan sonra arayüzde “Bağlantıyı yeniden dene” gerekebilir. [Render Free sınırları](https://render.com/docs/free).

## Dosyalar

| Dosya | İşlev |
|---|---|
| `vercel.json` | Vite preset, build/output, yalnız bilinen uygulama sayfaları için rewrite |
| `src/deployment.ts`, `vite.config.ts` | Production HTTPS kontrolü, public değişken izin listesi, preview bağlantı temizleme |
| `deploy/frontend-*.env.example` | Vercel Production ve Preview örnekleri |
| `deploy/backend-production.env.example` | API ortam örneği; gerçek değer içermez |
| `deploy/api/Dockerfile`, `requirements.in`, `requirements.txt` | Non-root HTTP runtime; hash ile kilitlenmiş hafif bağımlılıklar |
| `.dockerignore`, `.vercelignore` | Sırlar, yerel veri/model ve geliştirme çıktılarının upload kapsamını daraltır |
| `render.yaml` | İsteğe bağlı Render Blueprint; otomatik deploy kapalı, bütün gönderimler kapalı başlar |

## Yayın sırası ve onay sınırı

Mevcut projeler oluşturulduğundan ilk deneme için **bölüm 3'teki Preview adımlarını** izleyin. GitHub bağlantısı açıkken bu düzeltme dalına push, otomatik Preview deployment oluşturabilir. `main` Production branch olarak kalmalı; bu düzeltme onaysız merge edilmez. Aşağıdaki Production adımları gerçek Supabase yapılandırması tamamlandıktan sonra uygulanır. İlk yayın için yalnız yeşil CI'lı commit kullanılmalı.

1. PR'yi inceleyin; merge için açık onay verin.
2. Kullanılacak frontend adresini seçin; örnek `https://thermatwin-ai.vercel.app`. Örnekler rezerve edilmiş gerçek proje adresi değildir.
3. Render API'yi aşağıdaki ayarlarla oluşturun, gerçek HTTPS API adresini alın.
4. Vercel frontend'i Production değişkenleriyle oluşturun.
5. Gerçek frontend URL'sini Render `APP_URL`/`ALLOWED_ORIGINS` ve Supabase Site URL alanlarıyla eşleştirin.
6. Aşağıdaki kabul testlerini tamamlayın. Otomatik gönderimleri açmayın.

## 1. Render FastAPI backend

Windows 11/VS Code kullanıcısı Docker'ı yerelde kurmadan Render Dashboard üzerinden dağıtabilir:

1. Render hesabında **New → Web Service → GitHub** yoluyla `mhalitekici/ThermaTwinAi` deposunu seçin.
2. Branch: onaylı değişiklikler birleştikten sonra `main`. Runtime: **Docker**.
3. Repository root/context: `.`. Dockerfile path: `deploy/api/Dockerfile`. Root Directory'yi `backend` yapmayın; `public/*.json` ve `deploy/` kökten kopyalanır.
4. Plan: **Free**, region: uygun olduğunda **Frankfurt**, health check: `/health`. Docker CMD portu Render'ın `PORT` değişkeninden alır; portu sabit dış URL'ye eklemeyin.
5. Auto-deploy'u ilk kabul tamamlanana kadar **Off** tutun. Daha sonra istenirse yalnız CI başarılı olduğunda deploy seçilebilir. `render.yaml` aynı başlangıç davranışını tanımlar. Blueprint import işlemi de servis oluşturup ilk deploy'u başlatır; bu çalışma sırasında yapılmadı.
6. Aşağıdaki backend değişkenlerini **Render Environment** alanlarına girin. Anahtarları sohbet/issue/PR veya ekran görüntüsüne koymayın.
7. İlk manuel deployment'tan sonra `https://GERCEK_API.onrender.com/health` isteğinin HTTP 200 döndüğünü doğrulayın. Bu kontrol SMTP/OTP/teslim kabulü değildir.

| API değişkeni | Production ayarı |
|---|---|
| `APP_ENV` | `production`; hosted ortamda `.env` okunmaz |
| `SUPABASE_URL` | Mevcut projenin HTTPS URL'si |
| `SUPABASE_SERVICE_ROLE_KEY` | Mevcut server-only secret/service-role anahtarı |
| `RESEND_API_KEY` | Mevcut Resend sunucu anahtarı |
| `EMAIL_FROM` | Mevcut doğrulanmış gönderici |
| `APP_URL` | Gerçek frontend HTTPS origin'i; `/dashboard` gibi path eklemeyin |
| `ALLOWED_ORIGINS` | Gerçek frontend HTTPS origin'i; gerekirse virgülle ayrılmış kesin origin'ler |
| `NOTIFICATION_MODE` | `shadow` |
| `AUTOMATIC_EMAILS_APPROVED` | `false` |
| `ENABLE_FORECAST_EMAILS` | `false` |
| `TEST_EMAIL_ENABLED` | İlk kontrolde `false`; kontrollü manuel kendi-hesabına TEST kabulünde `true` yapılabilir |

`ALLOWED_ORIGINS=*`, `https://*.vercel.app`, `null`, path içeren veya HTTP origin production başlangıcında reddedilir. `APP_URL` izin listesinde bulunmalıdır. CORS'a ek olarak izin dışı `Origin` taşıyan POST, yan etki oluşturmadan 403 döner. Authorization başlığı zorunlu olan uçlarda kullanıcı Supabase üzerinden yeniden doğrulanır. Production `/docs` ve `/openapi.json` kapalıdır; yanıtlar `no-store`, loglar kişisel hata gövdelerini yazmaz. Uvicorn access log'u container'da kapalıdır.

## 2. Vercel frontend projesi

Mevcut `thermatwin-ai` projesinin ayarlarını kontrol edin. Yeni bir proje gerekiyorsa **Add New → Project → Import Git Repository** yolunu kullanın.

| Ayar | Değer |
|---|---|
| Repository | `mhalitekici/ThermaTwinAi` |
| Production branch | `main` — PR onayla birleştirildikten sonra |
| Framework Preset | **Vite** |
| Root Directory | Repository root, `.` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x`; package.json bu major sürümü sabitler |

`npm run dev` kullanmayın: geliştirme komutu frontend ve yerel Python API başlatır. `dist-demo-test`, `dist-integration-test` veya `dist-deployment-test` dizinlerini yayınlamayın.

Production ortamına **yalnız dört public değişken** girin:

| Vercel değişkeni | Production değeri |
|---|---|
| `VITE_APP_MODE` | `production` |
| `VITE_SUPABASE_URL` | Mevcut public Supabase HTTPS URL'si |
| `VITE_SUPABASE_ANON_KEY` | Mevcut publishable/anon anahtarı; service-role değildir |
| `VITE_API_URL` | Render'ın gerçek HTTPS API URL'si; sonunda `/` gerekmiyor |

Bu değişkenlerde yalnız **Production** kapsamını işaretleyin. `VERCEL_ENV` platform tarafından verilir; elle eklemeyin. Build eksik Production ayarlarını ve localhost/HTTP/kimlik bilgili API URL'sini reddeder. Bilinmeyen dolu `VITE_*` değişkenleri reddedilir, otomatik public prefix yayını kapalıdır; izin listesindeki alanlar açıkça derlenir. Server secret değerlerini Vercel frontend ortamına hiç eklemeyin. Hata mesajları değerleri yazmaz.

`VITE_APP_MODE=demo` ve yalnız `VITE_API_URL` verilmesi **Production için yeterli değildir**. İlk hata düzeltildikten sonra bu yapılandırma Production kontrolünde duracaktır; bu kontrolü aşmak için sahte Supabase anahtarı eklemeyin veya Production branch'i değiştirmeyin. Supabase hazır olana kadar Preview kullanın.

Production URL kesinleşince Render `APP_URL` ve `ALLOWED_ORIGINS` alanlarını güncelleyin. Vite değişkenleri build sırasında gömülür; her değişiklikte yeni deployment/redeploy gerekir. Resend ve service-role anahtarları bu dört frontend alanından hiçbirine kopyalanmamalıdır.

## 3. Preview ve Development

### İlk Preview demo deployment

1. Vercel → `thermatwin-ai` → **Settings → Environment Variables** bölümünde **Preview** kapsamına `VITE_APP_MODE=demo` ekleyin. Production'a eklenmiş değer Preview'a otomatik taşınmaz. Preview için `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ve `VITE_API_URL` gerekmez; canlı değer/secret eklemeyin. Örnek: `deploy/frontend-preview.env.example`.
2. **Production branch `main` olarak kalsın**. `fix/vercel-build-environment` dalının push/PR olayı varsayılan Git bağlantısında Preview oluşturur. PR üzerindeki Vercel durumunu ve **Visit Preview** bağlantısını kontrol edin.
3. Otomatik deployment oluşmadıysa veya Preview değişkenini sonradan eklediyseniz **Deployments → Create Deployment** üzerinden `https://github.com/mhalitekici/ThermaTwinAi/tree/fix/vercel-build-environment` dalını seçin. Hedefin **Preview** olduğunu doğrulayın. Başarısız eski `main` Production deployment'ını yeniden denemek bu düzeltmeyi kullanmaz. [Vercel Git ve branch deployment adımları](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference).
4. Build Command `npm run build`, Output Directory `dist`, Node `24.x` kalsın. `VERCEL_ENV` veya `VITE_VERCEL_*` alanlarını elle eklemeyin; platform yönetir.
5. Preview'da `/dashboard` adresini doğrudan açıp yenileyin. Network'te Supabase auth/abonelik veya Render API isteği olmamalı; OTP/abonelik/TEST canlı işlemleri kapalı kalmalı. Harita tile/font gibi dış statik istekler bu bağlantı kontrolünden ayrıdır. Bu demo, gerçek OTP veya gelen kutusu kabul testi değildir.

### Build hatasının nedeni ve güvenlik sınırı

Vercel, Vite preset'i için `VITE_VERCEL_ENV`, `VITE_VERCEL_URL` ve Git metadata alanlarını otomatik ekler. `loadEnv(..., "VITE_")` zaten mevcut process değişkenlerini de okur; `vite.config.ts` ayrıca `process.env` içindeki aynı prefix'i toplar. Eski `publicDeployment()` yalnız uygulamanın beş giriş alanını tanıdığı için platform metadata'sını da bilinmeyen kullanıcı alanı sayıyordu. Resmî listede bulunan 16 alanın her biriyle aynı hata testte yeniden üretildi. [Vercel framework ortam alanları](https://vercel.com/docs/environment-variables/framework-environment-variables).

Paylaşılan eski hata alan adı içermediğinden başarısız deployment'taki **ilk** reddedilen alanı bu logdan ayırmak mümkün değildir; Vercel hesap/log erişimi olmadan tek bir alan adı kesinmiş gibi raporlanmaz. Yeni bilinmeyen-alan hatası yalnız güvenli biçimde doğrulanmış **alan adını** gösterir; değerleri veya kontrol karakterlerini yazmaz.

Düzeltme `src/deployment.ts` içinde belgelenmiş 16 **tam adı** yalnız build metadata'sı olarak kabul eder. `VITE_VERCEL_*` için wildcard izin yoktur; örneğin `VITE_VERCEL_SECRET` reddedilir. Bu alanlar dönüşteki public nesneye eklenmez; `vite.config.ts` içindeki `envPrefix: []` ve açık `define` eşlemesi korunur. Metadata dahil bütün VITE girişlerinde mevcut secret taraması önce çalışır. Production'ın production modu + public Supabase + HTTPS API koşulları aynen korunur.

| Ortam | Frontend | Backend / hesap |
|---|---|---|
| Development | Mevcut yerel `.env`, `npm.cmd run dev` | Yerel `APP_ENV=development`; mevcut bağlantı korunur |
| Vercel Preview | `VERCEL_ENV=preview` olduğunda zorunlu `demo` | Public Supabase/API URL ve anahtarı derlemeden çıkarılır; gerçek OTP/abonelik/TEST çalışmaz |
| Ayrı staging gerekirse | Ayrı staging istemcisi/deploy'u planlanmalı | Ayrı Supabase projesi ve `APP_ENV=preview`; üretim kullanıcı anahtarları kopyalanmaz |
| Production | Dört gerçek public değişken | Render `APP_ENV=production`, kesin origin, shadow/false/false |

Preview'a yanlışlıkla production public değişkenleri verilse bile canlı bağlantılar temizlenir; secret veya bilinmeyen public alan varsa build yine durur. Backend `APP_ENV=preview` veya `VERCEL_ENV=preview` altında bütün gönderim bayraklarını zorunlu shadow/false yapar. Preview URL'lerini production CORS veya Auth izin listesine wildcard ile eklemeyin. Preview'da bağlı hesap akışı gerekiyorsa canlı kullanıcılarla test etmek yerine ayrı staging planı uygulanmalıdır.

## 4. Supabase ve Resend

Mevcut projenin iki migration'ını yeniden çalıştırmayın. `supabase/migrations` ve RLS/consent RPC'leri korunmuştur. Authentication → URL Configuration → **Site URL** alanını gerçek Production frontend origin'i yapın. Gereken redirect allowlist için yalnız kullanılacak kesin callback/site adresini ekleyin. Mevcut kodla giriş akışı OTP token doğrulamasıdır, yeni OAuth veya magic-link callback'i eklenmedi. Mevcut 6–10 haneli OTP desteği ve hosted 8 hane ayarı korunur. [Supabase URL kuralları](https://supabase.com/docs/guides/auth/redirect-urls).

Custom SMTP, verified sender/domain ve OTP HTML şablonları için [LIVE_INTEGRATION.md](LIVE_INTEGRATION.md) uygulanır. Bu çalışma DNS/SMTP ayarı değiştirmedi. Resend API yalnız backend'den çağrılır. TEST oturum sahibinin Supabase tarafından doğrulanmış güncel adresine, aktif ve açık onaylı abonelikle gider. İstek gövdesi alıcı seçemez; SQL outbox/lease/idempotency korunur. Aynı olay ikinci mesaj üretmez. Teslim sorgusu mesaj göndermez; sağlayıcı `delivered` durumu gelen kutusu yerleşimini garanti etmez.

Hosted Production için henüz tamamlanması gerekenler: gerçek projenin public Supabase URL/publishable anahtarı ve `VITE_APP_MODE=production` Vercel **Production** kapsamına girilmeli; aynı projenin URL'si ve server-only service-role/secret anahtarı Render'da tutulmalı. Supabase Email OTP, kesin Production Site URL/redirect izinleri, mevcut tablolar/RLS/consent RPC'leri ve SMTP/gönderici ayarları doğrulanmalı. Mevcut migration'ları yeniden çalıştırmayın; eksik şema varsa ayrı incelenmeli. Resend anahtarı/gönderici yalnız Render'da olmalı; bu hazırlık gerçek mesaj göndermek için yetki vermez.

Otomatik bayraklar bu çalışma kapsamında değiştirilmez:

```text
NOTIFICATION_MODE=shadow
AUTOMATIC_EMAILS_APPROVED=false
ENABLE_FORECAST_EMAILS=false
```

## 5. Monitoring ve 21 Ekim veri güncelliği

`.github/workflows/monitor.yml` korunmuştur. Gerçek veri/model işi API veya Vercel build sırasında çalışmaz. Günlük üretim snapshot'ı Supabase'de güncellenir; frontend ve production API aynı kaynağı okur.

Korunan kaynak snapshot 16 Ekim 2026 tarihlidir; 21 Ekim demosunda üç gün kuralına göre gecikmiş sayılacaktır. Demo öncesinde mevcut **shadow** monitoring akışının gerçek Supabase anahtarları, güvenilen model bundle URL/hash'i ve gerekli repository variables ile kurulup başarılı tur yapması gerekir. `MODEL_BUNDLE_URL` ve `MONITORING_ENABLED` mevcut hesap durumundan bağımsız olarak otomatik açılmadı. Adımlar [LIVE_INTEGRATION.md](LIVE_INTEGRATION.md) içindedir. Yeni model eğitmeyin veya gecikme uyarısını kapatmayın. GitHub'daki 7 artifact testi model/veriler Git'te olmadığı için atlanır; aşağıda ayrı listelenmiştir.

## 6. Yerel ve CI doğrulaması

VS Code → Terminal → PowerShell:

```powershell
Set-Location 'C:\Users\halit\Desktop\Therma_Twin_Ai'
npm.cmd ci
npm.cmd run lint
npx.cmd tsc -b
npm.cmd run test:unit
npm.cmd run test:config
npm.cmd run test:deployment
.venv\Scripts\python.exe -X utf8 -m pytest -q -rs
npm.cmd test
npm.cmd run build
```

`npm test` public/secret kapıları, birim, PostgreSQL/RLS, 36 dashboard/routing, 10 bağlı browser senaryosu ve production/preview izolasyon derlemelerini çalıştırır. Bağlı testler gerçek frontend SDK'sı ve FastAPI ile kontrollü Supabase/Resend servislerini kullanır; gerçek e-posta göndermez. RLS testi PGlite PostgreSQL üzerinde çalışır; hosted iki-kullanıcı kabulünün yerine geçmez.

`test:deployment`, Vercel'in 16 prefixed sistem alanını içeren üç gerçek Vite build'i çalıştırır: geçerli Production fixture, Production public ayarları yanlışlıkla kopyalanmış Preview ve Supabase'siz Preview demo. Ayrıca eksik Production Supabase/demo ayarı, bilinmeyen kullanıcı ve Vercel benzeri alanlar, public alana veya metadata'ya konmuş server secret için altı başarısız build bekler. Fixture sunucu anahtarları/metadata bundle'a, hassas test değerleri hata loguna giremez. Bunlar yalnız sahte fixture değerleridir; gerçek sağlayıcı çağrısı yapılmaz.

`scripts/preview-vercel.mjs`, bu projenin **literal rewrite sözleşmesini** yerelde uygular. Vercel altyapısının emülatörü değildir. Bütün route'lar, refresh, gerçek JSON/JS asset yanıtları ve `/api/*`/eksik dosyaların HTML'e dönüşmediği bu sunucuya karşı test edilir. Gerçek Vercel CDN/TLS/hesap ayarları yayın sonrası ayrıca doğrulanır.

Hafif HTTP bağımlılıklarının yerel kontrolü `.venv` dışında ayrı ortam kullanır. Docker Desktop çalışıyorsa aynı dosya Linux container'da da denenebilir:

```powershell
docker build -f deploy/api/Dockerfile -t thermatwin-api:local .
docker run --rm -e APP_ENV=preview -e TEST_EMAIL_ENABLED=true thermatwin-api:local python /app/smoke_api_runtime.py
```

Bu yalnız image build/test'tir; servis yayınlamaz. CI ayrıca production HTTP sınırlarını gerçek anahtar olmadan container'da test eder. `requirements.in` değişirse lock dosyasını `uv pip compile deploy/api/requirements.in --python .venv/Scripts/python.exe --universal --generate-hashes --output-file deploy/api/requirements.txt` ile güncelleyin. Tam ML bağımlılıklarını API image'ine kurmayın.

Temiz GitHub checkout'unda beklenen **7 atlama**:

| Test | Neden |
|---|---|
| `test_invalid_inference_date_is_rejected` | Yerel gerçek model yok |
| `test_real_hindcast_boundaries_baseline_and_replay` — NOAA | Yerel model/gözlem yok |
| Aynı test — Copernicus | Yerel model/gözlem yok |
| `test_trusted_model_bundle_installation_is_hash_checked_and_non_overwriting` | Yerel runtime ZIP yok |
| `test_real_historical_observation_runs_through_shadow_monitor_without_provider` | Yerel gerçek model/gözlem yok |
| `test_real_report_confusion_calibration_and_model_are_reproducible` | Yerel reliability artifact'ları yok |
| `test_real_warning_replay_is_independent_of_future_observations` | Yerel policy/model/gözlem yok |

Yerelde bu dosyalar mevcut olduğundan bu testler gerçekten çalıştırılır. CI `pytest -rs` ile atlama nedenlerini açıkça yazdırır; atlananlar başarılı gerçek ML doğrulaması diye sayılmaz.

## 7. Yayın sonrası kabul — henüz yapılmadı

| Kontrol | Beklenen |
|---|---|
| Landing ve dashboard | HTTPS, konsolda kritik hata yok; tarihlenmiş gerçek veri |
| `/dashboard`, `/login`, `/alerts`, `/forecasts`, `/subscriptions`, `/regions`, `/history`, `/performance`, `/settings` | Adres çubuğundan açma ve F5: HTTP 200, doğru ekran |
| `/live.json`, `/replay.json`, hashed JS ve fontlar | Doğru content-type; HTML fallback değil |
| `/api/health` Vercel üzerinde | 404 olabilir: API ayrı HTTPS host'tadır; SPA HTML'i dönmemeli |
| Harita | Tile sunucusu erişilebilir, zoom/katman/ortalama çalışır |
| Grafik ve tahmin | 24/48/72 saat; kaynak tarihleri doğru, sahte yeni tahmin yok |
| Historical Replay | 7 Haziran 2024, 27.01 °C gözlem ve gerçek rapor |
| OTP | Gerçek e-posta kodu alımı, 6–10 hane doğrulama, refresh sonrası oturum |
| Abonelik/RLS | İki gerçek hesap birbirinin abonelik/gönderim geçmişini göremez |
| E-posta API'si | DevTools Network hedefi gerçek Render HTTPS URL'si, localhost değil |
| Manuel TEST | Onaysız kullanıcı reddedilir; onaylı kullanıcı yalnız kendine; ikinci tıklama tekrar göndermez |
| Teslim | Resend kabulü/teslim sorgusu ve gerçek gelen kutusu/spam ayrıca teyit edilir |
| Preview | Gerçek Supabase/Resend/API isteği ve e-posta yok |
| Otomatik gönderimler | Shadow / false / false korunur |

İlk manuel TEST kabulünü yaparken `TEST_EMAIL_ENABLED=true` yalnız production API'de seçilebilir; bu, otomatik bayrakları değiştirmez. Kabulde yeni gerçek mesaj oluşabileceğinden kullanıcı kendi hesabından bilinçli olarak tıklar. İşlem bittiğinde ihtiyaca göre manuel TEST bayrağı yeniden kapatılabilir.

## Kaynaklar

- [Vercel Vite ve SPA deep link](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel proje yapılandırması](https://vercel.com/docs/project-configuration)
- [Vercel Node.js major seçimi](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Render Docker/Blueprint alanları](https://render.com/docs/blueprint-spec)
- [Render FastAPI dağıtımı](https://render.com/docs/deploy-fastapi)

Bu rehberdeki dış platform özellikleri 17 Ekim 2026'da resmî kaynaklarla kontrol edilmiştir; gerçek hesabın domain/plan/izin durumu henüz test edilmemiştir.
