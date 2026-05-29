/**
 * services/networkScanner.ts
 * /whoami'den channels ve parts okunur.
 * Eski firmware'de channels yoksa defaultChannels() ile tek kanal oluşturulur.
 */

import * as Network from 'expo-network';
import {
  Channel,
  DEFAULT_PART_MATERIAL,
  defaultCapabilities,
  defaultChannels,
  DeviceCapability,
  DeviceType,
  PartMaterial,
} from '../types/Device';

const CHUNK_SIZE = 20;
const TIMEOUT_MS = 800;

export type FoundDevice = {
  ip:            string;
  name:          string;
  type:          DeviceType;
  capabilities:  DeviceCapability[];
  leds?:         number;
  pinRequired:   boolean;
  channels:      Channel[];
  parts:         string[];
  partMaterials: Record<string, PartMaterial>;
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

    const type: DeviceType = data.type ?? 'unknown';
    const leds: number | undefined = data.leds;
    const capabilities: DeviceCapability[] = data.capabilities ?? defaultCapabilities(type);
    const channels: Channel[] = data.channels ?? defaultChannels(type, leds);
    const parts: string[] = Array.isArray(data.parts) ? data.parts : [];

    // partColors, partRoughness, partMetalness → partMaterials'e birleştir
    const partColors:    Record<string, string> = data.partColors    ?? {};
    const partRoughness: Record<string, number> = data.partRoughness ?? {};
    const partMetalness: Record<string, number> = data.partMetalness ?? {};

    const partMaterials: Record<string, PartMaterial> = {};
    parts.forEach((key) => {
      partMaterials[key] = {
        color:     partColors[key]    ?? DEFAULT_PART_MATERIAL.color,
        roughness: partRoughness[key] ?? DEFAULT_PART_MATERIAL.roughness,
        metalness: partMetalness[key] ?? DEFAULT_PART_MATERIAL.metalness,
      };
    });

    return {
      ip,
      name:         data.device,
      type,
      capabilities,
      leds,
      pinRequired:  data.pin_required === true,
      channels,
      parts,
      partMaterials,
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
        console.log(`✅ FOUND: ${device.ip} [${device.type}] ${device.channels.length}ch parts:[${device.parts.join(',')}]`);
        found.push(device);
        onDeviceFound?.(device);
      }
    }
  }

  console.log(`🏁 SCAN BİTTİ — ${found.length} cihaz`);
  return found;
}