# ThermaTwin AI — İlerleme

Son güncelleme: **17 Ekim 2026**. Teslim hedefi: **21 Ekim 2026**.

## Vercel production hazırlığı 0.6

- [x] Vercel Vite manifesti, dokuz doğrudan sayfa rewrite'ı; API/eksik statik dosyaya HTML fallback yok. Node 24, build/output sabit.
- [x] Production public ayar/HTTPS kontrolü; açık public değişken izin listesi. Preview canlı Supabase/API değerlerini çıkarır; bilinmeyen/secret public alan build'i durdurur.
- [x] Ayrı Render Free HTTPS API mimarisi; non-root Dockerfile, dar build context, hash ile kilitlenmiş 18 HTTP paketi, manuel deploy Blueprint ve env örnekleri. Mevcut `.env` değiştirilmedi.
- [x] API'den ağır bilimsel import zinciri ayrıldı. Ortak saf event/uyarı kararları pipeline tarafından yeniden dışa aktarılır. Eğitim/indirme/LLM HTTP isteğinde yok; production son veriyi Supabase'den okur, DB hatasında statik fallback yapmaz.
- [x] Hosted kesin HTTPS CORS, izin dışı Origin POST engeli, no-store/sanitized hata yanıtları, production API dokümantasyon uçları kapalı. Preview backend bütün gönderimleri zorunlu kapatır. Otomatik bayraklar shadow/false/false kaldı; manuel TEST auth/onay/idempotency/geçmişi korundu.
- [x] UI/CSS tasarımını değiştirmeden route bazında lazy loading ve landing/login'de gereksiz snapshot isteğinin kaldırılması. Yerel production giriş JS'i yaklaşık 980 KB'den 515 KB'ye (gzip 287 KB'den 153 KB'ye) indi. Bu bir bundle ölçümüdür; gerçek Vercel mobil saha metriği değildir.
- [x] `docs/VERCEL_DEPLOYMENT.md`: hesap adımları, production/preview ayrımı, Supabase URL/SMTP, Render cold start, yayın sonrası 12 kabul alanı ve GitHub'ın gerçek artifact eksikliğinden atladığı 7 test ayrı listelendi.
- [x] Yerelde **83 Python**, **30 frontend birim**, **36 dashboard/routing E2E**, **10 bağlı E2E**, PostgreSQL/RLS, ESLint, TypeScript ve production build geçti. Hafif API ayrı dependency ortamında hem preview hem production modunda, dış ağ kapalı olarak çalıştı. Production/preview bundle izolasyonu doğrulandı.
- [x] Korunan **25 dosya** için SHA-256 kontrolü ve gerçek yerel sunucu anahtarlarına karşı kaynak/bundle taraması eklendi ve çalıştırıldı. Gerçek Supabase salt okunur entegrasyon kontrolü geçti; mesaj gönderilmedi.
- [x] CI'ye production/preview derlemeleri, Node 24 ve Linux Docker image/runtime smoke kontrolleri eklendi. Hazırlık PR'sinin `Verify MVP` sonucu son commit için izlenir. Temiz CI checkout'unda **7 gerçek-artifact testi** ayrı gerekçelerle atlanır; bu dosyalar yerelde mevcut olduğu için yerel 83 testin tamamı çalıştı.
- [ ] Kullanıcı onayıyla merge, hesap bağlantısı ve gerçek Vercel/Render yayını; gerçek HTTPS/OTP/iki hesap RLS/TEST gelen kutusu kabulü.

Mevcut model/data/report/PDF dosyaları ve servis migration'ları korunur. Yeni gerçek e-posta veya monitoring turu gönderilmedi. Render Free uyku/kota sınırları ve 21 Ekim öncesi gerçek snapshot güncellemesi ayrıca planlanmalıdır.

## Arayüz ve TEST teslim görünürlüğü 0.5

