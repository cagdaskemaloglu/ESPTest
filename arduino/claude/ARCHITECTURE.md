cat > /mnt/user-data/outputs/docs/ARCHITECTURE.md << 'EOF'
# Torva Smart Light — Architecture

## Klasör Yapısı

```
torva-atelier/
├── App.tsx                          # Root component, router, global state
├── app.json                         # Expo config (bundle ID, permissions, plugins)
├── assets/
│   ├── fonts/
│   │   ├── SpaceMono-Regular.ttf
│   │   └── SpaceGrotesk-Light.ttf
│   ├── models/                      # STL dosyaları (bundle içi, base01-10, body01-10, head01-10)
│   │   ├── base01.stl ... base10.stl
│   │   ├── body01.stl ... body10.stl
│   │   └── head01.stl ... head10.stl
│   ├── icon.png                     # 1024x1024
│   ├── splash-icon.png
│   ├── adaptive-icon.png            # Android
│   └── notification-icon.png       # Android, beyaz+şeffaf, 96x96
├── components/
│   ├── ColorPicker.tsx              # HSB renk seçici
│   ├── Model3DViewer.tsx            # Three.js STL 3D viewer (expo-gl)
│   ├── PinScreen.tsx                # PIN giriş modal
│   └── SplashAnimation.tsx         # Animasyonlu splash (RN Animated)
├── docs/                            # AI Documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATUS.md
│   └── TASKS.md
├── hooks/
│   └── useConnectionStatus.ts      # 5sn ping, online/offline/checking, latency
├── screens/
│   ├── AutomationScreen.tsx        # (Artık kullanılmıyor — ControlScreen'e taşındı)
│   ├── ControlScreen.tsx           # Ana kontrol ekranı
│   ├── DeviceListScreen.tsx        # Kayıtlı cihazlar, OTA, rename, delete
│   ├── OnboardingScreen.tsx        # 4 slayt, ilk açılış
│   ├── PresetsScreen.tsx           # (Artık kullanılmıyor — ControlScreen'e taşındı)
│   ├── ScanScreen.tsx              # Ağ tarama, cihaz ekleme
│   ├── SetupScreen.tsx             # ESP32 WiFi + PIN kurulum
│   └── StartScreen.tsx             # Başlangıç ekranı
├── services/
│   ├── apiService.ts               # Merkezi ESP32 HTTP istek servisi (PIN otomatik eklenir)
│   ├── automationService.ts        # ESP32 automation endpoint'leri + bildirim entegrasyonu
│   ├── deviceStorage.ts            # AsyncStorage CRUD (cihaz listesi)
│   ├── networkScanner.ts           # Yerel ağ IP tarama
│   ├── notificationService.ts      # Expo Notifications (scheduled)
│   ├── presetStorage.ts            # 16 varsayılan preset + CRUD
│   └── stlCache.ts                 # Hybrid STL geometry cache (bundle + disk + remote)
├── theme/
│   └── colors.ts                   # Renkler, fontlar, spacing, radius sabitleri
├── types/
│   └── Device.ts                   # Device, Channel, PartMaterial tipleri
└── ESP32/
    ├── ESP32_Light.ino             # Tek kanallı WS2812B firmware (ana)
    └── ESP32_DualStrip.ino        # Çift kanallı WS2812B firmware
```

---

## Uygulama Akışı (App.tsx)

```
loading → splash → onboarding → start → setup → scan → control → deviceList
                                          ↑                         ↓
                                          └─────────────────────────┘
```

| Step | Koşul |
|---|---|
| loading | appReady = false |
| splash | splashDone = false |
| onboarding | Kayıtlı cihaz yok |
| start | Kurulum yapılmamış |
| setup | ESP32-Setup AP'ye bağlanıp WiFi kurulumu |
| scan | Ağ tarama, cihaz ekleme |
| control | Ana kontrol ekranı |
| deviceList | Cihaz listesi, OTA, rename, delete |

---

## Device Tipi

```typescript
type Device = {
  id:            string;
  name:          string;
  ip:            string;
  addedAt:       number;
  brightness:    number;
  color:         { r: number; g: number; b: number };
  type:          'ws2812b' | 'single_led' | 'relay' | 'unknown';
  capabilities:  DeviceCapability[];
  leds?:         number;
  pin:           string;           // Boş = PIN yok
  channels:      Channel[];        // Her adreslenebilir şerit
  parts:         string[];         // 3D model parça key listesi (sıralı)
  partMaterials: Record<string, PartMaterial>;  // Her parça renk/materyal
};

type Channel = {
  id:           number;
  name:         string;
  capabilities: DeviceCapability[];
  leds?:        number;
};

type PartMaterial = {
  color:     string;   // hex
  roughness: number;   // 0.0-1.0
  metalness: number;   // 0.0-1.0
};
```

