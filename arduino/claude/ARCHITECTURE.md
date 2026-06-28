# ARCHITECTURE.md — Ambience Bureau

---

## Genel Mimari

```
+----------------------------------------------------------+
|                  React Native App                        |
|                                                          |
|  App.tsx (router)                                        |
|    +-- LanguageProvider (i18n context)                   |
|    |     +-- ErrorBoundary (render hata yakalama)        |
|    |           +-- AppInner                              |
|    |                 +-- SplashAnimation                 |
|    |                 +-- OnboardingScreen                |
|    |                 +-- StartScreen  (kilit yok)        |
|    |                 +-- SetupScreen                     |
|    |                 +-- ScanScreen                      |
|    |                 +-- DeviceListScreen                |
|    |                 +-- GroupScreen                     |
|    |                 +-- StatsScreen                     |
|    |                 +-- LegalScreen                     |
|    |                 +-- ControlScreen (her zaman mount) |
|    |                       +-- ChannelControl x N        |
|    |                       +-- Model3DViewer             |
|    |                       +-- PinScreen (modal)         |
|    +-- AsyncStorage (yerel, sunucuya gitmez)             |
|                                                          |
+-------------------------+--------------------------------+
                          | HTTP (yerel ag)
                          v
+----------------------------------------------------------+
|                   ESP32 Firmware v1.2.1                  |
|  WebServer (port 80)                                     |
|    +-- LED kontrolu (FastLED / WS2812B)                  |
|    +-- 23 Efekt sistemi                                  |
|    +-- Fade/Uyku modu                                    |
|    +-- Otomasyon (NTP senkronlu)                         |
|    +-- PIN guvenlik + brute force koruması               |
|    +-- OTA guncelleme (GitHub raw)                       |
|    +-- Parts sistemi (Preferences kalıcı)                |
+----------------------------------------------------------+
```

---

## App.tsx Routing

```typescript
type Step =
  | 'loading' | 'onboarding' | 'start' | 'setup'
  | 'scan' | 'control' | 'deviceList' | 'legal'
  | 'groups' | 'stats';
```

ControlScreen her zaman mount'ta kalır. Diğer ekranlar renderOverlay()
içinde if/return zinciriyle absolute overlay olarak render edilir.

goToControl() fonksiyonu: setStep('control') + setSyncKey(k+1)
Her overlay'den dönüşte LED durumu otomatik güncellenir.

---

## Servis Katmanı

### apiService.ts
createAPI(ip, pin, onUnauthorized) ile instance oluşturulur.
PIN otomatik eklenir, 403 → onUnauthorized callback.

### deviceStorage.ts
AsyncStorage key: ambience_devices
removeDevice(id) → otomatik olarak removeDeviceFromGroups(id) çağırır.

### groupStorage.ts
AsyncStorage key: ambience_groups
removeDeviceFromGroups: üyesiz kalan grup otomatik silinir.

### groupController.ts
sendGroupCommand(devices, command) → Promise.allSettled ile paralel HTTP.
Komutlar: on | off | brightness | color.

### usageStorage.ts
recordToggle(deviceId, isOn) → ControlScreen toggle() çağrısında tetiklenir.
30 günden eski ve 500+ event otomatik temizlenir.
getDailyStats(deviceId, days) → DailyStat[] (hoursOn, toggleCount).
i18n: stats.allDevices, stats.hoursSuffix, stats.timesSuffix anahtarları.

### stlCache.ts
Hybrid: bundle (assets/models/) → disk cache → ambiencebureau.com remote
Remote URL: https://www.ambiencebureau.com/parts/stl/{key}.stl

### presetStorage.ts
getEffectMeta(t) — dile göre efekt metadata üretir.
getPresetDisplayName(preset, t) — varsayılan presetleri çevirir.

---

## i18n Mimarisi

```
i18n/
  translations.ts     → TranslationKey union tipi + TR/EN sozluk
  LanguageContext.tsx  → LanguageProvider + useLanguage() + LanguageContext (export)
```

Dil bağımlı statik veri pattern'i:
```typescript
function getEffectMeta(t: (key: TranslationKey) => string) { ... }
function getSlides(t)    { ... }  // OnboardingScreen
function getTypeMeta(t)  { ... }  // ScanScreen
```

ErrorBoundary özel durumu (class component):
```typescript
static contextType = LanguageContext;
// declare context KULLANMA — Babel uyumsuz
const ctx = this.context as { t?: (key: string) => string } | null;
const t = ctx?.t ?? ((key: string) => key);
```

---

## ControlScreen Mimarisi

İki ayrı component:

1. ChannelControl (satır ~152) — tek LED kanalı kontrolü
   - Parlaklık, renk, sahneler, otomasyon, uyku modu
   - useLanguage() kendi içinde çağırır
   - Her kanal bağımsız state tutar

2. ControlScreen (satır ~685) — ana router component
   - 3D model kartı + slide navigasyon
   - Cihaz değişiminde tüm geçici state temizlenir
   - syncKey değişince syncAllChannels() tetiklenir
   - Header: cihaz listesi, + (ekle), stats (📊), groups (🏠)

---

## useConnectionStatus Hook

```typescript
// AppState entegrasyonlu:
// - Arka plana gecince ping durdurulur
// - On plana donunce anında ping + periyod yeniden baslar
const { status, latency } = useConnectionStatus(device.ip);
// status: 'checking' | 'online' | 'offline'
```

---

## ESP32 Firmware

```cpp
setup()
  +-- loadOrInitParts()     // DEVICE_PARTS_VERSION ile versiyonlama
  +-- connectToWiFi() / startAP()
  +-- loadRules()
  +-- server.on(...)

loop()
  +-- server.handleClient()
  +-- runEffects()          // fadeActive ise atla
  +-- runFade()             // uyku modu interpolasyonu
  +-- checkAutomation()     // her 1sn, NTP senkronlu
  +-- checkResetButton()    // GPIO 0 fiziksel reset

// OTACheckResult struct, fade degiskenlerinden ONCE tanimlanmali
```

### Fade / Uyku Modu
```
/led/fade?duration=N&target=0&pin=X
  → fadeActive = true
  → Bitince: ledIsOn = false, currentBrightness = fadeStartBri
  → Sonraki /led/on gorunur parlaklıkta acar
```

### Parts Versiyon Sistemi
```cpp
#define DEVICE_PARTS_VERSION 3  // artırınca Preferences guncellenir
```
