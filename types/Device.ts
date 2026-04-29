/**
 * types/Device.ts
 * Uygulamada kullanılan temel cihaz veri modeli.
 * Tüm ekranlar ve servisler bu tipi kullanır.
 */

export type Device = {
  id:        string;  // Benzersiz kimlik — UUID formatında (örn. "a1b2-c3d4")
  name:      string;  // Kullanıcının verdiği isim (örn. "Salon Lambası")
  ip:        string;  // ESP32'nin yerel ağ IP'si (örn. "192.168.1.35")
  addedAt:   number;  // Eklenme zamanı — Date.now() ile Unix timestamp
};
