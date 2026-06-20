/**
 * services/automationService.ts
 * ESP32 automation endpoint'leriyle iletişim.
 * PIN ve channel parametreleri otomatik eklenir.
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
  triggered:       boolean;
  channel:         number;
  notificationId?: string;
};

export type AddDailyParams = {
  hour:       number;
  minute:     number;
  action:     RuleAction;
  deviceName: string;
  pin:        string;
  channel:    number;
};

export type AddCountdownParams = {
  countdown:  number;
  action:     RuleAction;
  deviceName: string;
  pin:        string;
  channel:    number;
};

export type ESP32Time = {
  hour:   number;
  minute: number;
  second: number;
  unix:   number;
};

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function buildUrl(ip: string, path: string, params: Record<string, string | number>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `http://${ip}${path}${query ? '?' + query : ''}`;
}

// ── API fonksiyonları ─────────────────────────────────────────────────────────

export async function listRules(
  ip:      string,
  pin:     string,
  channel: number,
): Promise<AutomationRule[]> {
  try {
    const url = buildUrl(ip, '/automation/list', { pin, channel });
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data as AutomationRule[];
  } catch (e) {
    console.error('listRules hata:', e);
    return [];
  }
}

export async function addDailyRule(
  ip:     string,
  params: AddDailyParams,
): Promise<{ id: string; notificationId?: string } | null> {
  try {
    const url = buildUrl(ip, '/automation/add', {
      type:    0,
      hour:    params.hour,
      minute:  params.minute,
      action:  params.action,
      channel: params.channel,
      pin:     params.pin,
    });
    const res  = await fetch(url);
    if (!res.ok) { console.error('addDailyRule HTTP:', res.status); return null; }
    const data = await res.json();
    if (!data.id) return null;

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

export async function addCountdownRule(
  ip:     string,
  params: AddCountdownParams,
): Promise<{ id: string; notificationId?: string } | null> {
  try {
    const url = buildUrl(ip, '/automation/add', {
      type:      1,
      countdown: params.countdown,
      action:    params.action,
      channel:   params.channel,
      pin:       params.pin,
    });
    const res  = await fetch(url);
    if (!res.ok) { console.error('addCountdownRule HTTP:', res.status); return null; }
    const data = await res.json();
    if (!data.id) return null;

    const triggerAt      = Math.floor(Date.now() / 1000) + params.countdown;
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

export async function deleteRule(
  ip:              string,
  id:              string,
  pin:             string,
  notificationId?: string,
): Promise<boolean> {
  try {
    const url = buildUrl(ip, '/automation/delete', { id, pin });
    const res = await fetch(url);
    if (notificationId) await cancelNotification(notificationId);
    return res.ok;
  } catch (e) {
    console.error('deleteRule hata:', e);
    return false;
  }
}

export async function toggleRule(
  ip:  string,
  id:  string,
  pin: string,
): Promise<{ active: boolean } | null> {
  try {
    const url  = buildUrl(ip, '/automation/toggle', { id, pin });
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('toggleRule hata:', e);
    return null;
  }
}

export async function getESP32Time(
  ip:  string,
  pin: string,
): Promise<ESP32Time | null> {
  try {
    const url  = buildUrl(ip, '/automation/time', { pin });
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data as ESP32Time;
  } catch (e) {
    console.error('getESP32Time hata:', e);
    return null;
  }
}

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
    return mins > 0 ? `${mins} dk ${secs} sn sonra ${actionLabel}` : `${secs} sn sonra ${actionLabel}`;
  }
}

// ── Uyku Modu (Fade) ──────────────────────────────────────────────────────────

export type FadeState = {
  active:     boolean;
  remaining?: number;  // saniye
  progress?:  number;  // 0-100
  current?:   number;  // mevcut parlaklık
};

export async function startFade(
  ip:       string,
  pin:      string,
  duration: number,
  target:   number = 0,
): Promise<boolean> {
  try {
    const url = buildUrl(ip, '/led/fade', { pin, duration, target });
    console.log('startFade URL:', url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log('startFade status:', res.status, res.ok);
    return res.ok;
  } catch (e) {
    console.error('startFade hata:', e);
    return false;
  }
}

export async function cancelFade(ip: string, pin: string): Promise<boolean> {
  try {
    const url = buildUrl(ip, '/led/fade', { pin, duration: '1', cancel: '1' });
    const res = await fetch(url);
    return res.ok;
  } catch (e) {
    console.error('cancelFade hata:', e);
    return false;
  }
}

export async function getFadeState(ip: string, pin: string): Promise<FadeState | null> {
  try {
    const url = buildUrl(ip, '/led/fade/state', { pin });
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as FadeState;
  } catch (e) {
    console.error('getFadeState hata:', e);
    return null;
  }
}