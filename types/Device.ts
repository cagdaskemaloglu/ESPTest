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

// Part materyal bilgisi — 3D render için
export type PartMaterial = {
  color:     string;  // hex — örn. "#1a1a1a"
  roughness: number;  // 0.0 (parlak) → 1.0 (mat)
  metalness: number;  // 0.0 (plastik) → 1.0 (metal)
};

export type Device = {
  id:           string;
  name:         string;
  ip:           string;
  addedAt:      number;
  brightness:   number;
  color:        { r: number; g: number; b: number };
  type:         DeviceType;
  capabilities: DeviceCapability[];
  leds?:        number;
  pin:          string;
  channels:     Channel[];
  // Part key listesi — sıralı, 3D render için
  parts:        string[];
  // Her part için materyal — key: part adı
  partMaterials: Record<string, PartMaterial>;
};

export function hasCapability(device: Device, cap: DeviceCapability): boolean {
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

export function defaultChannels(type: DeviceType, leds?: number): Channel[] {
  return [{
    id:           0,
    name:         'Şerit',
    capabilities: defaultCapabilities(type),
    leds,
  }];
}

// Varsayılan materyal — part rengi bilinmiyorsa
export const DEFAULT_PART_MATERIAL: PartMaterial = {
  color:     '#2a2a2a',
  roughness: 0.8,
  metalness: 0.1,
};