- [x] İlk incelemede çalışmayan yerel API başlatıldı. `npm.cmd run dev` için Vite ve API'yi aynı terminalden yöneten `scripts/dev.mjs`; servislerden biri hata verirse diğer çocuk süreç kapanır. Ayrı frontend komutu `dev:frontend`.
- [x] Önceki iki TEST kaydı Resend salt okunur e-posta sorgusuyla incelendi: ikisi de `delivered`. Alıcı posta sunucusunun kabulü doğrulandı; gelen kutusu yerleşimi kullanıcı teyidi bekliyor. Bu çalışmada yeni gerçek mesaj gönderilmedi.
- [x] TEST kartı günlük görünümde de erişilebilir; tarih, doğrulanmış alıcı ve açık onay koşulu gösterilir. Servis kapalı/eksik, bekleme, hata, tekrar engeli ve kalıcı sonuç mesajları; bağlantıyı yeniden deneme ve geçmişi yenileme eklendi. Aynı olayın tekrar gönderimi engellenir.
- [x] Kişisel geçmiş görünüm modundan bağımsız. `/deliveries/{id}/status` yalnız sunucuda doğrulanmış kullanıcı kimliğiyle kendi kaydını bulur, sonra kayıtlı provider kimliğini sorgular. Teslim/gecikme/ret ayrılır; içerik veya sağlayıcı hata gövdesi istemciye taşınmaz. Bu uç e-posta göndermez.
- [x] Anthropic frontend-design, Vercel web-design-guidelines, React best practices, composition patterns ve UI/UX Pro Max kuruldu ve ilgili kuralları uygulandı. Kaynak/karar dökümü `docs/UI_REPAIR_PLAN.md`; mevcut marka ve yerel fontlar korundu.
- [x] Mobil üst çubuk iki satır; temel buton/ikon/sekme hedefleri 44 px. Sarılan metin, eşit yükseklikte eylemler, belirgin disabled/hover/focus/loading durumları; 16 px form girdisi, okunabilir açıklamalar ve onay alanı. Bağlı abonelik kartındaki eksik sınıf, bildirim satırlarının eksik stilleri ve erken uyarı kartının çift boşluğu düzeltildi.
- [x] Mobil menü açıldığında arka plan `inert`, gövde kaydırması durur; Escape ile odak açan düğmeye geri döner.
- [x] **72 Python**, **15 frontend birim**, **28 dashboard E2E**, **10 bağlı E2E** başarılı. Bağlı testler kontrollü sağlayıcılarla teslim sorgusu, iki hesap izolasyonu, mükerrer gönderim engeli, çevrimdışı servis/yeniden deneme ve bildirim kartlarının WCAG A/AA kontrolünü içerir. PostgreSQL/RLS ve public/secret korumaları geçti. Production build başarılı; önceki JS paket boyutu uyarısı sürüyor.
- [x] 320/390/768/1366 px ekranlarda landing/dashboard/login/subscriptions/alerts yatay taşma kontrolü geçti. Açık/koyu dashboard ve menü/rapor kontrolleri mevcut 1920/1366/768/390 px E2E matrisinde doğrulandı. Önce/sonra görselleri `artifacts/ui-before-*` ve `artifacts/ui-after-*` altında.

Gerçek Supabase salt okunur bağlantı kontrolleri yeniden geçti. Otomatik e-postalar shadow ve tahmin e-postaları kapalı; kaynak veriler, modeller ve anahtarlar değiştirilmedi. Gerçek kullanıcının yeni arayüzden teslim sorgusu ve gelen kutusu teyidi otomatik test sonucu olarak sunulmaz.

## Authentication, Subscription & Email 0.4

