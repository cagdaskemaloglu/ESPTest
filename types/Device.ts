/**
 * types/Device.ts
 *
 * Channel: ESP32'nin kontrol ettiği her adreslenebilir LED şeridi
 * DevicePart: 3D model için parça key listesi (sıralı, en az 1 en fazla 10)
 *
 * channels.length → kaç şerit var → ControlScreen buna göre render eder
 * parts → sıralı key listesi → ileride 3D model render için kullanılır
 */

export type DeviceType = 'ws2812b' | 'single_led' | 'relay' | 'unknown';

export type DeviceCapability = 'on_off' | 'brightness' | 'color' | 'effects';

export type Channel = {
  id:           number;
  name:         string;
  capabilities: DeviceCapability[];
  leds?:        number;
};

export type Device = {
  id:           string;
  name:         string;
  ip:           string;
  addedAt:      number;
  brightness:   number;
  color:        { r: number; g: number; b: number };
  type:         DeviceType;
  capabilities: DeviceCapability[]; // Geriye dönük uyumluluk — tek kanallı için
  leds?:        number;
  pin:          string;
  // Çoklu kanal — her adreslenebilir şerit bir channel
  // Tek kanallı cihazlarda channels: [{ id: 0, name: "Şerit", ... }]
  channels:     Channel[];
  // 3D model parça key listesi (sıralı, en az 1 en fazla 10)
  parts:        string[];
};

export function hasCapability(device: Device, cap: DeviceCapability): boolean {
  // Çoklu kanalda herhangi bir kanalda bu yetenek varsa true
  if (device.channels.length > 0) {
    return device.channels.some((ch) => ch.capabilities.includes(cap));
  }
  return device.capabilities.includes(cap);
}

export function channelHasCapability(channel: Channel, cap: DeviceCapability): boolean {
  return channel.capabilities.includes(cap);
}

export function defaultCapabilities(type: DeviceType): DeviceCapability[] {
  switch (type) {
    case 'ws2812b':    return ['on_off', 'brightness', 'color', 'effects'];
    case 'single_led': return ['on_off', 'brightness'];
    case 'relay':      return ['on_off'];
    case 'unknown':    return ['on_off', 'brightness', 'color', 'effects'];
  }
}

// /whoami'den channels yoksa varsayılan tek kanal oluştur
export function defaultChannels(type: DeviceType, leds?: number): Channel[] {
  return [{
    id:           0,
    name:         'Şerit',
    capabilities: defaultCapabilities(type),
    leds,
  }];
}