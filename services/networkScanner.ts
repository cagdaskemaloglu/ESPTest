/**
 * services/networkScanner.ts
 * Yerel ağda ESP32 cihazlarını arayan servis.
 *
 * /whoami yanıtından type ve capabilities okunur.
 * Eski firmware (type yok) için 'unknown' tipi atanır.
 */

import * as Network from 'expo-network';
import {
  DeviceCapability,
  DeviceType,
  defaultCapabilities,
} from '../types/Device';

const CHUNK_SIZE = 20;
const TIMEOUT_MS = 800;

export type FoundDevice = {
  ip:           string;
  name:         string;
  type:         DeviceType;
  capabilities: DeviceCapability[];
  leds?:        number;
};

function fetchWithTimeout(url: string, timeout = TIMEOUT_MS): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('timeout'), timeout);
    fetch(url)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function checkIP(ip: string): Promise<FoundDevice | null> {
  try {
    const res  = await fetchWithTimeout(`http://${ip}/whoami`);
    const data = await res.json();

    if (!data.device) return null;

    // type yoksa eski firmware — unknown
    const type: DeviceType = data.type ?? 'unknown';

    // capabilities yoksa type'a göre varsayılan ata
    const capabilities: DeviceCapability[] =
      data.capabilities ?? defaultCapabilities(type);

    return {
      ip,
      name: data.device,
      type,
      capabilities,
      leds: data.leds,
    };
  } catch {}
  return null;
}

export async function scanNetwork(callbacks: {
  onDeviceFound?: (device: FoundDevice) => void;
  onProgress?:    (scanned: number, total: number) => void;
}): Promise<FoundDevice[]> {
  const { onDeviceFound, onProgress } = callbacks;

  console.log('🔍 SCAN BAŞLADI');

  const localIP = await Network.getIpAddressAsync();
  if (!localIP) return [];

  const baseIP = localIP.substring(0, localIP.lastIndexOf('.') + 1);
  const allIPs = Array.from({ length: 254 }, (_, i) => baseIP + (i + 1));
  const groups = chunk(allIPs, CHUNK_SIZE);
  const found: FoundDevice[] = [];
  let scanned = 0;

  for (const group of groups) {
    const results = await Promise.all(group.map((ip) => checkIP(ip)));
    scanned += group.length;
    onProgress?.(scanned, allIPs.length);

    for (const device of results) {
      if (device) {
        console.log(`✅ FOUND: ${device.ip} [${device.type}]`);
        found.push(device);
        onDeviceFound?.(device);
      }
    }
  }

  console.log(`🏁 SCAN BİTTİ — ${found.length} cihaz`);
  return found;
}