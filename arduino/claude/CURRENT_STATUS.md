cat > /mnt/user-data/outputs/docs/CURRENT_STATUS.md << 'EOF'
# Torva Smart Light — Current Status

> Son güncelleme: Haziran 2026

---

## Tamamlanan Özellikler

### Mobil Uygulama

| Özellik | Durum | Notlar |
|---|---|---|
| Onboarding (4 slayt) | ✅ | Cihaz yoksa gösterilir |
| Splash animasyonu | ✅ | RN Animated, SVG'siz |
| App ikon + splash config | ✅ | app.json hazır, assets manuel eklenmeli |
| StartScreen | ✅ | Kurulum yapılmadan "Cihaz Ara" kilitli |
| SetupScreen | ✅ | ESP32-Setup AP, WiFi dropdown otomatik, PIN opsiyonel |
| ScanScreen | ✅ | Paralel IP tarama, PIN rozeti, WiFi uyarısı |
| ControlScreen | ✅ | Tek/çok kanallı dinamik render |
| 3D Model Viewer | ✅ | expo-gl + Three.js, STL hybrid cache |
| Model kart tasarımı | ✅ | 3D model + kanal power butonları |
| Cihaz slide geçişi | ✅ | Sol/sağ ok, slide animasyonu |
| Renk picker | ✅ | HSB, accordion |
| Parlaklık slider | ✅ | Debounced, AsyncStorage sync |
| Sahneler (presets) | ✅ | 16 varsayılan, statik + efekt |
| Efekt kontrol | ✅ | 10 efekt, hız + renk paneli |
| Otomasyon | ✅ | Günlük + geri sayım, Modal klavye fix |
| Bildirimler | ✅ | Otomasyon ile senkronize, sıfırlamada temizlenir |
| PIN güvenliği | ✅ | Opsiyonel, 4-6 hane, 403→PinScreen |
| OTA güncelleme | ✅ | Vercel remote, redirect fix |
| DeviceListScreen | ✅ | Rename, sil, sıfırla, OTA |
| Çoklu cihaz | ✅ | DeviceList + ControlScreen slide |
| parts sync | ✅ | Bağlantıda /whoami → AsyncStorage günceller |
| STL cache | ✅ | Bundle + disk + remote hybrid |

### ESP32 Firmware

| Özellik | Durum | Notlar |
|---|---|---|
| WiFi AP kurulum | ✅ | ESP32-Setup |
| WiFi scan endpoint | ✅ | /wifi/scan |
| LED kontrol | ✅ | on/off/brightness/color/state |
| 10 LED efekti | ✅ | rainbow, breathe, wave, fire, meteor, twinkle, strobe, comet, theater, pulse |
| PIN koruması | ✅ | Brute force (5 deneme → 30sn kilit) |
| Automation | ✅ | Günlük + countdown, NTP, max 10 kural |
| OTA HTTP | ✅ | Vercel .bin, redirect fix, setFollowRedirects |
| Parts sistemi | ✅ | Preferences, versiyon kontrolü, OTA korumalı |
| partColors/roughness/metalness | ✅ | /whoami'de döndürülür |
| Fabrika sıfırlama | ✅ | GPIO 0 fiziksel buton + /factory-reset |
| channels | ✅ | Tek kanallı (ESP32_Light.ino) |
| Çift kanal | ✅ | ESP32_DualStrip.ino (test edilmedi, materyal yok) |

### Web Sitesi (designpage)

| Özellik | Durum | Notlar |
|---|---|---|
| 3D STL viewer | ✅ | Three.js, OrbitControls |
| Parça seçimi | ✅ | taban/gövde/başlık slot sistemi |
| Malzeme/renk seçimi | ✅ | Flip card UI |
| Fiyatlandırma | ✅ | Parça + malzeme + IoT |
| Sipariş formu | ✅ | E-posta entegrasyonu |
| IoT toggle | ✅ | +800₺ seçenek |
| Dil desteği | ✅ | TR/EN |
| Preload sistemi | ✅ | STL'ler önceden yüklenir |

---

## Bilinen Sorunlar / Eksikler

| Sorun | Önem | Çözüm |
|---|---|---|
| GLView WeakMap hatası | Orta | ScanScreen→ControlScreen geçişinde, animatingRef guard eklendi |
| Çift kanallı ESP32 test edilmedi | Düşük | Materyal mevcut değil |
| AutomationScreen.tsx kullanılmıyor | Düşük | Silinebilir veya bırakılabilir |
| PresetsScreen.tsx kullanılmıyor | Düşük | Silinebilir veya bırakılabilir |
| Placeholder STL dosyaları | Orta | assets/models/ içinde gerçek STL'ler ile değiştirilmeli |

---

## Eksik Assets

```
assets/
  icon.png             → torva-app-icon.jpg'den PNG'ye çevir (1024x1024)
  splash-icon.png      → aynı görsel
  adaptive-icon.png    → Android için
  notification-icon.png → Beyaz+şeffaf, 96x96
  fonts/
    SpaceMono-Regular.ttf
    SpaceGrotesk-Light.ttf
  models/
    *.stl              → Gerçek STL dosyaları (şu an placeholder)
```

---

## Test Edilmiş Ortam

- iOS (gerçek cihaz) — birincil test platformu
- Expo Go + Development Build
- ESP32 tek kanallı WS2812B
- OTA: Vercel remote
