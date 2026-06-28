# CLAUDE.md — Ambience Bureau

Bu dosya Claude AI için proje bağlamını özetler.
Yeni bir konuşmada bu dosyayı paylaşarak hızlıca bağlam kur.

---

## Proje Nedir?

Ambience Bureau, müşteriye özel 3D baskı parçalardan oluşan ESP32 tabanlı akıllı lambader sistemi.
- **Mobil:** React Native (Expo SDK 54) — LED kontrol, otomasyon, grup/oda yönetimi, istatistikler, 3D model görüntüleme
- **Firmware:** Arduino C++ (ESP32) — WiFi, WS2812B LED, 23 efekt, OTA, fade/uyku modu, parts sistemi
- **Web:** Next.js — 3D STL viewer, parça seçimi, sipariş formu (ambiencebureau.com)

Detaylar: ARCHITECTURE.md, PROJECT_OVERVIEW.md

---

## Kritik Bilgiler

### Uygulama Kimliği
```
Uygulama adı:      Ambience Bureau
Bundle ID (iOS):   com.ambiencebureau.app
Package (Android): com.ambiencebureau.app
Slug / Scheme:     ambiencebureau
package.json name: ambience-bureau
```

### Tema
```
bg: #080b10 · cyan: #00d4ff · border: #1e2d3d · text: #c8d8e8
Splash arka plan: #000000
Font: SpaceMono (mono), SpaceGrotesk (sans)
```

### AsyncStorage Anahtar Prefix
```
ambience_devices, ambience_last_device, ambience_groups
ambience_presets_{id}, ambience_brightness_{id}, ambience_color_{id}
ambience_language, ambience_usage_{id}, ambience_setup_done
```

### i18n Sistemi
- i18n/translations.ts — TR + EN çeviri sözlüğü, tüm TranslationKey union tipi burada
- i18n/LanguageContext.tsx — LanguageProvider + useLanguage() + LanguageContext (export edilmiş)
- Telefon dili otomatik algılanır (expo-localization), ayarlardan değiştirilebilir
- Yeni anahtar eklerken: TranslationKey tipine ekle → TR + EN değerlerini ekle → tsc ile doğrula

### Önemli Kararlar
- StartScreen kilit kaldırıldı — "Cihaz Ara" butonu her zaman aktif, bilgi notu korundu
- PIN opsiyonel — boş bırakılabilir
- STL URL: https://www.ambiencebureau.com/parts/stl/{key}.stl
- OTA version.json: https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json
- EFFECT_META yerine getEffectMeta(t) — efekt isimleri dile göre değişir
- getPresetDisplayName(preset, t) — preset adlarını dile göre çevirir
- removeDevice → otomatik olarak removeDeviceFromGroups çağırır (dynamic import)
- syncKey — overlay ekranlardan control'e her dönüşte artırılır → syncAllChannels tetiklenir
- goToControl() — setStep('control') + setSyncKey(k+1) birlikte, tüm geri dönüşlerde kullanılır
- ErrorBoundary — declare context Babel'de hata verir, as { t?: ... } | null cast kullan
- Header metinleri: AMBIENCE · LAB (tüm ekranlar)

### Dosya Konumları
```
Ana router:        App.tsx
Tema:              theme/colors.ts
Cihaz tipi:        types/Device.ts
Grup tipi:         types/Group.ts
API servisi:       services/apiService.ts
Grup depolama:     services/groupStorage.ts
Grup kontrol:      services/groupController.ts
Kullanım istat.:   services/usageStorage.ts
STL cache:         services/stlCache.ts (ambiencebureau.com remote)
Bağlantı hook:     hooks/useConnectionStatus.ts (AppState entegrasyonlu)
Error sınırı:      components/ErrorBoundary.tsx
Ana kontrol:       screens/ControlScreen.tsx
Grup ekranı:       screens/GroupScreen.tsx
İstatistik ekranı: screens/StatsScreen.tsx
Yasal ekran:       screens/LegalScreen.tsx
Çeviri sözlüğü:    i18n/translations.ts
Dil context:       i18n/LanguageContext.tsx
EAS config:        eas.json
```

### OTA ve URL'ler
```
version.json: https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json
.bin:         https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/firmware/ESP32_Light.ino.bin
STL:          https://www.ambiencebureau.com/parts/stl/{key}.stl
```

### Firmware Versiyonları
```
v1.1.9 — kararlı temel
v1.2.0 — 23 LED efekti + fade/uyku modu
v1.2.1 — fade brightness restore fix (aktif)
```

---

## App Routing (App.tsx)

```
loading → splash → onboarding → start → setup → scan → control
                                                          |
                                    +--- deviceList <----+
                                    +--- legal           |
                                    +--- groups ---------+
                                    +--- stats ----------+
```

ControlScreen her zaman mount'ta kalır (GLView context korunur).
Diğer ekranlar absolute overlay olarak üstte render edilir.
goToControl() ile dönüşte syncKey artırılır → LED durumu güncellenir.

---

## Mevcut Durum

Tamamlandı:
- Tam uygulama akışı + i18n (TR/EN)
- LED kontrol, 23 efekt, sahneler, otomasyon, bildirimler
- Uyku modu, PIN güvenliği, OTA güncelleme
- 3D model viewer (STL hybrid cache)
- Çoklu cihaz + grup/oda kontrolü
- Kullanım istatistikleri
- ErrorBoundary, gizlilik politikası
- Uygulama adı: Ambience Bureau (com.ambiencebureau.app)
- EAS build konfigürasyonu (eas.json)
- App ikonları entegre edildi

Eksik:
- EAS build ile gerçek cihaz testi
- App Store / Play Store başvurusu
- Widget / Sesli komut (v2.0)

---

## Geliştirme Notları

- Yeni ekran: Step tipine ekle → renderOverlay() if bloğu → goToControl() ile geri dön
- i18n sırası: TranslationKey → TR → EN → tsc doğrulama
- apiService.createAPI(ip, pin, onUnauthorized) — tüm ESP32 istekleri buradan
- ChannelControl: her kanal bağımsız state, kendi useLanguage() çağırır
- safeChannels: device.channels null olabilir, ?? [] fallback kullan
- useConnectionStatus: AppState entegrasyonlu, arka planda ping durur
