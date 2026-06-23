/**
 * services/groupController.ts
 *
 * Bir gruba paralel HTTP komutları gönderir.
 * Promise.allSettled kullanılır — bir cihazın başarısız olması
 * diğerlerine gönderilen komutları durdurmaz.
 */

import { Device } from '../types/Device';
import { GroupCommandResult } from '../types/Group';

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

function buildUrl(ip: string, pin: string, path: string, params: Record<string, string> = {}): string {
  const allParams: Record<string, string> = { pin, ...params };
  const query = Object.entries(allParams)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `http://${ip}${path}${query ? '?' + query : ''}`;
}

// ── Komut fonksiyonları ──────────────────────────────────────────────────────

export type GroupCommand =
  | { type: 'on' }
  | { type: 'off' }
  | { type: 'brightness'; value: number }
  | { type: 'color'; r: number; g: number; b: number };

async function sendCommand(device: Device, command: GroupCommand): Promise<boolean> {
  const { ip, pin } = device;
  try {
    let url: string;
    switch (command.type) {
      case 'on':
        url = buildUrl(ip, pin, '/led/on');
        break;
      case 'off':
        url = buildUrl(ip, pin, '/led/off');
        break;
      case 'brightness':
        url = buildUrl(ip, pin, '/led/brightness', { value: String(command.value) });
        break;
      case 'color':
        url = buildUrl(ip, pin, '/led/color', {
          r: String(command.r),
          g: String(command.g),
          b: String(command.b),
        });
        break;
      default:
        return false;
    }
    const res = await fetchWithTimeout(url);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Bir gruba ait cihazlara paralel komut gönderir.
 * Her cihazın sonucunu döner — kısmi başarı mümkündür.
 */
export async function sendGroupCommand(
  devices: Device[],
  command: GroupCommand,
): Promise<GroupCommandResult[]> {
  const results = await Promise.allSettled(
    devices.map((device) => sendCommand(device, command))
  );

  return results.map((result, i) => ({
    deviceId: devices[i].id,
    success:  result.status === 'fulfilled' && result.value === true,
    error:    result.status === 'rejected' ? String(result.reason) : undefined,
  }));
}

/**
 * Kaç cihaz online (erişilebilir) hızlı kontrol eder.
 * GroupScreen'de "N/M cihaz çevrimiçi" bilgisi için kullanılır.
 */
export async function checkGroupOnlineCount(devices: Device[]): Promise<number> {
  const results = await Promise.allSettled(
    devices.map(async (d) => {
      const url = buildUrl(d.ip, d.pin, '/whoami');
      const res = await fetchWithTimeout(url);
      return res.ok;
    })
  );
  return results.filter((r) => r.status === 'fulfilled' && r.value).length;
}
