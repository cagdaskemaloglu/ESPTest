# Gizlilik Politikası — Ambience Bureau

**Son güncelleme:** Haziran 2026

Ambience Bureau ("Uygulama"), ESP32 tabanlı akıllı LED cihazlarınızı yerel Wi-Fi ağınız üzerinden kontrol etmenizi sağlayan bir mobil uygulamadır. Bu belge, Uygulamanın hangi verileri nasıl işlediğini açıklar.

## Temel İlke

Ambience Bureau, herhangi bir uzak sunucuya veri göndermez. Tüm cihaz bilgileri, ayarlar ve tercihler yalnızca telefonunuzun yerel depolama alanında saklanır. Uygulama, ESP32 cihazlarınızla doğrudan ve yalnızca aynı yerel ağ (ev Wi-Fi'ınız) üzerinden iletişim kurar.

## Topladığımız ve İşlediğimiz Veriler

**Cihaz bilgileri (yerel depolama):** Eklediğiniz ESP32 cihazlarının adı, IP adresi, PIN kodu (varsa) ve renk/parlaklık tercihleri telefonunuzda (AsyncStorage) saklanır. Bu bilgiler hiçbir sunucuya iletilmez.

**Dil tercihi:** Seçtiğiniz uygulama dili (Türkçe/İngilizce) yerel olarak saklanır.

**Otomasyon kuralları:** Oluşturduğunuz zamanlayıcı ve otomasyon kuralları hem telefonunuzda hem de ilgili ESP32 cihazının kendi belleğinde saklanır.

## İstenen İzinler ve Nedenleri

**Yerel ağ erişimi:** ESP32 cihazlarınızı ağınızda bulabilmek ve onlarla iletişim kurabilmek için gereklidir.

**Konum izni (yalnızca Android):** Android işletim sistemi, Wi-Fi ağ taraması yapabilmek için konum izni zorunlu kılar. Uygulama, konumunuzu kaydetmez veya başka bir amaçla kullanmaz; bu izin yalnızca Android'in teknik bir gereksinimidir.

**Bildirimler:** Oluşturduğunuz zamanlayıcı/otomasyon kurallarının size hatırlatılması için kullanılır. Tüm bildirimler cihazınızda yerel olarak planlanır.

## Üçüncü Taraflarla Veri Paylaşımı

Uygulama, hiçbir kullanıcı verisini üçüncü taraflarla paylaşmaz, satmaz veya reklam amacıyla kullanmaz. Uygulama içinde reklam bulunmaz.

## Firmware Güncellemeleri (OTA)

Cihazınızın firmware güncellemesini kontrol ederken Uygulama, güncel sürüm bilgisini almak için GitHub üzerinde barındırılan herkese açık bir dosyaya erişir. Bu istek sırasında kişisel veri gönderilmez.

## Verilerin Silinmesi

Bir cihazı listeden kaldırdığınızda veya uygulamayı sildiğinizde, telefonunuzda saklanan tüm ilgili veriler silinir. ESP32 cihazınızı fabrika ayarlarına sıfırlayarak cihaz üzerindeki tüm verileri de temizleyebilirsiniz.

## İletişim

Bu gizlilik politikası hakkında sorularınız için bizimle iletişime geçebilirsiniz.

## Değişiklikler

Bu politika güncellenirse, değişiklik tarihi yukarıda belirtilen "Son güncelleme" alanından takip edilebilir.