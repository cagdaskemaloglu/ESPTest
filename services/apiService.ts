/**
 * services/apiService.ts
 * Tüm ESP32 HTTP isteklerini yöneten merkezi servis.
 *
 * Her isteğe PIN otomatik eklenir — uygulama kodu doğrudan fetch kullanmaz.
 * PIN yanlışsa (403) onUnauthorized callback tetiklenir → UI PIN ekranı açar.
 *
 * Kullanım:
 *   const api = createAPI(device.ip, device.pin, () => setShowPinScreen(true));
 *   await api.get('/led/on');
 *   await api.get('/led/brightness', { value: '128' });
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

// Timeout destekli fetch
async function fetchWithTimeout(
  url: string,
  timeout = TIMEOUT_MS
): Promise<Response> {
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

// API instance oluştur
export function createAPI(
  ip:             string,
  pin:            string,
  onUnauthorized?: () => void,  // 403 gelince çağrılır
) {
  // URL'ye PIN ekle
  const buildURL = (path: string, params?: Record<string, string>): string => {
    const allParams = { pin, ...params };
    const query     = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `http://${ip}${path}?${query}`;
  };

  const request = async <T = any>(
    path:    string,
    params?: Record<string, string>
  ): Promise<APIResponse<T>> => {
    const url = buildURL(path, params);

    try {
      const res = await fetchWithTimeout(url);

      // 403 → PIN yanlış
      if (res.status === 403) {
        onUnauthorized?.();
        return {
          ok: false,
          error: { type: 'unauthorized', status: 403, message: 'PIN hatalı veya eksik' },
        };
      }

      // Diğer HTTP hataları
      if (!res.ok) {
        return {
          ok: false,
          error: { type: 'server', status: res.status, message: `Sunucu hatası: ${res.status}` },
        };
      }

      // JSON veya text parse
      const text = await res.text();
      let data: T | undefined;
      try { data = JSON.parse(text) as T; }
      catch { data = text as unknown as T; }

      return { ok: true, data };

    } catch (e: any) {
      return {
        ok: false,
        error: {
          type:    e.type ?? 'unknown',
          message: e.message ?? 'Bilinmeyen hata',
        },
      };
    }
  };

  return {
    get: <T = any>(path: string, params?: Record<string, string>) =>
      request<T>(path, params),
  };
}

// Tip kısayolu
export type API = ReturnType<typeof createAPI>;
