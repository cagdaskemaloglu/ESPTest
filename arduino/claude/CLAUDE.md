# CLAUDE.md — Torva Smart Light

Bu dosya Claude AI için proje bağlamını özetler.
Yeni bir konuşmada bu dosyayı paylaşarak hızlıca bağlam kur.

---

## Proje Nedir?

Torva, müşteriye özel 3D baskı parçalardan oluşan ESP32 tabanlı akıllı lambader sistemi.
- **Mobil:** React Native (Expo) — LED kontrol, otomasyon, 3D model görüntüleme
- **Firmware:** Arduino C++ (ESP32) — WiFi, LED, OTA, parts sistemi
- **Web:** Next.js — 3D STL viewer, parça seçimi, sipariş formu

Detaylar: `docs/PROJECT_OVERVIEW.md`

---

## Kritik Bilgiler

### Tema
```
bg: #080b10 · cyan: #00d4ff · border: #1e2d3d · text: #c8d8e8
Font: SpaceMono (mono), SpaceGrotesk (sans)
```

### Önemli Kararlar
- **PIN opsiyonel** — boş bırakılabilir, ESP32 tüm isteklere izin verir
- **channels dizisi** — kaç adreslenebilir şerit var → ControlScreen render mantığı
- **parts listesi** — sıralı key listesi → 3D model render için, OTA'dan korumalı
- **partColors/roughness/metalness** — ESP32 Preferences'ta, /whoami'den okunur
- **STL hybrid cache** — bundle → disk → Vercel remote
- **AutomationScreen + PresetsScreen** — artık kullanılmıyor, ControlScreen'de accordion
- **Fabrika sıfırlamasında parts KORUNUR** — sadece WiFi/PIN/Automation silinir
- **torva_setup_done** — AsyncStorage key, kurulum tamamlandığında set edilir

### Dosya Konumları
```
Ana router:        App.tsx
Tema:              theme/colors.ts
Cihaz tipi:        types/Device.ts
API servisi:       services/apiService.ts  (PIN otomatik eklenir, channel parametreli)
STL cache:         services/stlCache.ts   (hybrid: bundle+disk+Vercel)
3D viewer:         components/Model3DViewer.tsx
Ana kontrol:       screens/ControlScreen.tsx
```

### ESP32 Endpoint Pattern
```
GET http://{ip}/{endpoint}?pin={pin}&channel={N}&{diğer_params}
PIN yoksa pin parametresi boş geçilir
channel yoksa kanal 0 varsayılır
403 → PinScreen açılır
```

### OTA URL'leri
```
version.json: https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json
.bin dosyası: https://torva-atelier.vercel.app/firmware/ESP32_Light.ino.bin
STL dosyaları: https://torva-atelier.vercel.app/parts/stl/{key}.stl
```

### Parts Versiyon Sistemi
```cpp
#define DEVICE_PARTS_VERSION 2   // artırınca Preferences güncellenir
#define DEVICE_PARTS_DEFAULT "base01,body02,head01"
#define DEVICE_COLORS_DEFAULT "{\"base01\":\"#1a1a1a\",...}"
```

---

## Mevcut Durum

Detaylar: `docs/CURRENT_STATUS.md`

**Çalışıyor:**
- Tam uygulama akışı (onboarding → kurulum → tarama → kontrol)
- LED kontrol, efektler, sahneler, otomasyon, bildirimler
- PIN güvenliği, OTA güncelleme
- 3D model viewer (STL hybrid cache)
- Çoklu cihaz + slide animasyonu
- Parts + renk sistemi

**Eksik:**
- Gerçek STL dosyaları (placeholder var)
- App ikonları PNG formatında
- EAS build ile tam test

---

## Görevler

Detaylar: `docs/TASKS.md`

**Kritik:**
1. Gerçek STL dosyalarını assets/models/ ve public/parts/stl/ ekle
2. App ikonlarını PNG'ye çevir
3. EAS build ile gerçek cihaz testi

---

## Mimari

Detaylar: `docs/ARCHITECTURE.md`

```
App.tsx (router)
  ├── SplashAnimation
  ├── OnboardingScreen
  ├── StartScreen → SetupScreen → ScanScreen
  └── ControlScreen (device, devices, onDeviceChange)
        ├── Model3DViewer (expo-gl + Three.js)
        │     └── stlCache (bundle|disk|remote)
        ├── ChannelControl × N (parlaklık, renk, sahneler, otomasyon)
        └── PinScreen (modal)
```

---

## Geliştirme Notları

- Yeni özellik eklerken `docs/CURRENT_STATUS.md` ve `docs/TASKS.md` güncelle
- ESP32 kodu değişince `DEVICE_PARTS_VERSION` artırmayı unutma
- `apiService.createAPI(ip, pin, onUnauthorized)` — tüm ESP32 istekleri buradan
- `ChannelControl` bileşeni her kanal için bağımsız state tutar
- `safeChannels` — device.channels null olabilir (eski kayıtlar), her zaman ?? fallback kullan
- STL'ler `assets/models/{key}.stl` formatında, key tam olarak ESP32'deki parts key'i
