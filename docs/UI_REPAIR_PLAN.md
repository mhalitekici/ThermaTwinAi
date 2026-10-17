# ThermaTwin arayüz ve e-posta düzeltmesi — 17 Ekim 2026

Amaç: günlük deniz gözlemini okumak, hesap tercihlerini yönetmek ve manuel TEST sonucunu anlayabilmek.

Görsel yön: deniz gözlem istasyonu. Lacivert navigasyon (#101d32), beyaz yüzey (#ffffff), serin zemin (#f5f7fa), mavi eylem (#2563d9), turkuaz gözlem (#008f99), koyu metin (#17263d). Mevcut yerel Inter ailesi ve sayısal değerlerin hizası korunur. Renk, durum metni ve ikon birlikte kullanılır.

Yerleşim: masaüstünde solda gezinme, üstte görünüm ve hesap, içerikte önce gözlem ve tahmin. Mobilde gezinme/hesap ilk satırda; görünüm seçimi ayrı ikinci satırda. Butonlar ve açıklamalar dar ekranda küçültülmek yerine sarılır. Teknik erken uyarı ayrıntıları gözlem kartlarından ayrı bölümde kalır.

```
Masaüstü: [Menü] [Sayfa / görünüm / hesap]
                [Gözlem] [24 / 48 / 72 saat]
                [Durum ve grafik]
Mobil:    [Menü / sayfa] [Tema / hesap / bildirim]
          [Son gözlem | Geçmiş tekrar]
          [Gözlem]
          [24 / 48 / 72 saat]
```

İlk öneriyle değerlendirme: UI/UX Pro Max'in genel cam yüzey/yeşil vurgu önerisi bu bilimsel gözlem ekranına uygun bulunmadı; mevcut deniz renkleri ve opak, okunabilir yüzeyler seçildi. Dekoratif hareket eklenmez. Ana/ikincil eylem ayrımı, 44 px hedefler, görünür odak, sabit buton isimleri ve kalıcı sonuç açıklamaları kullanılır.

Uygulanan beceri kaynakları:

- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines)
- [Vercel React best practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)
- [Vercel composition patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns)
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)

Beceriler C:/Users/halit/.codex/skills altında kuruldu. Siteye çalışma zamanı bağımlılığı olarak eklenmez; kuralları kaynak koda uygulanır.

Tanı: önceki iki TEST kaydı sağlayıcıda `delivered`; bu durum alıcı posta sunucusunun kabulünü gösterir, gelen kutusu yerleşimini göstermez. İnceleme başlangıcında 8000 portunda API çalışmıyordu. Aynı olaya tekrar tıklama mevcut tekilleştirme nedeniyle yeni mesaj üretmez. Otomatik e-postalar shadow kalır; gönderim yalnız doğrulanmış oturum ve açık onayla yapılır.
