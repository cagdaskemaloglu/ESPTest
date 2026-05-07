/**
 * services/automationService.ts
 * ESP32 automation endpoint'leriyle iletişim.
 *
 * Her kural için:
 *   - ESP32'ye kural gönderilir
 *   - Telefona scheduled notification planlanır
 *   - notificationId saklanır — kural silinince notification da iptal edilir
 */

import { cancelNotification, scheduleDaily, scheduleOnce } from './notificationService';

export type RuleType   = 0 | 1;
export type RuleAction = 0 | 1;

export type AutomationRule = {
  id:              string;
  active:          boolean;
  type:            RuleType;
  hour:            number;
  minute:          number;
  action:          RuleAction;
  triggerAt:       number;
  // Telefon tarafında saklanan notification ID
  // ESP32 bunu bilmez — sadece AsyncStorage'da tutulur
  notificationId?: string;
};

export type AddDailyParams = {
  hour:       number;
  minute:     number;
  action:     RuleAction;
  deviceName: string;
};

export type AddCountdownParams = {
  countdown:  number;    // Saniye cinsinden
  action:     RuleAction;
  deviceName: string;
};

export type ESP32Time = {
  hour:   number;
  minute: number;
  second: number;
  unix:   number;
};

// ── API fonksiyonları ─────────────────────────────────────────────────────────

export async function listRules(ip: string): Promise<AutomationRule[]> {
  try {
    const res  = await fetch(`http://${ip}/automation/list`);
    const data = await res.json();
    return data as AutomationRule[];
  } catch (e) {
    console.error('listRules hata:', e);
    return [];
  }
}

// Günlük kural ekle + telefona bildirim planla
export async function addDailyRule(
  ip: string,
  params: AddDailyParams
): Promise<{ id: string; notificationId?: string } | null> {
  try {
    // ESP32'ye kural gönder
    const url = `http://${ip}/automation/add?type=0&hour=${params.hour}&minute=${params.minute}&action=${params.action}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.id) return null;

    // Telefona günlük bildirim planla
    const notificationId = await scheduleDaily({
      hour:       params.hour,
      minute:     params.minute,
      action:     params.action,
      deviceName: params.deviceName,
    });

    return { id: data.id, notificationId: notificationId ?? undefined };
  } catch (e) {
    console.error('addDailyRule hata:', e);
    return null;
  }
}

// Countdown kuralı ekle + telefona bildirim planla
export async function addCountdownRule(
  ip: string,
  params: AddCountdownParams
): Promise<{ id: string; notificationId?: string } | null> {
  try {
    const url  = `http://${ip}/automation/add?type=1&countdown=${params.countdown}&action=${params.action}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.id) return null;

    // Tetiklenme zamanı = şu an + countdown saniyesi
    const triggerAt = Math.floor(Date.now() / 1000) + params.countdown;

    const notificationId = await scheduleOnce({
      triggerAt,
      action:     params.action,
      deviceName: params.deviceName,
    });

    return { id: data.id, notificationId: notificationId ?? undefined };
  } catch (e) {
    console.error('addCountdownRule hata:', e);
    return null;
  }
}

// Kural sil + notification iptal et
export async function deleteRule(
  ip: string,
  id: string,
  notificationId?: string
): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}/automation/delete?id=${id}`);

    // Notification varsa iptal et
    if (notificationId) {
      await cancelNotification(notificationId);
    }

    return res.ok;
  } catch (e) {
    console.error('deleteRule hata:', e);
    return false;
  }
}

// Toggle — notification'ı etkilemez (aktif/pasif durum ESP32'de)
export async function toggleRule(
  ip: string,
  id: string
): Promise<{ active: boolean } | null> {
  try {
    const res  = await fetch(`http://${ip}/automation/toggle?id=${id}`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('toggleRule hata:', e);
    return null;
  }
}

export async function getESP32Time(ip: string): Promise<ESP32Time | null> {
  try {
    const res  = await fetch(`http://${ip}/automation/time`);
    const data = await res.json();
    return data as ESP32Time;
  } catch (e) {
    console.error('getESP32Time hata:', e);
    return null;
  }
}

// Kural için okunabilir açıklama
export function ruleDescription(rule: AutomationRule): string {
  const actionLabel = rule.action === 1 ? 'aç' : 'kapat';

  if (rule.type === 0) {
    const h = String(rule.hour).padStart(2, '0');
    const m = String(rule.minute).padStart(2, '0');
    return `Her gün ${h}:${m}'de ${actionLabel}`;
  } else {
    const remaining = rule.triggerAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0 || !rule.active) return `Tek seferlik — ${actionLabel} (tamamlandı)`;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return mins > 0
      ? `${mins} dk ${secs} sn sonra ${actionLabel}`
      : `${secs} sn sonra ${actionLabel}`;
  }
}