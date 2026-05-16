# Torva Firmware

Torva Smart Light ESP32 firmware release deposu.

## Dosyalar

- `version.json` — Uygulama ve ESP32'nin kontrol ettiği sürüm dosyası
- `.bin` dosyaları — GitHub Releases üzerinde yayınlanır

## Yeni Sürüm Yayınlama

### 1. ESP32 kodunu güncelle

`ESP32_Light.ino` içindeki sürüm sabitini artır:

```cpp
#define FIRMWARE_VERSION "1.0.1"
```

### 2. .bin dosyasını derle

Arduino IDE:
```
Sketch → Export Compiled Binary
```

Proje klasöründe `ESP32_Light.ino.bin` oluşur.

### 3. GitHub Release oluştur

```
torva-firmware reposu → Releases → Draft a new release

Tag: v1.0.1
Title: v1.0.1 - Değişiklik açıklaması
Dosya ekle: ESP32_Light.ino.bin → adını ESP32_Light.bin olarak değiştir
Publish release
```

### 4. version.json güncelle

```json
{
  "version": "1.0.1",
  "url": "https://github.com/cagdaskemaloglu/torva-firmware/releases/download/v1.0.1/ESP32_Light.bin",
  "notes": "Hata düzeltmeleri ve performans iyileştirmeleri"
}
```

Commit + push → ESP32'ler otomatik güncelleme alır.

## OTA Güncelleme Akışı

```
Kullanıcı → DeviceListScreen → Firmware Kontrol Et
  → ESP32 /ota/check endpoint'i
  → ESP32 version.json'u çeker (bu repo)
  → Yeni sürüm varsa bildirir
  → Kullanıcı "Güncelle" butonuna basar
  → ESP32 /ota/update endpoint'i
  → ESP32 .bin dosyasını indirir (~30-60 saniye)
  → Flash'a yazar → otomatik restart
  → Güncelleme tamamlanır
```

## LED Geri Bildirimi

| Durum | LED |
|---|---|
| Güncelleme başlıyor | Mavi yanıp söner |
| İndiriliyor | Mavi yanıp söner (hız artar) |
| Başarılı | Yeşil sabit → restart |
| Hata | Kırmızı yanıp söner |
