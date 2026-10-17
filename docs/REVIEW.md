# Mevcut belgelerden alınan kararlar

İnceleme: 16 Ekim 2026. Kök klasördeki iki PDF'nin tüm sayfaları okundu; orijinaller korundu.

- `Rapor.pdf`: 16 sayfa. İklim duyarlı baseline, SST ve MHW, zamansal hindcast, belirsizlik, nedensel atıf sınırları. İlk çalışma alanı 20–30 km kıyı çevresi.
- `ThermaTwin_AI_PDR_Mehmet_Halit_Ekici.pdf`: tek sayfa. 2008–2025 geçmişi, 24–72 saat tahmin, en az 30 sıcak günde hindcast; MAE ≤0.7 °C ve F1 ≥0.75 birer **hedef**, gerçekleşmiş sonuç değil.
- Son kullanıcı talebi raporlardaki Streamlit/MapLibre önerisinin yerine React/Vite, Leaflet, Recharts ve Supabase kullanıyor. Teslim: **21 Ekim 2026**; araştırma raporundaki 22 Ekim satırı geçersiz.
- MVP bölgesel günlük SST tahmini ve mevsimsel anomali izler. Counterfactual nedensel etki modeli, gerçek plume, akıntı/ERA5 füzyonu ve biyolojik zarar hesabı tamamlanmış özellikler olarak sunulmayacak.
- Uydu L4 analizi anlık sensör değildir. Geçmiş olay tekrarları güncel uyarılardan ayrılır. SST tahmini sıcaklık kaynağına atıf yapmaz.
- Referans klimatoloji test döneminden önce dondurulur. +1/+2/+3 gün hedeflerinde sınır sızıntısı engellenir. Persistence karşılaştırması ve doğrulama kalıntılarından ampirik tahmin aralığı raporlanır.

## Doğrulanan resmî kaynaklar

- [Copernicus MED NRT katalog](https://data.marine.copernicus.eu/product/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004/services): `SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2`, 0.01°, günlük, 2008'den itibaren. Katalog son tarihi gözlem indirilince ayrıca doğrulanır.
- [Copernicus REP katalog](https://data.marine.copernicus.eu/product/SST_MED_SST_L4_REP_OBSERVATIONS_010_021/services): `cmems_SST_MED_SST_L4_REP_OBSERVATIONS_010_021`, 0.05°, 1982'den itibaren. NRT ve REP doğrudan birleştirilmez.
- [Copernicus kullanıcı kılavuzu](https://documentation.marine.copernicus.eu/PUM/CMEMS-SST-PUM-010-021-022-041-042.pdf): `analysed_sst` Kelvin, `mask` deniz/kara, `analysis_error` Kelvin sıcaklık farkı.
- [Toolbox Python subset](https://help.marine.copernicus.eu/en/articles/8283072-copernicus-marine-toolbox-api-subset)
- `copernicusmarine.describe` ile NRT `202311` sürümü, `analysed_sst` Kelvin, `mask` ve katalogda yayımlanan ARCO timeseries URL'si ayrıca doğrulandı. Açık Zarr servisinden gerçek bölgesel NetCDF indirmesi yapıldı; actual time koordinatı 16 Ekim 2026'ya ulaşıyor. Katalog web sayfasının önbellek son tarihi yerine veri koordinatı esas alındı.
- [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless): e-posta şablonunda `{{ .Token }}`; proje OTP uzunluğu 6 olarak ayarlanmalı.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): anahtarlar 24 saat saklanır; kalıcı gönderim kaydı ve belirsiz gönderim karantinası ayrıca gerekir.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output): sayısal rapor uygulamada üretilir; model yalnızca izinli yorum kodları seçer.