- [x] Mevcut modeller, gerçek veri, dashboard tasarımı, önceki testler ve PDF'ler korundu; proje yeniden oluşturulmadı.
- [x] `demo` / `production` ayrımı; production bağlantısı eksikse sessiz demo fallback'i yok. Public/anon anahtar dışında istemci sırrı build öncesinde engellenir.
- [x] Supabase OTP isteği/kod doğrulaması, hata/süre/rate-limit metinleri, kalıcı oturum, auth başlangıcı yarış kontrolü, yerel çıkış ve kişisel verinin hesap değişiminde temizlenmesi.
- [x] İkinci additive migration: ayrı `email_enabled`, consent sürümü/zamanı ve audit olayları; eski aktif kayıtlar otomatik izin sayılmaz. Abonelik değişikliği doğrulanmış kullanıcı RPC'sinden; doğrudan istemci DML'i kapalı.
- [x] Akkuyu izleme, açık onay, bildirimleri durdur/aç, iptal/yeniden abonelik; tek kullanıcı/bölge kaydı. RLS ile kişisel abonelik ve gönderim geçmişi.
- [x] Resend API HTML/düz metin ve Supabase OTP şablonu/SMTP config. Kaynak sayılar rapor motorundan gelir; LLM enum yorumlarıyla sınırlı ve şablon fallback'i korunur.
- [x] Varsayılan shadow, otomatik gerçek gönderim için ayrıca onay kapısı, tahmin e-postaları kapalı. Manuel TEST, giriş yapan doğrulanmış ve açık onaylı abonenin kendi adresine gönderilir. Eski/eksik/future/normal veri ve değişmiş alıcı engelleri.
- [x] Shadow/test/live teslim kayıtları ayrı namespace; dondurulmuş gövde, kalıcı idempotency, lease/claim token, 23 saat sonrası quarantine; izin iptalinde retry durdurma.
- [x] Gerçek uçtan uca testin bulduğu rapor JSON cycle hatası düzeltildi: rapor facts'i olayın bağımsız kopyasıdır; monitoring/veritabanı serileştirmesi çalışır.
- [x] Monitoring'de sessiz yeniden eğitim kaldırıldı. Özgün model ve kalibrasyon paketi, SHA-256/sürüm kontrolü, elle/zamanlanmış shadow job ve sanitized hata geçmişi. Paket `artifacts/thermatwin-runtime.zip`, hash `docs/runtime-model-manifest.json`.
- [x] Gerçek frontend SDK + FastAPI ile masaüstü/mobil: geçersiz OTP → doğru OTP → oturum yenileme → onaysız abonelik → açık onay → tarihsel shadow monitoring → rapor → mock TEST kabulü → tekrar engeli → durdur/iptal/yeniden abonelik → çıkış/ikinci hesap izolasyonu.
- [x] Gerçek hesap bağlantısı için sıralı rehber: `docs/LIVE_INTEGRATION.md`; README, `.env.example`, Supabase SMTP/OTP config ve CI güncellendi.
- [x] Gönderimsiz `check_integrations.py`: yerel alanlar/türler/origin/güvenlik; isteğe bağlı yalnız GET ile Auth/şema/Akkuyu/anonim erişim kontrolü. Değerler/hata gövdeleri yazdırılmaz; eksikte uzak kontrol yapılmaz, OTP/RPC/Resend çağrısı yoktur. Başarı gerçek kabul testi diye sunulmaz.
- [x] Sunucu REST adaptörü yeni `sb_secret_` anahtarları için yalnız `apikey`, legacy JWT için mevcut Bearer başlığını kullanır. Bağlı E2E servisi yeni secret başlığını da zorunlu kılar.
- [x] Gerçek e-postanın 8 hane gelmesi üzerine giriş ekranındaki sabit altı hane kısıtı düzeltildi. Ortak input/submit kuralı Supabase'in 6–10 haneli OTP aralığını destekler; kod string kalır, baştaki sıfır korunur. Yerel config 8 hane; README/kurulum rehberindeki altı haneye zorlama kaldırıldı. Kullanıcının gerçek kodu testlere/dosyalara yazılmadı.
- [x] Kullanıcının talebiyle sabit `REPLAY_TEST_EMAIL` kontrolü/ayar gereksinimi kaldırıldı. API alıcı kimliğini doğrulanmış Supabase oturumundan alır; istemcinin `email`/`to`/`user_id` ile alıcı seçmesi 422 ile reddedilir. Mail motoru yalnız bu kimliğin güncel doğrulanmış adresine gider. Ekranda hesabın alıcı adresi gösterilir. İki farklı doğrulanmış/onaylı hesabın yalnız kendine TEST isteyebildiği ve aynı olayın yinelenmediği masaüstü/mobil testlerden geçti; onaysız hesap reddedilir. Otomatik shadow ve tahmin engelleri korundu; gerçek API yeniden başlatıldı.

