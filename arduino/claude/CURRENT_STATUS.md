# CURRENT_STATUS.md — Ambience Bureau

Son güncelleme: Haziran 2026

---

## Genel Durum

Uygulama **yayına hazır** aşamasında. Tüm temel özellikler çalışıyor,
i18n sistemi kuruldu, güvenlik/sağlamlık iyileştirmeleri tamamlandı,
uygulama adı Ambience Bureau olarak güncellendi.
EAS build testi ve store başvurusu kaldı.

---

## Firmware (ESP32)

| Versiyon | Durum   | Özellikler |
|----------|---------|------------|
| v1.1.9   | Kararlı | Temel: WiFi, LED, OTA, otomasyon, parts |
| v1.2.0   | Kararlı | + Fade/uyku modu, 23 LED efekti |
| v1.2.1   | Kararlı | + Fade brightness restore fix (aktif) |

### Desteklenen LED Efektleri (23 adet)
rainbow, breathe, wave, fire, meteor, twinkle, strobe, comet,
theater, pulse, colorCycle, gradient, wipe, bouncing, scanner,
chase, ripple, sparkle, noise, larsonScanner, confetti, juggle, bpm

---

## React Native Uygulaması

### Tamamlanan Özellikler

- Onboarding (4 slayt, dile göre)
- WiFi kurulum + ağ taraması (ScanScreen)
- LED kontrol: açma/kapama, parlaklık, renk, 23 efekt
- Uyku modu (fade — parlaklık yavaşça düşer, kapanır)
- Preset/sahne sistemi (statik + efekt, kişisel kayıt)
- Otomasyon: günlük zamanlayıcı + geri sayım
- 3D model viewer (STL hybrid cache: bundle → disk → ambiencebureau.com)
- Çoklu cihaz + slide navigasyon (GLView korunur)
- Grup/Oda kontrolü (paralel HTTP, kısmi başarı bildirimi)
- Kullanım istatistikleri (30 gün otomatik temizleme, bar chart)
- PIN güvenliği + brute force koruması
- OTA güncelleme (GitHub raw)
- i18n: TR + EN tam çeviri (tüm ekranlar)
- ErrorBoundary (class component, LanguageContext'e bağlı)
- Gizlilik politikası + kullanım koşulları (uygulama içi + .md)
- AppState entegrasyonlu bağlantı hook (arka planda ping durur)
- syncKey: overlay ekranlardan dönünce LED durumu otomatik güncellenir
- removeDevice: otomatik grup temizleme
- StartScreen: kilit kaldırıldı, "Cihaz Ara" her zaman aktif
- App ikonları entegre edildi, splash arka plan #000000

### Eksik / Yapılacak

Yayın için:
- EAS Build testi (iOS + Android)
- App Store / Play Store başvurusu
  - Gizlilik politikası URL: ambiencebureau.com/privacy
  - Ekran görüntüleri
  - Uygulama açıklaması (TR + EN)
  - eas.json submit bölümü doldurulacak (appleId, ascAppId, appleTeamId)

v2.0:
- iOS Widget (WidgetKit)
- Android Widget
- Siri Shortcuts / Google Assistant
- Bluetooth LE kurulum

---

## AsyncStorage Anahtar Listesi

| Anahtar | İçerik |
|---------|--------|
| ambience_devices | Kayıtlı cihaz listesi (Device[]) |
| ambience_last_device | Son aktif cihaz ID |
| ambience_groups | Grup listesi (Group[]) |
| ambience_presets_{deviceId} | Cihaz presetleri (Preset[]) |
| ambience_brightness_{deviceId} | Son parlaklık değeri |
| ambience_color_{deviceId} | Son renk (r,g,b) |
| ambience_language | Seçili dil ('tr' | 'en') |
| ambience_usage_{deviceId} | Kullanım eventleri (UsageEvent[]) |
| ambience_setup_done | Kurulum tamamlandı mı |
