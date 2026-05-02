/**
 * types/Device.ts
 * Uygulamada kullanılan temel cihaz veri modeli.
 */

export type Device = {
  id:         string;
  name:       string;
  ip:         string;
  addedAt:    number;
  brightness: number;  // 0-255, varsayılan 255
  color: {             // Son seçilen renk — kapalıyken de saklanır
    r: number;
    g: number;
    b: number;
  };
};