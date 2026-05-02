/**
 * services/deviceStorage.ts
 * AsyncStorage üzerinde cihaz listesi için CRUD işlemleri.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from '../types/Device';

const STORAGE_KEY = 'torva_devices';
const LAST_KEY    = 'torva_last_device';

// Yeni eklenen cihazlar için varsayılan renk — beyaz
const DEFAULT_COLOR = { r: 255, g: 255, b: 255 };

export async function getDevices(): Promise<Device[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const devices = JSON.parse(raw) as Device[];
    // Eski kayıtlarda color alanı yoksa varsayılan ekle (geriye dönük uyumluluk)
    return devices.map((d) => ({
      ...d,
      color: d.color ?? DEFAULT_COLOR,
    }));
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
  } catch (e) {
    console.error('addDevice hata:', e);
  }
}

export async function removeDevice(id: string): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter((d) => d.id !== id)));
  } catch (e) {
    console.error('removeDevice hata:', e);
  }
}

export async function renameDevice(id: string, newName: string): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, name: newName } : d)
    ));
  } catch (e) {
    console.error('renameDevice hata:', e);
  }
}

// Brightness kaydet
export async function saveBrightness(id: string, brightness: number): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, brightness } : d)
    ));
  } catch (e) {
    console.error('saveBrightness hata:', e);
  }
}

// Renk kaydet — ışık kapalıyken de çağrılır
export async function saveColor(
  id: string,
  color: { r: number; g: number; b: number }
): Promise<void> {
  try {
    const current = await getDevices();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
      current.map((d) => d.id === id ? { ...d, color } : d)
    ));
  } catch (e) {
    console.error('saveColor hata:', e);
  }
}

export async function saveLastDeviceId(id: string): Promise<void> {
  try { await AsyncStorage.setItem(LAST_KEY, id); }
  catch (e) { console.error('saveLastDeviceId hata:', e); }
}

export async function getLastDeviceId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LAST_KEY); }
  catch (e) { console.error('getLastDeviceId hata:', e); return null; }
}