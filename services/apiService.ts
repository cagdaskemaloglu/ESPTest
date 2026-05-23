/**
 * services/apiService.ts
 * Merkezi ESP32 HTTP istek servisi.
 * channel parametresi otomatik eklenir.
 */

const TIMEOUT_MS = 5000;

export type APIError = {
  type:    'timeout' | 'network' | 'unauthorized' | 'server' | 'unknown';
  status?: number;
  message: string;
};

export type APIResponse<T = any> = {
  ok:    boolean;
  data?: T;
  error?: APIError;
};

async function fetchWithTimeout(url: string, timeout = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw { type: 'timeout', message: 'Bağlantı zaman aşımı' };
    throw { type: 'network', message: 'Ağ hatası' };
  }
}

export function createAPI(
  ip:              string,
  pin:             string,
  onUnauthorized?: () => void,
) {
  const buildURL = (
    path:     string,
    params?:  Record<string, string>,
    channel?: number
  ): string => {
    const allParams: Record<string, string> = { pin };
    if (channel !== undefined) allParams['channel'] = String(channel);
    if (params) Object.assign(allParams, params);
    const query = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `http://${ip}${path}?${query}`;
  };

  const request = async <T = any>(
    path:     string,
    params?:  Record<string, string>,
    channel?: number
  ): Promise<APIResponse<T>> => {
    const url = buildURL(path, params, channel);
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 403) {
        onUnauthorized?.();
        return { ok: false, error: { type: 'unauthorized', status: 403, message: 'PIN hatalı' } };
      }
      if (!res.ok) {
        return { ok: false, error: { type: 'server', status: res.status, message: `HTTP ${res.status}` } };
      }
      const text = await res.text();
      let data: T | undefined;
      try { data = JSON.parse(text) as T; } catch { data = text as unknown as T; }
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: { type: e.type ?? 'unknown', message: e.message ?? 'Bilinmeyen hata' } };
    }
  };

  return {
    // channel belirtilmezse kanal 0 varsayılır (tek kanallı geriye dönük uyumluluk)
    get: <T = any>(path: string, params?: Record<string, string>, channel?: number) =>
      request<T>(path, params, channel),
  };
}

export type API = ReturnType<typeof createAPI>;