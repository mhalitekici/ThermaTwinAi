# Canlı entegrasyon kabul listesi

Kod, yerel mock servisleri ve PostgreSQL/RLS testleri hazırdır. Sıralı yapılandırma: [LIVE_INTEGRATION.md](LIVE_INTEGRATION.md).

- [x] Gerçek Supabase bağlantısı, beklenen iki migration'ın tablo/kolon ve RPC metadata erişimi. Tam hosted yetki/RLS kabulü aşağıda ayrı bekler.
- [x] Resend API domain okuması: verified/sending enabled domain; gönderici yerelde ayarlandı. SMTP SSL kimlik doğrulaması 235 ile başarılı, mesaj gönderilmedi.
- [ ] Supabase hosted Custom SMTP ayarları; yerel config hosted ayarları uygulamaz.
- [ ] Magic Link/Confirm Signup OTP şablonları ve süre ayarının hosted kontrolü; 8 haneli kod korunabilir, istemci 6–10 haneyi destekler.
- [x] Anahtarlar yalnız yerel `.env` dosyasına eklendi; production public/server ayrımı doğrulandı. Hosting/GitHub secret kurulumu ayrı bekler.
- [x] `scripts/check_integrations.py --remote` ile gönderimsiz yapılandırma/şema/anonim erişim kontrolü geçti; başarılı olsa da aşağıdaki gerçek kabul adımları gerekir.
- [x] Mevcut korunan Copernicus/model dosyalarıyla gerçek Supabase shadow monitoring; 6.864 gözlem/üç tahmin ufku/snapshot yazma ve geri okuma. Production tarayıcı snapshot'ı aldı. E-posta gönderilmedi.
- [ ] Gerçek OTP alımı, oturum yenileme ve çıkış; iki hesapla RLS kabulü.
- [x] Kullanıcı 8 haneli gerçek OTP e-postası aldığını bildirdi; eski altı hane istemci sınırı kaldırıldı. Bu bildirim tek başına oturum doğrulaması değildir.
- [ ] Açık onaylı Akkuyu aboneliği; izin durdurma/iptal/yeniden abonelik.
- [ ] Giriş yapan doğrulanmış, açık onaylı abonenin kendi adresine manuel TEST ve gelen kutusundan teslim doğrulaması. Sabit alıcı kullanılmaz.
- [ ] Aynı TEST olayı ikinci kez gönderilmiyor; yanlış/başka hesaba gönderim reddediliyor.
- [ ] Güvenilir model paketinin repository release asset'ine yüklenmesi ve GitHub variable/secrets.
- [ ] GitHub `workflow_dispatch` ve ardından zamanlanmış **shadow** kabul testi.
- [ ] Gelecekte ayrı kullanıcı onayıyla otomatik gözlem bilgisi gönderiminin değerlendirilmesi. Şu an kapalı.
- [ ] Teslim/bounce webhook'u ve kalıcı sağlayıcı olay mutabakatı (bu aşamada yapılmadı).

Öngörülen anomali e-postaları varsayılan kapalı kalır. Gerçek hesap/SMTP/teslim testleri tamamlanmadan canlı uçtan uca başarı iddia edilmez.
