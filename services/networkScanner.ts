/**
 * services/networkScanner.ts
 * Yerel ağda ESP32 cihazı arayan servis.
 *
 * Paralel tarama stratejisi:
 *   - 254 IP'yi CHUNK_SIZE'lık gruplara böler (varsayılan 20)
 *   - Her grubu Promise.all ile paralel tarar
 *   - Grup biter bitmez sonraki gruba geçer
 *   - Cihaz bulununca taramayı durdurur (gereksiz istekleri atar)
 *
 * Neden gruplu?
 *   - 254 isteği aynı anda atmak telefonun ağ limitlerini zorlayabilir
 *   - 20'lik gruplar hem hızlı hem de stabil çalışır
 *   - Tahmini süre: ~3-5 saniye (sıralı tarama ~50 saniyeydi)
 */

import * as Network from 'expo-network';

const CHUNK_SIZE = 20;   // Aynı anda gönderilen istek sayısı
const TIMEOUT_MS = 800;  // Her istek için timeout

// Timeout destekli fetch
function fetchWithTimeout(url: string, timeout = TIMEOUT_MS): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('timeout'), timeout);
    fetch(url)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err);  });
  });
}

// Diziyi n'lik gruplara böl
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Tek bir IP'ye istek at, ESP32 ise IP'yi döndür
async function checkIP(ip: string): Promise<string | null> {
  try {
    const res  = await fetchWithTimeout(`http://${ip}/whoami`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (data.device === 'esp32-light') return ip;
  } catch {}
  return null;
}

export async function scanNetwork(
  onFound:    (ip: string) => void,
  onProgress?: (scanned: number, total: number) => void,
) {
  console.log('🔍 SCAN BAŞLADI');

  const localIP = await Network.getIpAddressAsync();
  console.log('📡 LOCAL IP:', localIP);
  if (!localIP) return;

  const baseIP = localIP.substring(0, localIP.lastIndexOf('.') + 1);
  console.log('🌐 BASE IP:', baseIP);

  // 1-254 arası tüm IP'leri oluştur
  const allIPs = Array.from({ length: 254 }, (_, i) => baseIP + (i + 1));
  const groups = chunk(allIPs, CHUNK_SIZE);

  let found   = false;
  let scanned = 0;

  for (const group of groups) {
    // Cihaz bulunduysa kalan grupları tarama
    if (found) break;

    // Gruptaki tüm IP'leri paralel tara
    const results = await Promise.all(group.map((ip) => checkIP(ip)));

    scanned += group.length;
    onProgress?.(scanned, allIPs.length);

    // Bulunan ilk cihazı bildir
    for (const ip of results) {
      if (ip) {
        console.log('✅ FOUND:', ip);
        found = true;
        onFound(ip);
        break;
      }
    }
  }

  if (!found) console.log('❌ CİHAZ BULUNAMADI');
  console.log('🏁 SCAN BİTTİ');
}