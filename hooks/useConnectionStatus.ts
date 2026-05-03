/**
 * hooks/useConnectionStatus.ts
 * ESP32 bağlantı durumunu periyodik ping ile takip eden hook.
 *
 * Her PING_INTERVAL ms'de bir /whoami endpoint'ine istek atar.
 * Yanıt gelirse 'online', gelmezse 'offline', ilk kontrol öncesi 'checking'.
 *
 * Kullanım:
 *   const { status, latency } = useConnectionStatus(device.ip);
 *   // status: 'checking' | 'online' | 'offline'
 *   // latency: ms cinsinden yanıt süresi (sadece online iken)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const PING_INTERVAL = 5000;  // 5 saniyede bir ping
const PING_TIMEOUT  = 2000;  // 2 saniye içinde yanıt gelmezse offline

export type ConnectionStatus = 'checking' | 'online' | 'offline';

export function useConnectionStatus(ip: string) {
  const [status,  setStatus]  = useState<ConnectionStatus>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(true);

  const ping = useCallback(async () => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);

      const res = await fetch(`http://${ip}/whoami`, { signal: controller.signal });
      clearTimeout(timer);

      if (!mountedRef.current) return;

      if (res.ok) {
        const ms = Date.now() - start;
        setStatus('online');
        setLatency(ms);
      } else {
        setStatus('offline');
        setLatency(null);
      }
    } catch {
      if (!mountedRef.current) return;
      setStatus('offline');
      setLatency(null);
    }
  }, [ip]);

  useEffect(() => {
    mountedRef.current = true;
    setStatus('checking');
    setLatency(null);

    // İlk ping hemen
    ping();

    // Sonraki pingler periyodik
    intervalRef.current = setInterval(ping, PING_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ip, ping]);

  return { status, latency };
}
