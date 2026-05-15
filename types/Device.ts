/**
 * types/Device.ts
 * Temel cihaz veri modeli.
 */

export type DeviceType = 'ws2812b' | 'single_led' | 'relay' | 'unknown';

export type DeviceCapability = 'on_off' | 'brightness' | 'color' | 'effects';

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
  pin:          string;   // ESP32 erişim PIN'i — her istekte gönderilir
};

export function hasCapability(device: Device, cap: DeviceCapability): boolean {
  return device.capabilities.includes(cap);
}

export function defaultCapabilities(type: DeviceType): DeviceCapability[] {
  switch (type) {
    case 'ws2812b':    return ['on_off', 'brightness', 'color', 'effects'];
    case 'single_led': return ['on_off', 'brightness'];
    case 'relay':      return ['on_off'];
    case 'unknown':    return ['on_off', 'brightness', 'color', 'effects'];
  }
}