/**
 * types/Device.ts
 * Uygulamada kullanılan temel cihaz veri modeli.
 */

export type Device = {
  id:         string;  // Benzersiz kimlik
  name:       string;  // Kullanıcının verdiği isim
  ip:         string;  // ESP32'nin yerel ağ IP'si
  addedAt:    number;  // Eklenme zamanı — Unix timestamp
  brightness: number;  // Son kaydedilen parlaklık (0-255). Varsayılan: 255
};