**Gerçek ortam durumu — 16 Ekim 2026:** Anahtarlar yalnız yerel `.env` dosyasında; production istemcisi yalnız public anahtarı kullanır. Gerçek Supabase bağlantısı/şema/Akkuyu/anonim erişim kontrolleri başarılı. Korunan mevcut veri/modelle 6.864 gözlem, üç ufuk ve 16 Ekim snapshot'ı gerçek veritabanına yazılıp geri okundu; monitoring shadow tamamlandı, tarayıcı gerçek snapshot'ı aldı. Resend verified/sending enabled domain ve SMTP SSL 235 kimlik doğrulaması başarılı. Kullanıcı gerçek OTP ile **giriş ve aboneliği tamamladığını bildirdi**; önceki 6/8 hane istemci uyumsuzluğu düzeltildi. Manuel TEST alıcısı artık oturum sahibinin doğrulanmış kendi adresidir; sabit adres kullanılmaz. Otomatik gerçek gönderimler shadow, tahmin e-postaları kapalı. **İki gerçek kullanıcıyla hosted RLS kabulü ve TEST anomali e-postasının gelen kutusu teslimi bekliyor.** Teslim/bounce webhook'u bu aşamada yoktur.

Önemli sınır: uzun olayın ilk raporu immutable olduğu için bu rapor artık eskiyse yeni aboneye de eski e-posta gönderilmez. Güncel analiz dashboard'da görünür. ML erken uyarı sınırlamaları 0.3'teki haliyle sürer.

Doğrulama: **64 Python testi**, **15 frontend birim testi**, **28 mevcut dashboard E2E**, **8 bağlı hesap E2E** başarılı. OTP düzeltmesinden sonra Python/birim/bağlı E2E/production build tekrar geçti; önceki 28 dashboard regresyonunun sonucu korundu. Masaüstü/mobil yeni senaryolar 8/10 haneli kodun baştaki sıfırla aynen Auth'a ulaşmasını ve eksik kodun gönderilmemesini doğrular; önceki altı hane akışı ve oturum refresh/ret testleri korunur. İki migration üzerinde PostgreSQL/RLS, public/secret build koruması ve ESLint/TypeScript başarılı. Koruma manifesti **7/7** eşleşir. Gerçek provider ağı birim testlerinde kapalıdır; demo/bağlı test build'leri gerçek `.env` hesaplarından ayrıdır. Mevcut NumPy/Pandas/Starlette deprecation uyarıları sürer; bağlı build'in tek JS parçası için boyut uyarısı var, build hatası yok.

## ML Reliability & Early Warning 0.3

