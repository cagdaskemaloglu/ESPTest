# PROJECT_OVERVIEW.md — Ambience Bureau

---

## Ürün Nedir?

Ambience Bureau, müşteriye özel 3D baskı parçalardan oluşan ESP32 tabanlı akıllı lambader sistemi.
Her cihaz benzersiz bir 3D modele sahiptir; uygulama bu modeli gerçek zamanlı gösterir.

Website: ambiencebureau.com

---

## Tech Stack

### Mobil Uygulama
| Teknoloji | Versiyon | Kullanım |
|-----------|----------|---------|
| React Native | 0.76.x | Ana framework |
| Expo SDK | 54 | Build + native moduller |
| TypeScript | 5.x | Tip guvenligi |
| expo-gl + Three.js | r128 | 3D STL viewer |
| expo-localization | ~17.0.8 | Telefon dili algilama |
| expo-notifications | ~0.29.x | Yerel bildirimler |
| AsyncStorage | ~2.1.x | Yerel depolama |
| @react-native-community/slider | ~4.5.x | Parlaklik slider |

### Firmware
| Teknoloji | Kullanim |
|-----------|---------|
| Arduino C++ (ESP32) | Ana firmware |
| FastLED | WS2812B LED kontrolu |
| WebServer | HTTP endpoint'leri |
| ArduinoJson | JSON parse |
| HTTPClient + HTTPUpdate | OTA guncelleme |
| Preferences | Kalici depolama (parts, PIN) |

### Web (Next.js)
- 3D STL viewer
- Parca secimi + siparis formu
- Firmware + STL dosya hosting (ambiencebureau.com)

---

## Depo Yapısı

```
ESPTest/  (GitHub repo adi degismedi)
+-- App.tsx                    → Ana router
+-- app.json                   → Expo konfigurasyonu (Ambience Bureau)
+-- eas.json                   → EAS Build konfigurasyonu
+-- package.json               → ambience-bureau
|
+-- i18n/
|   +-- translations.ts        → TR + EN sozluk, TranslationKey tipi
|   +-- LanguageContext.tsx    → Provider + useLanguage hook
|
+-- screens/
|   +-- ControlScreen.tsx      → Ana kontrol (ChannelControl icerir)
|   +-- DeviceListScreen.tsx   → Cihaz listesi + OTA + dil/yasal
|   +-- SetupScreen.tsx        → WiFi kurulum
|   +-- ScanScreen.tsx         → Ag taramasi
|   +-- OnboardingScreen.tsx   → Ilk acilis rehberi
|   +-- StartScreen.tsx        → Kurulum/tarama secim (kilit yok)
|   +-- GroupScreen.tsx        → Grup/oda yonetimi
|   +-- StatsScreen.tsx        → Kullanim istatistikleri
|   +-- LegalScreen.tsx        → Gizlilik + kullanim kosullari
|
+-- components/
|   +-- Model3DViewer.tsx      → STL 3D goruntuleyici
|   +-- ColorPicker.tsx        → RGB renk secici
|   +-- PinScreen.tsx          → PIN giris modal
|   +-- SplashAnimation.tsx    → Acilis animasyonu
|   +-- ErrorBoundary.tsx      → Render hata yakalama
|
+-- services/
|   +-- apiService.ts          → ESP32 HTTP client
|   +-- deviceStorage.ts       → Cihaz CRUD (removeDevice grup temizler)
|   +-- groupStorage.ts        → Grup CRUD
|   +-- groupController.ts     → Paralel grup komutlari
|   +-- usageStorage.ts        → Kullanim istatistik kaydi
|   +-- presetStorage.ts       → Preset CRUD + getEffectMeta(t)
|   +-- automationService.ts   → Otomasyon + fade API
|   +-- networkScanner.ts      → IP tarama
|   +-- notificationService.ts → Yerel bildirimler
|   +-- stlCache.ts            → STL hybrid cache (ambiencebureau.com)
|
+-- hooks/
|   +-- useConnectionStatus.ts → Periyodik ping + AppState
|   +-- useDeviceDiscovery.ts  → Ag kesfi wrapper
|
+-- types/
|   +-- Device.ts              → Device, Channel, DeviceType
|   +-- Group.ts               → Group, GroupCommandResult
|
+-- theme/
|   +-- colors.ts              → Colors, Fonts, Spacing, Radius
|
+-- legal/
|   +-- privacy-policy.tr.md
|   +-- privacy-policy.en.md
|   +-- terms-of-use.tr.md
|   +-- terms-of-use.en.md
|
+-- arduino/
|   +-- v1.1.9/
|   +-- v1.2.0/
|   +-- v1.2.1/               → Aktif firmware
|   +-- claude/               → AI bagam dosyalari
```

---

## Kullanici Akışı

```
Ilk Kullanim:
  Uygulama ac → Onboarding → StartScreen
    → [Yeni Kurulum] → SetupScreen → ScanScreen → ControlScreen
    → [Cihaz Ara] → ScanScreen (her zaman aktif, kilit yok)

Sonraki Acılıslar:
  Uygulama ac → Splash → ControlScreen (son cihaz)

Grup Kontrolu:
  ControlScreen sag ust 🏠 → GroupScreen → Grup olustur → Hepsini Ac/Kapat

Istatistikler:
  ControlScreen sag ust 📊 → StatsScreen → Haftalik/Gunluk

Dil / Yasal:
  DeviceListScreen → (liste altında kaydır) → Dil / Yasal
```

---

## Guvenlik Notlari

- Tum veriler yerel — sunucuya hicbir kullanici verisi gonderilmez
- ESP32 iletisimi HTTP (yerel ag) — HTTPS gerekmez
- PIN ESP32 Preferences'ında saklanır — guclu PIN onerilir
- OTA: GitHub raw URL → version.json + .bin
- STL: ambiencebureau.com/parts/stl/{key}.stl
