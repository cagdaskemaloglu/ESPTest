/**
 * services/deviceStorage.ts
 * Geriye dönük uyumluluk: eski kayıtlarda channels/parts yoksa varsayılan oluştur
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Device,
  DeviceType,
  defaultCapabilities,
  defaultChannels,
} from '../types/Device';

const STORAGE_KEY = 'torva_devices';
const LAST_KEY    = 'torva_last_device';

function normalize(d: any): Device {
  const type: DeviceType = d.type ?? 'unknown';
  const leds: number | undefined = d.leds;

  // Eski kayıtlarda channels yoksa tek kanallı varsayılan oluştur
  const channels = d.channels ?? defaultChannels(type, leds);

  // Eski kayıtlarda parts yoksa boş liste
  const parts: string[] = d.parts ?? [];

  return {
    id:           d.id,
    name:         d.name,
    ip:           d.ip,
    addedAt:      d.addedAt,
    brightness:   d.brightness ?? 255,
    color:        d.color ?? { r: 255, g: 255, b: 255 },
    type,
    capabilities: d.capabilities ?? defaultCapabilities(type),
    leds,
    pin:          d.pin ?? '',
    channels,
    parts,
  };
}

export async function getDevices(): Promise<Device[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(normalize);
  } catch (e) { console.error('getDevices hata:', e); return []; }
}

export async function addDevice(device: Device): Promise<void> {
  try {
    const current = await getDevices();
    if (current.some((d) => d.ip === device.ip)) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...current, device]));
  } catch (e) { console.error('addDevice hata:', e); }
}

export async function removeDevice(id: string): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter((d) => d.id !== id)));
  } catch (e) { console.error('removeDevice hata:', e); }
}

export async function renameDevice(id: string, newName: string): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, name: newName } : d)
    ));
  } catch (e) { console.error('renameDevice hata:', e); }
}

export async function saveBrightness(id: string, brightness: number): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, brightness } : d)
    ));
  } catch (e) { console.error('saveBrightness hata:', e); }
}

export async function saveColor(id: string, color: { r: number; g: number; b: number }): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, color } : d)
    ));
  } catch (e) { console.error('saveColor hata:', e); }
}

export async function savePin(id: string, pin: string): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, pin } : d)
    ));
  } catch (e) { console.error('savePin hata:', e); }
}

export async function saveLastDeviceId(id: string): Promise<void> {
  try { await AsyncStorage.setItem(LAST_KEY, id); }
  catch (e) { console.error('saveLastDeviceId hata:', e); }
}

export async function getLastDeviceId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LAST_KEY); }
  catch (e) { console.error('getLastDeviceId hata:', e); return null; }
}