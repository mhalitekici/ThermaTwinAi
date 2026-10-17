# ThermaTwin AI tasarım sistemi

## Ocean Intelligence ürün kimliği — PR A

Koyu okyanus `#071826`, derin yüzey `#102737`, aqua eylem `#12C6C8`, seafoam `#68DDC6`, açık sis `#EEF5F5`. Açık temada metin/link teal'i `#086A77`: açık rozet zeminiyle AA kontrastı için ilk taslaktaki daha açık teal koyulaştırıldı. Amber ve coral yalnız açıklamalı bilimsel durumlar için kullanılır. Normal/uyarı durumları ikon ve açık metinle de belirtilir.

Sora değişken fontu başlıklar ve önemli sayılar; Inter açıklamalar, kontroller ve tablolar içindir. Fontlar yerel sunulur; Sora dosyası ve OFL lisansı Google Fonts `ofl/sora` kaynağındandır. Yeni runtime bağımlılığı yoktur. Ortak ürün token'ları ve bileşen düzenleri `src/product.css` içindedir; mevcut davranış stilleri `src/styles.css` içinde korunur.

Landing; asimetrik başlık, açıkça illüstrasyon olarak etiketlenmiş konturlar ve tarihli gerçek gözlem kartıyla açılır. Sayılar `/reliability-report.json` üzerinden; olumlu/olumsuz geçmiş örnekler `/reliability-replays.json` üzerinden gelir. Veri yoksa sayı uydurulmaz. Model Performansı ana menüde ve landing'de görünürdür. Giriş, tüm uygulama sayfaları, boş/hata durumları ve modal/tema/sekme etkileşimleri aynı token'ları kullanır.

Bilimsel anlam korunur: gözlem ve model tahmini ayrı; eski gözlem güncel gösterilmez. Haritadaki bölgesel ortalamanın işareti sensör olarak adlandırılmaz; zemin haritası başarısız olduğunda gerçek analiz sınırı ve yeniden deneme kalır. OTP, oturum, onay, abonelik ve manuel TEST dispatch kodu değişmez.

Önce/sonra galerisi: `node scripts/product-gallery.mjs` → `artifacts/product-upgrade/review.html`. `scripts/capture-product.mjs` 390/768/1366/1920 ve iki temada 80 kombinasyon, ayrıca mobil menüyü kaydeder. İlk kaynak ekranları detached `a805fb5` worktree'sinden alınmıştır. Galeri bilimsel haritaların yerine illüstrasyon veya uydurma ölçüm koymaz; dış harita tile servisinin erişilebilirliği ekranlar arasında değişebilir.

Kabul matrisi ve aşamalar: [PRODUCT_UPGRADE_PLAN.md](PRODUCT_UPGRADE_PLAN.md). Aşağıdaki bölümler önceki tasarımın tarihsel kaydıdır.

## 17 Ekim 2026 etkileşim güncellemesi

Mevcut renk/font kimliği korunarak ana butonlar, hesap/tema ikonları ve görünüm/sekme kontrolleri en az 44 px yapıldı. Mobilde görünüm seçimi üst çubuğun ikinci satırında; hesap ve navigasyon ilk satırda kalır. Uzun eylem metni sarılır, yan yana butonlar aynı yüksekliğe uzar. Ana açıklamalar 13 px, sıkışık tahmin tarihleri/etiketleri 11 px kullanır. Form girdileri 16 px; e-posta ve uzun hesap metinleri sarılır. Butonların disabled/hover/focus/loading halleri ayrıdır.

Bağlı abonelik kartı ortak `.subscription-visual` bileşen stilini kullanır. Onay alanı bütün etiketiyle tıklanabilir. Bildirim alanı bağlantı, TEST isteği, alıcı, kalıcı sonuç ve kişisel geçmişi ayrı okunabilir bloklarla gösterir. Görünüm modu değişse de kişisel kayıtlar görünür kalır. Teslim sorgulaması ve rapor açma ayrı eylemlerdir; iç içe buton yoktur. Erken uyarı kartındaki çift iç boşluk kaldırıldı.

Mobil menü açıldığında arka plan `inert` olur ve gövde kaydırması durur. Escape ile kapandığında odak menü düğmesine döner. Hareket azaltma tercihi korunur. Tasarım becerileri ve seçimler [UI_REPAIR_PLAN.md](UI_REPAIR_PLAN.md) içinde belgelenmiştir. Aşağıdaki 0.2 ölçüleri önceki sürümün kaydıdır; güncel etkileşim ölçüleri bu bölümdeki gibidir.

Sürüm: UI 0.2 · 16 Ekim 2026. Mevcut uygulama üzerinde uygulanmıştır. Varsayılan açık tema, lacivert navigasyon ve mavi etkileşimlerle veri yoğunluğunu dengeler. Koyu tema aynı bileşen ve anlamları kullanır.

## Görsel dil

| Rol | Açık tema | Koyu tema |
|---|---|---|
| Ana zemin | `#f5f7fa` | `#0c1524` |
| Kart yüzeyi | `#ffffff` | `#121f32` |
| Ana metin | `#17263d` | `#e7eef9` |
| İkincil metin | `#5e6d81` | `#a3b2c6` |
| Ocean Blue / etkileşim | `#2563d9` | `#7aa6ff` |
| Turkuaz / gözlem | `#008f99` | `#4bc7cb` |
| Normal | `#127354` | `#68d9b0` |
| Dikkat | `#915600` | `#efc074` |
| Yüksek inceleme önceliği | `#b43b42` | `#fda2a8` |