- [x] Mevcut modeller/PDF'ler/veri korundu; ortak XGBoost estimator ayarları aynı kaldı. Yeni deneyler ayrı `artifacts/reliability/v1/` klasöründe.
- [x] 2019–2026 sekiz yıllık rolling-origin; genişleyen eğitim, ayrı validation ve kalibrasyon yılları, günlük 24/48/72 saat tahmin başlangıçları. Hedeflerin blok sınırını aşması engellendi.
- [x] Persistence, mevsimsel ortalama, önceki yıl ve mevsimsel değişim baseline'ları. MAE/RMSE, yıl/mevsim, ≥0.5 °C yükseliş ve P95 ekstrem günler ayrıca ölçüldü.
- [x] P90/P95, üç kaynak ve üç marjdan 18 uyarı adayı. Seçim yalnız validation F1'ında, sabit gözlenmiş P90 etiketine karşı. Günlük TP/FP/FN/TN, Precision/Recall/F1 ve olay metrikleri kaydedildi.
- [x] Her ufuk için ayrı residual sıra istatistiği, mevsimsel zarf ve seyrek mevsimde genel aralığa dönüş. Test ve mevsim kapsaması/gözlenen genişlik raporlandı.
- [x] Dört durumlu yerel motor; neden/ufuk/veri tarihi/belirsizlik/olay kimliği. Olay başlangıcı ve gözlemsel teyit; iki normal günle yeniden kurulum, aynı gün ve süren olay tekrarlarının bastırılması. Eski/eksik veri uyarı üretmez.
- [x] Mevcut dashboard tasarımı korunarak aralıklar, ayrı uyarı kuralı, güncellik ve açıklamalı motor durumu bağlandı. Orijinal JSON snapshot'ları koruyan eşleşme kontrolüyle ayrı UI kopyaları kullanıldı.
- [x] Üç özgün replay korundu; bir başarılı ön sinyal ve bir yanlış olay sinyali örneği eklendi. Sonradan öğrenilen olay sonucu, geçmişteki hesaplamaya girmez.
- [x] Ayrıntılı rapor/JSON ve bağımsız grafik: `docs/RELIABILITY_REPORT.md`, `docs/reliability-report.json`, `docs/assets/reliability-summary.png`. MODEL_CARD ve README güncellendi.

Rolling MAE: **0.2484 / 0.3335 / 0.3626 °C**; persistence kazancı **%6.25 / %10.31 / %12.74**. Mevcut modelin ayrı testinde yeni uyarı F1: **0.8435 / 0.7793 / 0.7509**; üçü de persistence'ın altında. Günlük yanlış pozitif: **66 / 92 / 117**. Eski nokta tahminlerinin MAE'si değişmedi.

Yeni aralık test kapsaması **%81.71 / %81.21 / %81.09**; hızlı yükselişlerde yalnız **%6.74 / %36.13 / %39.77**. Birleşik motor 49 kayıt/439 bastırılan tekrar; 18 uzun olaydan 8'i saptandı, sadece 2'si başlamadan yakalandı. 38 kayıt uzun olaya denk gelmedi, bir sınır kaydı sansürlü. **Bağımsız otomatik kullanıcı erken uyarısı için hazır değil.**

Supabase, OTP, Resend ve gerçek e-posta bu aşamada etkinleştirilmedi. Kapsam: yerel geliştirme, ölçüm ve test.

Son doğrulama: **26 Python testi**, **13 frontend birim testi**, dört boyutta **28 production E2E senaryosu**, SQL/RLS kontrolleri, ESLint, TypeScript ve production build başarılı. Son veri doğrulama değişikliklerinden sonra replay/uyarı/güncellik/gezinme için **16 E2E kontrolü tekrar geçti**. Yerel API de dashboard ile aynı kalibrasyonu sunar; eski veri tarihini istekte yeniden hesaplayıp raporları/uyarıyı bastırması test edildi. İki PDF, iki model ve koruma manifestindeki üç veri dosyası **7/7 SHA-256 eşleşti**. Mevcut NumPy/Pandas ve Starlette deprecation uyarıları sürüyor; başarısız test yok.

## UI/UX 0.2 ve model denetimi

Yeni kullanıcı isteği doğrultusunda mevcut uygulama üzerinde geliştirildi; proje yeniden oluşturulmadı. Supabase, gerçek OTP, Resend ve canlı e-posta bu aşamada kapalı tutuldu.

