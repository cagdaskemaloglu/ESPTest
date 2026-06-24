/**
 * services/groupStorage.ts
 *
 * Grup verilerini AsyncStorage'da saklar ve yönetir.
 * Her CRUD işlemi tam listeyi yeniden yazar (cihaz sayısı az olduğu için performans sorunu yok).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group } from '../types/Group';

const STORAGE_KEY = 'ambience_groups';

function generateId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getGroups(): Promise<Group[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Group[];
  } catch (e) {
    console.error('getGroups hata:', e);
    return [];
  }
}

export async function saveGroups(groups: Group[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('saveGroups hata:', e);
  }
}

export async function addGroup(name: string, icon: string, deviceIds: string[]): Promise<Group> {
  const groups = await getGroups();
  const newGroup: Group = {
    id:        generateId(),
    name,
    icon,
    deviceIds,
    createdAt: Date.now(),
  };
  await saveGroups([...groups, newGroup]);
  return newGroup;
}

export async function updateGroup(
  id: string,
  updates: Partial<Pick<Group, 'name' | 'icon' | 'deviceIds'>>,
): Promise<void> {
  const groups = await getGroups();
  await saveGroups(groups.map((g) => g.id === id ? { ...g, ...updates } : g));
}

export async function removeGroup(id: string): Promise<void> {
  const groups = await getGroups();
  await saveGroups(groups.filter((g) => g.id !== id));
}

// Bir cihaz silindiğinde ilgili gruplardan da çıkar
export async function removeDeviceFromGroups(deviceId: string): Promise<void> {
  const groups = await getGroups();
  const updated = groups
    .map((g) => ({ ...g, deviceIds: g.deviceIds.filter((id) => id !== deviceId) }))
    .filter((g) => g.deviceIds.length > 0); // üyesiz grup otomatik silinir
  await saveGroups(updated);
}