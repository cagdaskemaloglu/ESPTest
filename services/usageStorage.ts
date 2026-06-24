/**
 * services/usageStorage.ts
 *
 * Cihaz açma/kapama eventlerini kaydeder ve istatistik hesaplar.
 *
 * Veri yapısı: cihaz başına ayrı AsyncStorage key'i.
 * Her event: { ts: number (unix ms), isOn: boolean }
 *
 * Otomatik temizleme: 30 günden eski eventler silinir.
 * Bu sayede storage sonsuz büyümez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX      = 'ambience_usage_';
const MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000; // 30 gün
const MAX_EVENTS  = 500;                        // cihaz başına max event

export type UsageEvent = {
  ts:   number;  // Date.now()
  isOn: boolean;
};

export type DailyStat = {
  date:          string;  // 'YYYY-MM-DD'
  hoursOn:       number;  // ondalık — örn. 1.5 = 1.5 saat
  toggleCount:   number;
};

// ── Storage yardımcıları ──────────────────────────────────────────────────────

function key(deviceId: string): string {
  return `${PREFIX}${deviceId}`;
}

async function loadEvents(deviceId: string): Promise<UsageEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(key(deviceId));
    if (!raw) return [];
    return JSON.parse(raw) as UsageEvent[];
  } catch {
    return [];
  }
}

async function saveEvents(deviceId: string, events: UsageEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(deviceId), JSON.stringify(events));
  } catch (e) {
    console.error('usageStorage saveEvents hata:', e);
  }
}

// ── Dışa açık fonksiyonlar ────────────────────────────────────────────────────

/**
 * Bir açma/kapama eventi kaydeder.
 * ControlScreen'de toggle() her çağrıldığında burası tetiklenir.
 */
export async function recordToggle(deviceId: string, isOn: boolean): Promise<void> {
  const now    = Date.now();
  const cutoff = now - MAX_AGE_MS;
  let events   = await loadEvents(deviceId);

  // Eski eventleri temizle
  events = events.filter((e) => e.ts > cutoff);

  // Yeni eventi ekle
  events.push({ ts: now, isOn });

  // Max limitini aş
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);

  await saveEvents(deviceId, events);
}

/**
 * Son N gün için günlük istatistik döner.
 * Her gün için: toplam açık kalma süresi (saat) ve toggle sayısı.
 */
export async function getDailyStats(deviceId: string, days = 7): Promise<DailyStat[]> {
  const events  = await loadEvents(deviceId);
  const now     = Date.now();
  const result: DailyStat[] = [];

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - d);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dateStr = dayStart.toISOString().slice(0, 10);

    // O güne ait eventler
    const dayEvents = events.filter(
      (e) => e.ts >= dayStart.getTime() && e.ts < dayEnd.getTime()
    );

    // O günden önceki son event (gece yarısında ışık açık mıydı?)
    const lastBefore = [...events]
      .filter((e) => e.ts < dayStart.getTime())
      .sort((a, b) => b.ts - a.ts)[0];

    // Açık kalma süresini hesapla
    let hoursOn    = 0;
    let toggleCount = dayEvents.length;
    let currentOn  = lastBefore?.isOn ?? false;
    let openStart  = currentOn ? dayStart.getTime() : null;

    for (const event of dayEvents.sort((a, b) => a.ts - b.ts)) {
      if (event.isOn && !currentOn) {
        // Açıldı
        openStart  = event.ts;
        currentOn  = true;
      } else if (!event.isOn && currentOn && openStart !== null) {
        // Kapandı
        hoursOn  += (event.ts - openStart) / 3_600_000;
        openStart = null;
        currentOn = false;
      }
    }

    // Gün biterken hâlâ açıksa
    if (currentOn && openStart !== null) {
      const closingTime = Math.min(dayEnd.getTime(), now);
      hoursOn += (closingTime - openStart) / 3_600_000;
    }

    result.push({
      date:        dateStr,
      hoursOn:     Math.round(hoursOn * 10) / 10, // 1 ondalık
      toggleCount,
    });
  }

  return result;
}

/**
 * Birden fazla cihazın istatistiklerini birleştirir.
 * "Tüm cihazlar" görünümü için kullanılır.
 */
export async function getCombinedStats(deviceIds: string[], days = 7): Promise<DailyStat[]> {
  const allStats = await Promise.all(deviceIds.map((id) => getDailyStats(id, days)));

  // Her gün için topla
  const combined: Record<string, DailyStat> = {};
  for (const stats of allStats) {
    for (const stat of stats) {
      if (!combined[stat.date]) {
        combined[stat.date] = { date: stat.date, hoursOn: 0, toggleCount: 0 };
      }
      combined[stat.date].hoursOn      += stat.hoursOn;
      combined[stat.date].toggleCount  += stat.toggleCount;
    }
  }

  return Object.values(combined).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Bir cihazın tüm istatistik verilerini siler.
 */
export async function clearStats(deviceId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(deviceId));
  } catch (e) {
    console.error('clearStats hata:', e);
  }
}

/**
 * Birden fazla cihazın istatistiklerini temizler.
 */
export async function clearAllStats(deviceIds: string[]): Promise<void> {
  await Promise.all(deviceIds.map(clearStats));
}