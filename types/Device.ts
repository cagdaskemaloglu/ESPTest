/**
 * types/Device.ts
 * Temel cihaz veri modeli.
 *
 * type: ESP32'nin bildirdiği donanım tipi
 *   'ws2812b'    → adreslenebilir RGB şerit LED (renk + efekt destekli)
 *   'single_led' → tek renkli LED veya ampul (sadece aç/kapat + parlaklık)
 *   'unknown'    → eski firmware — /whoami type döndürmüyorsa
 *
 * capabilities: Desteklenen özellikler listesi
 *   'on_off'     → her cihazda var
 *   'brightness' → PWM/FastLED parlaklık kontrolü
 *   'color'      → RGB renk seçimi (ws2812b)
 *   'effects'    → animasyon efektleri (ws2812b)
 *
 * leds: WS2812B için şeritteki LED sayısı
 */

export type DeviceType = 'ws2812b' | 'single_led' | 'unknown';

export type DeviceCapability = 'on_off' | 'brightness' | 'color' | 'effects';

export type Device = {
  id:           string;
  name:         string;
  ip:           string;
  addedAt:      number;
  brightness:   number;              // 0-255
  color:        { r: number; g: number; b: number };
  // Cihaz tipi bilgileri — /whoami'den okunur
  type:         DeviceType;
  capabilities: DeviceCapability[];
  leds?:        number;              // Sadece ws2812b için
};

// Yardımcı: cihaz belirli bir yeteneğe sahip mi?
export function hasCapability(device: Device, cap: DeviceCapability): boolean {
  return device.capabilities.includes(cap);
}

// Yardımcı: eski firmware için varsayılan yetenekler
// /whoami type döndürmüyorsa ws2812b varsayılır (geriye dönük uyumluluk)
export function defaultCapabilities(type: DeviceType): DeviceCapability[] {
  switch (type) {
    case 'ws2812b':    return ['on_off', 'brightness', 'color', 'effects'];
    case 'single_led': return ['on_off', 'brightness'];
    case 'unknown':    return ['on_off', 'brightness', 'color', 'effects']; // ws2812b varsay
  }
}