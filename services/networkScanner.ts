/**
 * services/networkScanner.ts
 * Yerel ağda ESP32 cihazlarını arayan servis.
 *
 * Önceki davranış:
 *   İlk bulunan cihazda duruyordu → ikinci cihaz hiç görünmüyordu.
 *
 * Yeni davranış:
 *   Tüm ağı tarar, bulunan TÜM cihazları toplar ve döndürür.
 *   onProgress callback'i ile tarama ilerlemesi bildirilir.
 *   onDeviceFound callback'i ile her bulunan cihaz anında bildirilir
 *   (kullanıcı tarama bitmeden de listeyi görebilir).
 *
 * Paralel strateji:
 *   254 IP, CHUNK_SIZE'lık gruplara bölünür.
 *   Her grup Promise.all ile paralel taranır.
 *   Tahmini süre: ~3-5 saniye.
 */

import * as Network from 'expo-network';

const CHUNK_SIZE = 20;
const TIMEOUT_MS = 800;

export type FoundDevice = {
  ip:   string;
  name: string; // /whoami'den gelen "device" alanı
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

// Tek IP'yi kontrol et — ESP32 ise FoundDevice döndür, değilse null
async function checkIP(ip: string): Promise<FoundDevice | null> {
  try {
    const res  = await fetchWithTimeout(`http://${ip}/whoami`);
    const text = await res.text();
    const data = JSON.parse(text);
    // device alanı olan her yanıt geçerli sayılır
    if (data.device) return { ip, name: data.device };
  } catch {}
  return null;
}

export async function scanNetwork(callbacks: {
  onDeviceFound?: (device: FoundDevice) => void; // Her bulunan cihaz anında
  onProgress?:    (scanned: number, total: number) => void;
}): Promise<FoundDevice[]> {
  const { onDeviceFound, onProgress } = callbacks;

  console.log('🔍 SCAN BAŞLADI');

  const localIP = await Network.getIpAddressAsync();
  console.log('📡 LOCAL IP:', localIP);
  if (!localIP) return [];

  const baseIP = localIP.substring(0, localIP.lastIndexOf('.') + 1);
  console.log('🌐 BASE IP:', baseIP);

  const allIPs    = Array.from({ length: 254 }, (_, i) => baseIP + (i + 1));
  const groups    = chunk(allIPs, CHUNK_SIZE);
  const found:    FoundDevice[] = [];
  let   scanned = 0;

  for (const group of groups) {
    const results = await Promise.all(group.map((ip) => checkIP(ip)));

    scanned += group.length;
    onProgress?.(scanned, allIPs.length);

    for (const device of results) {
      if (device) {
        console.log('✅ FOUND:', device.ip, device.name);
        found.push(device);
        onDeviceFound?.(device); // Anında bildir — UI listeyi canlı günceller
      }
    }
  }

  console.log(`🏁 SCAN BİTTİ — ${found.length} cihaz bulundu`);
  return found;
}