/**
 * hooks/useConnectionStatus.ts
 *
 * ESP32 bağlantı durumunu periyodik ping ile takip eder.
 *
 * IP Değişimi Desteği:
 * Cihaz offline görünmeye başladığında (3 ardışık başarısız ping),
 * aynı subnet'te yeni IP tarır. /whoami yanıtındaki 'parts' listesi
 * kayıtlı cihazla eşleşirse onIpChanged(newIp) callback'i tetiklenir.
 * App.tsx bu callback'te cihazı yeni IP ile günceller.
 *
 * AppState entegrasyonu:
 * - Arka plana geçince ping durur (pil/network tasarrufu)
 * - Ön plana dönünce anında ping + periyod yeniden başlar
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const PING_INTERVAL     = 5000;  // ms — normal ping aralığı
const PING_TIMEOUT      = 2000;  // ms — ping zaman aşımı
const OFFLINE_THRESHOLD = 3;     // ardışık başarısız ping → IP tarama başlar
const RESCAN_INTERVAL   = 20000; // ms — IP tarama aralığı (offline durumdayken)
const SCAN_TIMEOUT      = 1500;  // ms — tarama sırasında her IP için zaman aşımı

export type ConnectionStatus = 'checking' | 'online' | 'offline';

type Props = {
  ip:            string;
  deviceSerial?: string;   // v1.3.0+ — benzersiz seri no (öncelikli eşleştirme)
  deviceParts?:  string[]; // fallback — eski firmware'ler için parts eşleştirme
  onIpChanged?:  (newIp: string) => void;
};

export function useConnectionStatus({ ip, deviceSerial, deviceParts, onIpChanged }: Props) {
  const [status,  setStatus]  = useState<ConnectionStatus>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const rescanTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef      = useRef(true);
  const appStateRef     = useRef<AppStateStatus>(AppState.currentState);
  const failCountRef    = useRef(0);
  const scanningRef     = useRef(false);

  // ── Subnet'te yeni IP ara ──────────────────────────────────────────────────
  const scanForNewIp = useCallback(async () => {
    if (scanningRef.current || !onIpChanged) return;
    if (!deviceSerial && !deviceParts?.length) return;
    if (appStateRef.current !== 'active') return;
    scanningRef.current = true;

    try {
      // Mevcut IP'den subnet'i çıkar (örn. 192.168.1.x)
      const parts = ip.split('.');
      if (parts.length !== 4) return;
      const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;

      // 1-254 arası paralel tarama (batch'ler halinde — aşırı yük önleme)
      const BATCH_SIZE = 30;
      for (let start = 1; start <= 254; start += BATCH_SIZE) {
        if (!mountedRef.current || appStateRef.current !== 'active') break;

        const batch = Array.from(
          { length: Math.min(BATCH_SIZE, 255 - start) },
          (_, i) => start + i
        );

        const results = await Promise.allSettled(
          batch.map(async (n) => {
            const candidateIp = `${subnet}.${n}`;
            if (candidateIp === ip) return null; // eski IP'yi atla

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT);
            try {
              const res = await fetch(`http://${candidateIp}/whoami`, {
                signal: controller.signal,
              });
              clearTimeout(timer);
              if (!res.ok) return null;

              const data = await res.json();
              // Parts listesini karşılaştır
              // Eşleştirme: önce serial (v1.3.0+), yoksa parts listesi
              let isMatch = false;
              if (deviceSerial && data.serial) {
                // Serial varsa kesin eşleştirme — aynı parçalı iki cihaz sorunu çözülür
                isMatch = data.serial === deviceSerial;
              } else if (deviceParts?.length) {
                // Eski firmware fallback — parts listesiyle eşleştir
                const remoteParts: string[] = Array.isArray(data.parts) ? data.parts : [];
                isMatch =
                  remoteParts.length === deviceParts.length &&
                  remoteParts.every((p, i) => p === deviceParts[i]);
              }

              return isMatch ? candidateIp : null;
            } catch {
              clearTimeout(timer);
              return null;
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            // Yeni IP bulundu!
            if (mountedRef.current) {
              onIpChanged(result.value);
            }
            scanningRef.current = false;
            return;
          }
        }
      }
    } catch {
      // Tarama hatası — sessizce geç
    } finally {
      scanningRef.current = false;
    }
  }, [ip, deviceSerial, deviceParts, onIpChanged]);

  // ── Ping ──────────────────────────────────────────────────────────────────
  const ping = useCallback(async () => {
    if (appStateRef.current !== 'active') return;

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);
      const res = await fetch(`http://${ip}/whoami`, { signal: controller.signal });
      clearTimeout(timer);

      if (!mountedRef.current) return;

      if (res.ok) {
        failCountRef.current = 0;
        // Aktif rescan varsa iptal et
        if (rescanTimerRef.current) {
          clearTimeout(rescanTimerRef.current);
          rescanTimerRef.current = null;
        }
        setStatus('online');
        setLatency(Date.now() - start);
      } else {
        handleFailure();
      }
    } catch {
      if (!mountedRef.current) return;
      handleFailure();
    }
  }, [ip]); // eslint-disable-line

  const handleFailure = useCallback(() => {
    failCountRef.current += 1;
    setStatus('offline');
    setLatency(null);

    // Belirli sayıda başarısız ping sonrası IP taramasını başlat
    if (
      failCountRef.current >= OFFLINE_THRESHOLD &&
      !rescanTimerRef.current &&
      (deviceSerial || deviceParts?.length) &&
      onIpChanged
    ) {
      // Hemen bir tarama yap, sonra RESCAN_INTERVAL'da tekrarla
      scanForNewIp();
      rescanTimerRef.current = setInterval(scanForNewIp, RESCAN_INTERVAL) as any;
    }
  }, [deviceParts, onIpChanged, scanForNewIp]);

  // ── Periyodik ping ────────────────────────────────────────────────────────
  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(ping, PING_INTERVAL);
  }, [ping]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopRescan = useCallback(() => {
    if (rescanTimerRef.current) {
      clearInterval(rescanTimerRef.current);
      rescanTimerRef.current = null;
    }
    scanningRef.current = false;
    failCountRef.current = 0;
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    setStatus('checking');
    setLatency(null);
    failCountRef.current = 0;
    stopRescan();

    ping();
    startInterval();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        if (mountedRef.current) {
          setStatus('checking');
          ping();
          startInterval();
        }
      } else {
        stopInterval();
        stopRescan();
      }
    });

    return () => {
      mountedRef.current = false;
      stopInterval();
      stopRescan();
      subscription.remove();
    };
  }, [ip, ping, startInterval, stopInterval, stopRescan]);

  return { status, latency };
}