---

## ESP32 API Endpoint'leri

| Endpoint | PIN | Açıklama |
|---|---|---|
| GET /whoami | ✗ | Cihaz bilgisi (type, channels, parts, partColors...) |
| GET /setup | ✗ | WiFi + PIN kaydet, restart |
| GET /wifi/scan | ✗ | Çevredeki WiFi ağları |
| GET /led/on | ✓ | LED aç (?channel=N) |
| GET /led/off | ✓ | LED kapat (?channel=N) |
| GET /led/brightness | ✓ | Parlaklık (?value=0-255&channel=N) |
| GET /led/color | ✓ | Renk (?r=&g=&b=&channel=N) |
| GET /led/state | ✓ | Durum (?channel=N) |
| GET /effect | ✓ | Efekt (?type=&speed=&r=&g=&b=&channel=N) |
| GET /pin/set | ✓ | PIN güncelle (?new_pin=) |
| GET /factory-reset | ✓ | Fabrika sıfırlama |
| GET /ota/check | ✓ | Güncelleme kontrolü |
| GET /ota/update | ✓ | OTA güncelleme başlat |
| GET /automation/list | ✓ | Kural listesi (?channel=N) |
| GET /automation/add | ✓ | Kural ekle |
| GET /automation/delete | ✓ | Kural sil (?id=) |
| GET /automation/toggle | ✓ | Kural toggle (?id=) |
| GET /automation/time | ✓ | ESP32 saati |

---

## /whoami Yanıt Formatı

```json
{
  "device": "esp32-light",
  "type": "ws2812b",
  "channels": [
    {
      "id": 0,
      "name": "Şerit",
      "capabilities": ["on_off", "brightness", "color", "effects"],
      "leds": 30
    }
  ],
  "parts": ["base01", "body02", "head01"],
  "partColors": {
    "base01": "#1a1a1a",
    "body02": "#c8b89a",
    "head01": "#2a2a2a"
  },
  "partRoughness": { "base01": 0.8, "body02": 0.6, "head01": 0.9 },
  "partMetalness": { "base01": 0.1, "body02": 0.2, "head01": 0.05 },
  "capabilities": ["on_off", "brightness", "color", "effects"],
  "leds": 30,
  "pin_required": false,
  "firmware": "1.0.0"
}
```

---

## OTA Sistemi

```
ESP32 → GET version.json (raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json)
      → Sürüm karşılaştır
      → Güncelleme varsa .bin indir (torva-atelier.vercel.app/firmware/ESP32_Light.ino.bin)
      → Flash'a yaz → restart
```

**version.json:**
```json
{
  "version": "1.1.4",
  "url": "https://torva-atelier.vercel.app/firmware/ESP32_Light.ino.bin",
  "notes": "Açıklama"
}
```

---

## STL Cache Sistemi (Hybrid)

```
getGeometry("base01")
  1. Memory cache → anında
  2. Bundle içi   → assets/models/base01.stl
  3. Disk cache   → FileSystem.documentDirectory/models/base01.stl
  4. Remote       → torva-atelier.vercel.app/parts/stl/base01.stl → diske kaydet
```

**Bundle içi partlar:** base01-10, body01-10, head01-10 (30 dosya)
**Yeni partlar:** Vercel'e koy → otomatik indirilir

---

## Parts Sistemi

```
ESP32 Preferences'ta saklanır:
  parts:      "base01,body02,head01"     (virgülle ayrılmış, sıralı)
  colors:     {"base01":"#1a1a1a",...}   (JSON string)
  roughness:  {"base01":0.8,...}
  metalness:  {"base01":0.1,...}
  parts_ver:  2                          (versiyon numarası)

DEVICE_PARTS_VERSION artırılınca → Preferences güncellenir
OTA güncellemesinde → parts_ver aynıysa Preferences korunur
Fabrika sıfırlamasında → WiFi/PIN/Automation silinir, parts KORUNUR
```

---

## Bağımlılıklar

```json
{
  "expo": "~51.x",
  "react-native": "0.74.x",
  "@react-native-async-storage/async-storage": "^1.x",
  "@react-native-community/slider": "^4.x",
  "expo-notifications": "~0.28.x",
  "expo-splash-screen": "~0.27.x",
  "expo-network": "~6.x",
  "expo-gl": "~14.x",
  "expo-asset": "~10.x",
  "expo-file-system": "~17.x",
  "three": "^0.x",
  "expo-three": "^7.x"
}