- [x] Inter (Google Fonts, yerel font dosyaları ve OFL), açık/koyu CSS token'ları, kalıcı tema, yeniden düzenlenmiş sidebar ve üst navigasyon.
- [x] Genel bakışta bölge, son erişilebilir sıcaklık, normalden fark, 24/48/72 saat, iki ayrı durum açıklaması ve son kontrol tarihi. Teknik metrikler ayrı performans ekranına taşındı.
- [x] Gerçek gözlem ve model tahminini aynı zaman ekseninde ayıran grafik; gelecek aralığı, ampirik tahmin aralığı, normal ve P90 çizgileri, gözlenen aşım noktaları, tooltip, 14/30/90 gün ve 1 yıl seçimi.
- [x] Gezinmede replay modu ve olay tarihinin URL üzerinden korunması. Üç gerçek geçmiş olay; aynı takvim ayından önceki gerçek normal günle karşılaştırma ve rapor indirme.
- [x] Deniz izleme, AI tahminleri, anomali uyarıları, geçmiş analiz, abonelik provası, ayarlar ve model performansı ekranları.
- [x] Abonelik ekranı yalnız etiketli yerel tercih kaydeder. Mevcut bağlı ekranlar `src/integrations/` altında korunur; varsayılan `VITE_ENABLE_LIVE_INTEGRATIONS=false`.
- [x] Gerçek ham veri hash'i, kaydedilmiş hindcast, dondurulmuş klimatoloji ve dashboard tahminleri tekrar doğrulandı. Katalog son günü 16 Ekim 2026; 6.864 geçerli / 0 eksik gün.
- [x] Inference başlangıcının veride mevcut günlük bir tarih olması zorunlu kılındı. Geçersiz gelecek/zaman içi tarihlerin yanlış etiketlenmesi düzeltildi; geçerli eski tahminler ve model dosyaları değişmedi.
- [x] Model ve persistence sıcak gün F1 karşılaştırması ve en büyük hata örnekleri görünür hale getirildi. **Model MAE'yi azaltırken üç ufukta P90 F1'ında baseline'ı geçmiyor.**
- [x] PDF'ler, modeller ve gözlemler için koruma manifesti; 1920/1366/768/390 px önce/sonra ekranları, koyu tema ekranları.
- [x] Tema, hata/boş/yükleme durumları; native rapor dialog'u, odağın geri dönmesi, mobil menü klavyesi, görünür focus ve kontrast düzeltmeleri.
- [x] README, MODEL_CARD, DESIGN_SYSTEM, UI_COMPARISON ve sonraki entegrasyon TODO belgeleri.

Sayısal metrikler önceki eğitimle aynı: MAE **0.265 / 0.352 / 0.380 °C**; RMSE **0.355 / 0.467 / 0.513 °C**. En büyük test hataları **1.744 / 2.857 / 3.455 °C**. Model dosyaları yeniden eğitilmedi. Ayrıntılar: `docs/model-audit.json`.

Doğrulama: **16 Python**, **11 frontend birim testi**, **24 production Playwright senaryosu** ve PostgreSQL/RLS kontrolleri geçti. TypeScript, ESLint ve production build geçti. Tarayıcı matrisi 1920/1366/768/390 px; her boyutta açık/koyu WCAG A/AA otomatik kontrolü, replay/rapor/klavye odağı, yerel tercih, kaynak tarihleri, hata kurtarma, filtreler, harita kontrolleri ve sayfa taşması.

İlk UI taramalarında ikincil metnin açık zemin kontrastı 4.43:1 çıktı; metin rengi koyulaştırılarak düzeltildi. Skeleton için eksik semantik rol eklendi. Servis trafiği kontrolü, yerel Supabase JS dosyasını dış bağlantı sanıyordu; gerçek hedef hostname'lerini kontrol edecek şekilde düzeltildi. Son testler Vite dev/HMR yerine yeni production build'i 5175 portunda açar.

