# Torva Smart Light — Tasks

> Öncelik: 🔴 Kritik · 🟡 Orta · 🟢 Düşük · ✅ Tamamlandı

---

## Aktif Görevler

### Mobil Uygulama

| # | Görev | Öncelik | Notlar |
|---|---|---|---|
| 1 | Gerçek STL dosyalarını assets/models/ klasörüne ekle | 🔴 | Şu an placeholder boş STL'ler var |
| 2 | App ikonlarını PNG'ye çevir ve assets/ klasörüne ekle | 🔴 | torva-app-icon.jpg → icon.png, adaptive-icon.png, splash-icon.png |
| 3 | Bildirim ikonu oluştur | 🟡 | Beyaz+şeffaf, 96x96, notification-icon.png |
| 4 | Font dosyalarını ekle | 🟡 | SpaceMono-Regular.ttf, SpaceGrotesk-Light.ttf |
| 5 | GLView WeakMap hatasını tam çöz | 🟡 | ScanScreen→ControlScreen geçişinde ara sıra çıkıyor |
| 6 | EAS build ile gerçek cihaz testi | 🔴 | Expo Go'da splash/ikon test edilemiyor |
| 7 | AutomationScreen.tsx ve PresetsScreen.tsx'i sil | 🟢 | Artık ControlScreen içinde accordion |
| 8 | Mobil tasarım sayfası (ileride) | 🟢 | Web'deki gibi parça seç + sipariş ver |

### ESP32 Firmware

| # | Görev | Öncelik | Notlar |
|---|---|---|---|
| 1 | ESP32_DualStrip.ino gerçek donanımda test et | 🟡 | Kod hazır, materyal yok |
| 2 | ESP32_Relay.ino yaz | 🟢 | Röle tipi cihazlar için |
| 3 | OTA version.json URL'ini .com adresine güncelle | 🟢 | torva-atelier.vercel.app → torva.com.tr |

### Web Sitesi

| # | Görev | Öncelik | Notlar |
|---|---|---|---|
| 1 | Gerçek STL dosyalarını public/parts/stl/ klasörüne ekle | 🔴 | Vercel deploy ile erişilebilir olacak |
| 2 | .com domain bağlantısı | 🟡 | Vercel hâlâ çalışır olacak |

### 3D Model / Parts Sistemi

| # | Görev | Öncelik | Notlar |
|---|---|---|---|
| 1 | Gerçek STL modelleri tasarla/üret | 🔴 | base01-10, body01-10, head01-10 |
| 2 | STL'leri hem assets/models/ hem public/parts/stl/ ekle | 🔴 | Hybrid cache için |
| 3 | 3D render kurallarını belirle | 🟡 | Parts key → 3D pozisyon/rotasyon kuralları |
| 4 | Işık açıkken glow efektini geliştir | 🟢 | Şu an temel SpotLight + PointLight var |

---

## Gelecek Özellikler (Backlog)

| Özellik | Açıklama |
|---|---|
| Mobil tasarım + sipariş | Web'deki DesignPage'in mobil versiyonu |
| Çoklu kullanıcı / ev | Firebase backend — birden fazla telefon aynı cihazı kontrol etsin |
| 3D interaktif model | Parçalara tıklayınca bilgi göster, renk değiştir |
| Widget (iOS/Android) | Ana ekrandan hızlı aç/kapat |
| Ses aktivasyonu | "Hey Torva, lambayı aç" |
| Grup kontrol | Birden fazla ESP32'yi aynı anda kontrol et |
| Sahne paylaşımı | Kullanıcılar preset paylaşsın |

---

## Tamamlanan Milestone'lar

- ✅ **M1** — ESP32 temel LED kontrolü + WiFi kurulum
- ✅ **M2** — Mobil uygulama temel akışı (onboarding → kurulum → tarama → kontrol)
- ✅ **M3** — PIN güvenliği + brute force koruması
- ✅ **M4** — Otomasyon + bildirimler
- ✅ **M5** — OTA firmware güncelleme
- ✅ **M6** — Sahneler / presets sistemi
- ✅ **M7** — Çoklu kanal desteği (channels)
- ✅ **M8** — Parts sistemi + 3D model viewer
- ✅ **M9** — Hybrid STL cache (bundle + disk + Vercel remote)
- ✅ **M10** — Model kart tasarımı + cihaz slide geçişi

