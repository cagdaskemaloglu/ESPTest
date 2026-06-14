# Torva Smart Light — Project Overview

## Vizyon
Torva, müşteriye özel 3D baskı parçalardan oluşan, ESP32 tabanlı akıllı lambader sistemidir.
Müşteri web sitesinden lambaderini customize eder, sipariş üretilir ve kargoya verilir.
Kullanıcı ürünü aldığında Torva mobil uygulaması ile LED kontrolü, otomasyon, sahne yönetimi ve 3D model görüntüleme yapabilir.

---

## Ürün Akışı

```
1. Müşteri → torva-atelier.vercel.app → lambader tasarlar (parça + renk seç)
2. Sipariş üreticiye (Çağdaş) ulaşır
3. Parçalar 3D yazıcıda basılır, montaj yapılır
4. ESP32'ye o ürüne ait parts keyleri ve renk bilgisi flaşlanır
5. Ürün kargoya verilir
6. Kullanıcı Torva uygulamasını indirir
7. ESP32-Setup WiFi ağına bağlanır → kurulum yapar → kendi WiFi'ına bağlar
8. Uygulama cihazı tarar, ekler ve kontrole başlar
9. Uygulama ESP32'den parts/renk bilgisini okur → 3D model render eder
```

---

## Platformlar

| Platform | Teknoloji | Repo |
|---|---|---|
| Mobil Uygulama | React Native (Expo) | torva-atelier (bu repo) |
| Web Sitesi (tasarım) | Next.js | torva-atelier (aynı repo) |
| Firmware | Arduino C++ (ESP32) | torva-atelier (bu repo) |
| Firmware OTA | GitHub Releases | torva-firmware (public) |
| STL Hosting | Vercel | torva-atelier.vercel.app/parts/stl/ |

---

## Temel Özellikler

### Mobil Uygulama
- ESP32 WiFi kurulumu (AP mode)
- Yerel ağ tarama ile cihaz ekleme
- PIN koruması (opsiyonel, 4-6 hane)
- LED kontrol: aç/kapat, parlaklık, renk
- Efektler: rainbow, breathe, wave, fire, meteor, twinkle, strobe, comet, theater, pulse
- Sahneler (presets): statik renk + efekt presetleri
- Otomasyon: günlük zamanlayıcı + geri sayım
- Bildirimler: otomasyon kurallarıyla senkronize
- OTA firmware güncelleme
- 3D model görüntüleme (STL, Three.js/expo-gl)
- Çoklu cihaz yönetimi + slide animasyonu ile geçiş
- Onboarding akışı
- Splash animasyonu

### ESP32 Firmware
- WiFi AP kurulum modu
- PIN koruması + brute force engeli (5 deneme → 30sn kilit)
- 10 LED efekti
- Automation (günlük + countdown, max 10 kural)
- NTP senkronizasyonu
- OTA HTTP güncelleme (GitHub/Vercel'den)
- Parts + renk bilgisi Preferences'ta saklı (OTA'dan korumalı)
- Fiziksel reset butonu (GPIO 0, 3sn basılı)
- Fabrika sıfırlama

### Web Sitesi
- Next.js, Three.js tabanlı 3D STL viewer
- Parça seçimi (taban/gövde/başlık), malzeme/renk seçimi
- Fiyatlandırma
- Sipariş formu (e-posta entegrasyonu)
- IoT toggle (akıllı lambader seçeneği)
- Türkçe/İngilizce dil desteği

---

## Tema / Tasarım Dili

- **Arka plan:** `#080b10` (koyu lacivert-siyah)
- **Vurgu:** `#00d4ff` (cyan)
- **Metin:** `#c8d8e8`
- **Border:** `#1e2d3d`
- **Font:** SpaceMono (monospace), SpaceGrotesk (sans)
- **Stil:** Sci-fi / atölye / endüstriyel, scanline doku, glow efektleri
- Hem web hem mobil aynı temayı kullanır

---

## Satış Stratejisi

- Seri üretim değil — her ürün müşteriye özel
- Farklı gövde/taban/başlık kombinasyonları
- Her ESP32'ye o ürüne özgü parts keyleri flaşlanır
- OTA ile tüm sahada olan cihazlar güncellenebilir
- İleride: mobil uygulama üzerinden de tasarım + sipariş