Token'lar `src/styles.css` içinde CSS değişkenleridir. Risk rengi yalnız sınıflandırmayı temsil eder; pozitif ama eşiğin altındaki sıcaklık farkı otomatik olarak amber/kırmızıya çevrilmez. Durumlar metin ve ikonla birlikte gösterilir. “Normal”, P90 eşiğinin aşılmadığı anlamındadır; biyolojik güvenlik onayı değildir.

## Tipografi ve ölçüler

- [Google Fonts Inter](https://fonts.google.com/specimen/Inter), 400/500/600/700/800 ağırlıkları. Fontlar yerel sunulur; Türkçe karakterleri içerir. Lisans: `public/fonts/OFL.txt`. İlk ziyaret için Google hesabı veya harici font isteği gerekmez.
- Tabular numbers bütün uygulamada etkin. Kart değerleri 33–76 px; sayfa başlıkları 26–30 px; kart başlıkları 15–20 px. Açıklamalar 11–14 px. Küçük 9–10 px yazılar ikincil tarih, kaynak ve etiketlerde kullanılır; ana değerler bu boyutlarda gösterilmez.
- Kartlar 14 px; butonlar 8 px; rozetler 5–6 px köşe yarıçapı. Ana aralıklar 8/12/16/20/24/32 px. Gölge hafiftir; kart sınırı esas ayrımı sağlar.
- Ana butonlar en az 42 px. Sık kullanılan ikon kontrolleri yaklaşık 40 px; dar ekranlarda bazı üst çubuk kontrolleri 34–36 px. Açık etiket, görünür focus ve klavye erişimi korunur.

## Bilgi mimarisi

1. **Genel bakış:** seçilen deniz alanı, tarihli son gözlem, mevsimsel normal, 24/48/72 saat ve iki ayrı durum açıklaması. Model istatistiği bu sayfayı doldurmaz.
2. **Deniz izleme:** tek desteklenen bölge, seçili sınır, katman değiştirme, zoom ve yeniden ortalama. Yeni bölge varmış gibi davranılmaz.
3. **AI tahminleri:** ufuklar, ampirik aralıklar, tahmini eşik açıklamaları.
4. **Anomali uyarıları:** gözlenen/tahmin edilen filtreleri ve indirilebilir gerçek analiz raporları.
5. **Geçmiş analiz:** üç gerçek olay, açık replay etiketi, olaydan önceki aynı ayda gözlenen normal gün ve açıklamalı karşılaştırma.
6. **Abonelikler:** açıkça etiketli yerel tercih provası. Kaydetmek e-posta veya gerçek abonelik başlatmaz.
7. **Ayarlar:** kalıcı açık/koyu tema, veri kaynağı ve ayrı model performansı bağlantısı.

## Grafik dili

Turkuaz kesintisiz çizgi gözlenen SST; mavi kesikli çizgi model tahmini. Model çizgisi son gözlemde birleşir. Gelecek tarihlerde gerçek ölçüm çizilmez. Gelecek alanı hafifçe ayrılır; ampirik alt/üst aralık gösterilir. Sıcak gün eşiği noktalı amber, normal sıcaklık gri; gözlenen aşım noktaları amberdir. Eksik gözlemler enterpolasyonla doldurulmaz. Eğriler `linear` çizilir; görsel yumuşatmayla ölçümler arasında sahte uç değer üretilmez.

Hover ve klavye ile erişilebilen grafik tooltip'i tarih, gözlem/tahmin türü, °C, normal ve eşik değerlerini gösterir. Aralık kontrolü 14/30/90 gün ve 1 yıldır. Anomali sekmesi normalden farkı gösterir. Eksenler tarih ve °C olarak açıklanır. Hiçbir kişisel güven yüzdesi uydurulmaz.

## Etkileşim ve durumlar

- Tema `thermatwin-theme` anahtarıyla saklanır. İlk boyamada uygulanır; açık tema varsayılandır.
- Replay modu ve olay tarihi URL'de taşınır. Gezinme ve sayfayı yenileme aynı olayı korur. “Son gözleme dön” açık bir mod geçişidir.
- Skeleton yükleme, boş veri, geçersiz tarih/veri, yeniden deneme ve eski gözlem durumları ayrı sunulur. Üç tam günden eski günlük veri uyarılır.
- Rapor native `dialog` kullanır: odağı içinde tutar, Escape ile kapanır, kapandığında odağı açan kontrole döndürür.
- Mobil menü klavye odağını içeride tutar; Escape ile kapanır. Skip link ve anlamlı landmark'lar vardır.
- Yerel toast, saklama başarısızlığı dahil gerçek aksiyon sonucunu bildirir. Kullanılmayan buton eklenmez.
- Harita katmanı yüklenemezse açıklama gösterilir; bölge çerçevesi ve veri özeti kalır. Harita bilimsel bir plume veya risk rasterı gibi sunulmaz.

## Ekran boyutları ve doğrulama

1920, 1366, 768 ve 390 px hedeflenir. 850 px altında sidebar çekmece olur. 650 px altında kartlar sıraya girer; karşılaştırma kartları iki sütunda, uzun açıklama tam genişlikte kalır. Büyük performans tablosu kendi kapsayıcısında kaydırılabilir; sayfanın tamamı yatay taşmaz.

Önce/sonra: [UI_COMPARISON.md](UI_COMPARISON.md). Playwright senaryoları tema, mod, rapor, gezinme ve taşmayı; axe-core kontrolleri açık/koyu genel bakıştaki WCAG A/AA kurallarını sınar. Otomatik kontrol tam erişilebilirlik sertifikası değildir.
