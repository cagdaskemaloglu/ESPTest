/**
 * services/deviceStorage.ts
 * AsyncStorage üzerinde cihaz listesi için CRUD işlemleri.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from '../types/Device';

const STORAGE_KEY = 'torva_devices';
const LAST_KEY    = 'torva_last_device';

// ── Tüm cihazları oku ───────────────────────────────────────────────────────
export async function getDevices(): Promise<Device[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Device[];
  } catch (e) {
    console.error('getDevices hata:', e);
    return [];
  }
}

// ── Yeni cihaz ekle ─────────────────────────────────────────────────────────
export async function addDevice(device: Device): Promise<void> {
  try {
    const current = await getDevices();
    const alreadyExists = current.some((d) => d.ip === device.ip);
    if (alreadyExists) {
      console.log('Cihaz zaten kayıtlı:', device.ip);
      return;
    }
    const updated = [...current, device];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('addDevice hata:', e);
  }
}

// ── Cihaz sil ───────────────────────────────────────────────────────────────
export async function removeDevice(id: string): Promise<void> {
  try {
    const current = await getDevices();
    const updated = current.filter((d) => d.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('removeDevice hata:', e);
  }
}

// ── Cihaz adını güncelle ────────────────────────────────────────────────────
export async function renameDevice(id: string, newName: string): Promise<void> {
  try {
    const current = await getDevices();
    const updated = current.map((d) =>
      d.id === id ? { ...d, name: newName } : d
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('renameDevice hata:', e);
  }
}

// ── Brightness kaydet ───────────────────────────────────────────────────────
// Slider bırakıldığında çağrılır — her slider hareketinde değil.
export async function saveBrightness(id: string, brightness: number): Promise<void> {
  try {
    const current = await getDevices();
    const updated = current.map((d) =>
      d.id === id ? { ...d, brightness } : d
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('saveBrightness hata:', e);
  }
}

// ── Son aktif cihaz ─────────────────────────────────────────────────────────
export async function saveLastDeviceId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_KEY, id);
  } catch (e) {
    console.error('saveLastDeviceId hata:', e);
  }
}

export async function getLastDeviceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_KEY);
  } catch (e) {
    console.error('getLastDeviceId hata:', e);
    return null;
  }
}