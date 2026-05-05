/**
 * services/deviceStorage.ts
 * AsyncStorage üzerinde cihaz listesi için CRUD işlemleri.
 *
 * Geriye dönük uyumluluk:
 *   Eski kayıtlarda type/capabilities yoksa varsayılan değerler atanır.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Device,
  DeviceType,
  defaultCapabilities
} from '../types/Device';

const STORAGE_KEY = 'torva_devices';
const LAST_KEY    = 'torva_last_device';

// Eski kayıtlara eksik alanları ekle — geriye dönük uyumluluk
function normalize(d: any): Device {
  const type: DeviceType = d.type ?? 'unknown';
  return {
    id:           d.id,
    name:         d.name,
    ip:           d.ip,
    addedAt:      d.addedAt,
    brightness:   d.brightness ?? 255,
    color:        d.color ?? { r: 255, g: 255, b: 255 },
    type,
    capabilities: d.capabilities ?? defaultCapabilities(type),
    leds:         d.leds,
  };
}

export async function getDevices(): Promise<Device[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as any[];
    return list.map(normalize);
  } catch (e) {
    console.error('getDevices hata:', e);
    return [];
  }
}

export async function addDevice(device: Device): Promise<void> {
  try {
    const current     = await getDevices();
    const alreadyExists = current.some((d) => d.ip === device.ip);
    if (alreadyExists) { console.log('Cihaz zaten kayıtlı:', device.ip); return; }
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

export async function saveColor(
  id: string,
  color: { r: number; g: number; b: number }
): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, color } : d)
    ));
  } catch (e) { console.error('saveColor hata:', e); }
}

export async function saveLastDeviceId(id: string): Promise<void> {
  try { await AsyncStorage.setItem(LAST_KEY, id); }
  catch (e) { console.error('saveLastDeviceId hata:', e); }
}

export async function getLastDeviceId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LAST_KEY); }
  catch (e) { console.error('getLastDeviceId hata:', e); return null; }
}