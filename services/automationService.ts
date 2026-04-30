/**
 * services/automationService.ts
 * ESP32'nin automation endpoint'leriyle iletişim kurar.
 * Tüm fonksiyonlar async/await ile çalışır.
 */

// ── Tipler ───────────────────────────────────────────────────────────────────

export type RuleType   = 0 | 1;  // 0 = günlük, 1 = tek seferlik countdown
export type RuleAction = 0 | 1;  // 0 = kapat, 1 = aç

export type AutomationRule = {
  id:         string;      // ESP32'den gelen 8 karakter ID
  active:     boolean;
  type:       RuleType;
  hour:       number;      // type=0 için (0-23)
  minute:     number;      // type=0 için (0-59)
  action:     RuleAction;
  triggerAt:  number;      // type=1 için Unix timestamp
};

export type AddDailyParams = {
  hour:   number;
  minute: number;
  action: RuleAction;
};

export type AddCountdownParams = {
  countdown: number;   // Saniye cinsinden (örn. 1800 = 30 dakika)
  action:    RuleAction;
};

export type ESP32Time = {
  hour:   number;
  minute: number;
  second: number;
  unix:   number;
};

// ── API fonksiyonları ─────────────────────────────────────────────────────────

// Tüm kuralları listele
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

// Günlük zamanlayıcı ekle (her gün saat X:XX'de tetiklenir)
export async function addDailyRule(
  ip: string,
  params: AddDailyParams
): Promise<{ id: string } | null> {
  try {
    const url = `http://${ip}/automation/add?type=0&hour=${params.hour}&minute=${params.minute}&action=${params.action}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('addDailyRule hata:', e);
    return null;
  }
}

// Tek seferlik countdown ekle (X saniye sonra tetiklenir)
export async function addCountdownRule(
  ip: string,
  params: AddCountdownParams
): Promise<{ id: string } | null> {
  try {
    const url = `http://${ip}/automation/add?type=1&countdown=${params.countdown}&action=${params.action}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('addCountdownRule hata:', e);
    return null;
  }
}

// Kural sil
export async function deleteRule(ip: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}/automation/delete?id=${id}`);
    return res.ok;
  } catch (e) {
    console.error('deleteRule hata:', e);
    return false;
  }
}

// Kural aktif/pasif toggle
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

// ESP32'nin mevcut saatini al (NTP doğrulama için)
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

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

// Kural için okunabilir açıklama üretir
// Örn: "Her gün 22:00'de kapat" veya "30 dakika sonra aç"
export function ruleDescription(rule: AutomationRule): string {
  const actionLabel = rule.action === 1 ? 'aç' : 'kapat';

  if (rule.type === 0) {
    const h = String(rule.hour).padStart(2, '0');
    const m = String(rule.minute).padStart(2, '0');
    return `Her gün ${h}:${m}'de ${actionLabel}`;
  } else {
    // Countdown: triggerAt ile şimdiki zaman farkını göster
    const remaining = rule.triggerAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0 || !rule.active) return `Tek seferlik — ${actionLabel} (tamamlandı)`;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return mins > 0
      ? `${mins} dk ${secs} sn sonra ${actionLabel}`
      : `${secs} sn sonra ${actionLabel}`;
  }
}