## Tamamlanan ve yerelde doğrulanan

- [x] Klasördeki iki özgün PDF'nin tüm sayfalarının incelenmesi; dosyalar korundu. Kapsam ve önceki kararlar `docs/REVIEW.md` içinde.
- [x] Python **3.12.15**, React/Vite/TypeScript/Tailwind ortamı; npm ve uv kilit dosyaları.
- [x] Copernicus güncel ürün/dataset/değişken/sürüm kontrolü. Katalogdan açık ARCO Zarr erişimi, NetCDF alt küme, kara maskesi, Kelvin dönüşümü, alan ortalaması, takvim boşlukları ve SHA-256 manifesti.
- [x] Gerçek Akkuyu SST serisi: **1 Ocak 2008–16 Ekim 2026**, **6.864 geçerli gün**, **0 eksik gün**.
- [x] Ayrı NOAA OISST karşılaştırması: 2008–2025; 6.558 geçerli, 17 eksik gün. Birincil veriyle karıştırılmadı.
- [x] +1/+2/+3 gün XGBoost modelleri, ayarlama ve bağımsız kalibrasyon blokları, ayrı kronolojik test dönemi, persistence karşılaştırması, MAE/RMSE/bias/F1/coverage, kaydedilmiş Joblib modelleri ve hindcast CSV/PNG.
- [x] Eğitim döneminde dondurulmuş klimatoloji, P90 eşiği, gözlemsel ≥5 gün MHW koşulu ve ayrı tahmini eşik aşımı analizi.
- [x] Landing, e-posta/OTP ekranı, dashboard, Leaflet deniz bölgesi seçimi, abonelikler, uyarı/rapor ve model metrik ekranları. Mobil görünüm ve gerçek harita katmanı.
- [x] Günlük görünümde tarihli gerçek Copernicus snapshot; eski veriye gecikme uyarısı. Geçmiş tekrarında açık etiketleme.
- [x] **7 Haziran 2024** gerçek Copernicus sıcak olayı replay: veri → analiz → rapor → dashboard. Replay tahmini yalnız olay tarihine kadar veriyi kullanır.
- [x] Rapor görüntüleme ve metin indirme. LLM yokken çalışan şablon rapor.
- [x] SQL migration ve gerçek PostgreSQL/PGlite üzerinde RLS/olay/gönderim testleri: kullanıcı izolasyonu, yetkili RPC, tekilleştirme, lease, donmuş istek gövdesi, 23 saat karantinası ve iptal kontrolü.
- [x] FastAPI sağlık/snapshot/replay uçları; giriş yapan doğrulanmış ve açık onaylı abonenin kendi adresine TEST gönderen sunucu kodu. E-posta servisi testleri yalnız mock sağlayıcıyla.
- [x] GitHub CI ve günde üç kontrol için monitoring workflow dosyaları; kalıcı Supabase outbox ve hata kaydı kodu.
- [x] README, bilimsel kapsam, kurulum, dış servis anahtar listesi ve model kartı.

## Gerçek Copernicus test sonuçları

Eğitim sonu 19 Mart 2020; ayarlama sonu 4 Şubat 2022; kalibrasyon sonu 22 Aralık 2023; test 23 Aralık 2023–16 Ekim 2026.

| Ufuk | MAE °C | RMSE °C | Persistence MAE °C | P90 sıcak gün F1 | Aralık kapsaması |
|---|---:|---:|---:|---:|---:|
| +1 gün | 0.265 | 0.355 | 0.281 | 0.842 | %80.3 |
| +2 gün | 0.352 | 0.467 | 0.391 | 0.761 | %78.2 |
| +3 gün | 0.380 | 0.513 | 0.436 | 0.756 | %77.8 |

