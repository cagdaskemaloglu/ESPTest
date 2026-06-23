/**
 * types/Group.ts
 *
 * Cihaz grubu — birden fazla ESP32'yi tek komutla kontrol etmek için.
 *
 * Bir grup en az 1 cihaz içerebilir. Komutlar paralel olarak gönderilir
 * (Promise.allSettled), bir cihazın offline olması diğerlerini etkilemez.
 */

export type Group = {
  id:        string;   // uuid benzeri benzersiz id
  name:      string;   // kullanıcı adı — örn. "Salon"
  icon:      string;   // emoji ikon — örn. "🛋️"
  deviceIds: string[]; // Device.id listesi
  createdAt: number;   // Date.now()
};

// Gruba komut gönderme sonucu — hangi cihaz başarılı/başarısız
export type GroupCommandResult = {
  deviceId: string;
  success:  boolean;
  error?:   string;
};
