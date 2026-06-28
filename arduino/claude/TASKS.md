# TASKS.md — Ambience Bureau

Son guncelleme: Haziran 2026

---

## Yayın İçin Zorunlu

- [ ] EAS Build testi
  ```bash
  eas build --platform ios --profile preview
  eas build --platform android --profile preview
  ```

- [ ] App Store / Play Store başvurusu
  - eas.json submit bölümüne appleId, ascAppId, appleTeamId ekle
  - Gizlilik politikası URL: ambiencebureau.com/privacy
  - Kullanım koşulları URL: ambiencebureau.com/terms
  - Ekran görüntüleri (iPhone 6.7", Android)
  - Uygulama açıklaması TR + EN
  - App Store kategori: Utilities / Smart Home

---

## v2.0 Hedefleri

- [ ] iOS Widget (WidgetKit — Expo bare workflow + Swift)
- [ ] Android Widget (Kotlin/Java)
- [ ] Siri Shortcuts entegrasyonu
- [ ] Google Assistant entegrasyonu
- [ ] Bluetooth LE kurulum (WiFi AP yerine alternatif)

---

## Tamamlananlar ✅

### Firmware
- [x] v1.1.9 — Temel WiFi/LED/OTA/otomasyon/parts
- [x] v1.2.0 — 23 LED efekti + fade/uyku modu
- [x] v1.2.1 — Fade brightness restore fix

### Uygulama
- [x] Tam onboarding akışı
- [x] WiFi kurulum + ağ taraması
- [x] LED kontrol (açma/kapama, parlaklık, renk, 23 efekt)
- [x] Uyku modu (fade)
- [x] Preset/sahne sistemi
- [x] Otomasyon (günlük + geri sayım)
- [x] 3D model viewer (STL hybrid cache)
- [x] Çoklu cihaz + slide navigasyon
- [x] PIN güvenliği + brute force koruması
- [x] OTA güncelleme
- [x] i18n sistemi (TR/EN — tüm ekranlar)
- [x] ErrorBoundary
- [x] Gizlilik politikası + kullanım koşulları
- [x] Kullanılmayan paket temizliği
- [x] AppState entegrasyonlu bağlantı hook
- [x] Grup/Oda kontrolü
- [x] Kullanım istatistikleri
- [x] syncKey: overlay'den dönünce LED durumu güncellenir
- [x] removeDevice: otomatik grup temizleme
- [x] StatsScreen i18n (Tümü/sa/kez)
- [x] StartScreen kilit kaldırıldı
- [x] Uygulama adı: Ambience Bureau (com.ambiencebureau.app)
- [x] AsyncStorage prefix: ambience_*
- [x] STL URL: ambiencebureau.com
- [x] EAS build konfigürasyonu (eas.json)
- [x] App ikonları entegre edildi (splash #000000)
- [x] Header: AMBIENCE · LAB (tüm ekranlar)
- [x] DeviceListScreen: Dil + Yasal cihaz listesinin altında
- [x] arduino/claude/ dokümanları güncellendi