Skorlar bölgesel SST içindir. +2/+3 gün %80 aralık kapsaması hedef altında. Sıcak gün F1, PDR'deki yüksek risk/ekolojik doğrulama iddiasını karşılamaz. Sahte model başarısı gösterilmedi.

## Hesaplar bağlanınca doğrulanacak

Kullanıcı bu oturumda hesapları **daha sonra bağlayacağını** belirtti; yeniden anahtar istenmedi.

- [ ] Canlı Supabase projesinde kodun tamamıyla OTP girişi ve iki gerçek kullanıcıyla kabul testi. Şema bağlantısı ve kullanıcı tarafından bildirilen 8 haneli OTP alımı 0.4'te ayrıca kaydedildi.
- [ ] Gerçek hesaba abonelik yazma/iptal ve kişisel bildirim geçmişi.
- [ ] Resend doğrulanmış göndericiyle oturum sahibinin kendi adresine **gerçek** geçmiş TEST e-postası; gelen kutusundan teyit.
- [ ] İsteğe bağlı gerçek Gemini API çağrısı. Sayı üretmeyen enum kısıtı ve hata fallback'i test edildi; sağlayıcıya gerçek çağrı yapılmadı.
- [ ] GitHub deposuna aktarım, repo Secrets/Variables ayarı, workflow_dispatch kabul testi ve `MONITORING_ENABLED=true`.
- [ ] Gerçek frontend/API hosting, HTTPS, SPA yönlendirmesi, CORS ve production OTP URL/SMTP ayarları.
- [ ] Copernicus kullanıcı adı/şifreli Toolbox yolu. Hesapsız açık katalog yolu gerçek veriyle çalıştırıldı.

## MVP dışında kalan araştırma bileşenleri

Akıntı/ERA5 veri füzyonu, hidrodinamik advection–diffusion plume modeli, nedensel counterfactual/sentetik kontrol, tesisin gerçek deşarj etkisi ve biyolojik zarar kalibrasyonu uygulanmadı. Resend teslim/bounce webhook'u yok. Snapshot'lar ve tarama skorları bu özellikler varmış gibi sunulmaz.

## Test kaydı

Son doğrulama (16 Ekim 2026):

- **13 Python testi geçti**; gerçek Copernicus ve NOAA model artefaktları dahil. NetCDF maske/birim, takvim boşlukları, gelecek sızıntısı, MHW sürekliliği, rapor fallback'i, yetkisiz mail engeli, gönderim timeout'u ve timestamp/lease kontrolü.
- **8 Playwright senaryosu geçti**: masaüstü ve mobil Chromium'da landing, gerçek replay, grafikleri değiştirme, rapor indirme, güncel Copernicus snapshot, HTTP 200 dönen gerçek harita katmanı, gecikmiş veri uyarısı, bölge, giriş yapılandırması, rapor filtreleri ve sayfa taşması.
- **PostgreSQL/PGlite migration ve RLS testi geçti**: iki hesap izolasyonu, yetkisiz yazım/RPC engeli, sürekli olay tekilleştirme, yeni olay, lease, değişmeyen gönderim gövdesi, 23 saat sonrası karantina ve abonelik iptali.
- **TypeScript + Vite production build geçti**; çıktı `dist/` altında.
- Migration 40 SQL deyimiyle parse edildi; iki GitHub workflow YAML dosyası parse edildi. GitHub runner üzerinde yürütülmedi.
- API: `/health` başarılı; live `2026-10-16`, replay `2024-06-07`; oturumsuz test maili **401**.

İlk soğuk Vite testindeki timeout, test hazırlık süresi düzenlenerek giderildi. Anahtar isteyen harita katmanı OpenStreetMap ile değiştirildi ve gerçek HTTP yanıtıyla doğrulandı. NumPy/Pandas ve Starlette bağımlılıklarından deprecation uyarıları var; test hatası yok. Bunlar ayrı bağımlılık güncellemesiyle ele alınabilir.
