/**
 * services/deviceStorage.ts
 * AsyncStorage üzerinde cihaz listesi için CRUD işlemleri.
 * Tüm fonksiyonlar async/await ile çalışır ve hata durumunda
 * uygulamayı çökertmek yerine güvenli varsayılan değer döner.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from '../types/Device';

// AsyncStorage'da cihaz listesinin tutulduğu anahtar
const STORAGE_KEY = 'torva_devices';

// ── Tüm cihazları oku ───────────────────────────────────────────────────────
export async function getDevices(): Promise<Device[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];                     // İlk kullanım — liste boş
    return JSON.parse(raw) as Device[];
  } catch (e) {
    console.error('getDevices hata:', e);
    return [];                               // Bozuk veri varsa boş liste döner
  }
}

// ── Yeni cihaz ekle ─────────────────────────────────────────────────────────
export async function addDevice(device: Device): Promise<void> {
  try {
    const current = await getDevices();

    // Aynı IP'li cihaz zaten kayıtlıysa tekrar ekleme
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

// ── Son aktif cihaz ID'sini kaydet ──────────────────────────────────────────
// Uygulama yeniden açılınca son kullanılan cihaza dönmek için kullanılır
const LAST_KEY = 'torva_last_device';

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