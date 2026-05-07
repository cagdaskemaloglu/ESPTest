/**
 * services/notificationService.ts
 * Expo Notifications ile local scheduled bildirim yönetimi.
 *
 * Kurulum:
 *   npx expo install expo-notifications expo-device
 *
 * app.json / app.config.js'e ekle:
 *   {
 *     "expo": {
 *       "plugins": [
 *         [
 *           "expo-notifications",
 *           {
 *             "icon": "./assets/notification-icon.png",
 *             "color": "#00d4ff"
 *           }
 *         ]
 *       ]
 *     }
 *   }
 *
 * Bildirim tipleri:
 *   - Günlük (daily)     : Her gün belirli saatte tekrar eder
 *   - Tek seferlik (once): Belirli zaman damgasında bir kez tetiklenir
 *
 * Her automation kuralının bir notification ID'si olur.
 * Kural silinince notification da iptal edilir.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Bildirimlerin nasıl gösterileceği — uygulama açıkken de banner çıkar
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,   // Eski: shouldShowAlert
    shouldShowList:   true,   // Bildirim merkezinde göster
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ── İzin iste ────────────────────────────────────────────────────────────────
// Uygulama başlangıcında bir kez çağrılmalı.
// Simülatörde bildirim çalışmaz — gerçek cihaz gerekir.
export async function requestNotificationPermission(): Promise<boolean> {
  // Simülatörde izin isteme (çalışmaz, hata verir)
  if (!Device.isDevice) {
    console.log('Bildirimler sadece gerçek cihazda çalışır');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Bildirim izni verilmedi');
    return false;
  }

  // Android için bildirim kanalı oluştur
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('automation', {
      name:       'Otomasyon Bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      sound:      'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

// ── Günlük zamanlayıcı bildirimi ──────────────────────────────────────────────
// Her gün belirli saatte tekrar eden bildirim.
// Döndürdüğü string → notification identifier (iptal için sakla)
export async function scheduleDaily(params: {
  hour:        number;
  minute:      number;
  action:      0 | 1;    // 0 = kapat, 1 = aç
  deviceName:  string;
}): Promise<string | null> {
  const { hour, minute, action, deviceName } = params;

  const actionLabel = action === 1 ? 'açıldı' : 'kapandı';
  const verb        = action === 1 ? 'Açılıyor' : 'Kapanıyor';

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💡 ${deviceName} ${actionLabel}`,
        body:  `Otomasyon kuralı: ${deviceName} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}'de ${verb}.`,
        sound: 'default',
        data:  { type: 'automation', action, deviceName },
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        // DAILY trigger zaten her gün tekrar eder — repeats alanı bu tipte yok
      },
    });
    console.log(`📅 Günlük bildirim planlandı: ${hour}:${minute} → ${id}`);
    return id;
  } catch (e) {
    console.error('scheduleDaily hata:', e);
    return null;
  }
}

// ── Tek seferlik bildirim ────────────────────────────────────────────────────
// Belirli bir Unix timestamp'te bir kez tetiklenir.
export async function scheduleOnce(params: {
  triggerAt:   number;   // Unix timestamp (saniye)
  action:      0 | 1;
  deviceName:  string;
}): Promise<string | null> {
  const { triggerAt, action, deviceName } = params;

  const actionLabel = action === 1 ? 'açıldı' : 'kapandı';

  // Geçmiş bir zaman için bildirim planlanmaz
  const now = Math.floor(Date.now() / 1000);
  if (triggerAt <= now) {
    console.log('Geçmiş zaman için bildirim planlanamaz');
    return null;
  }

  // Kalan süreyi hesapla (kullanıcıya göstermek için)
  const remaining = triggerAt - now;
  const mins      = Math.floor(remaining / 60);
  const body      = mins > 0
    ? `${mins} dakika sonra ${deviceName} ${actionLabel}.`
    : `Az sonra ${deviceName} ${actionLabel}.`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💡 ${deviceName} ${actionLabel}`,
        body,
        sound: 'default',
        data:  { type: 'automation', action, deviceName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAt * 1000),
      },
    });
    console.log(`⏱ Tek seferlik bildirim planlandı: ${new Date(triggerAt * 1000).toLocaleString()} → ${id}`);
    return id;
  } catch (e) {
    console.error('scheduleOnce hata:', e);
    return null;
  }
}

// ── Bildirim iptal et ────────────────────────────────────────────────────────
// Kural silinince çağrılır — bildirimin de gelmemesi sağlanır
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`🗑 Bildirim iptal edildi: ${notificationId}`);
  } catch (e) {
    console.error('cancelNotification hata:', e);
  }
}

// ── Tüm bildirimleri iptal et ────────────────────────────────────────────────
// Factory reset veya uygulama sıfırlanınca kullanılır
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑 Tüm bildirimler iptal edildi');
  } catch (e) {
    console.error('cancelAllNotifications hata:', e);
  }
}

// ── Planlanmış bildirimleri listele (debug için) ─────────────────────────────
export async function listScheduledNotifications() {
  const list = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`📋 ${list.length} bildirim planlanmış:`);
  list.forEach((n) => console.log(' -', n.identifier, n.content.title));
  return list;
}