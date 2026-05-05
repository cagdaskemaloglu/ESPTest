#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>
#include <FastLED.h>

WebServer server(80);
Preferences prefs;

String ssid     = "";
String password = "";

// ── WS2812B ──────────────────────────────────────────────────────────────────
#define LED_PIN   2
#define NUM_LEDS  30

CRGB leds[NUM_LEDS];
int     currentBrightness = 255;
uint8_t currentR = 255, currentG = 255, currentB = 255;
bool    ledIsOn  = false;

// ── Fiziksel reset butonu ─────────────────────────────────────────────────────
// GPIO 0 = BOOT butonu (çoğu ESP32 kartında zaten mevcut)
// Alternatif: GPIO 34 veya 35 (input-only, harici buton için ideal)
//
// Bağlantı şeması:
//   Buton bir ucu → GPIO_RESET_PIN
//   Buton diğer ucu → GND
//   INPUT_PULLUP kullanıldığı için harici direnç gerekmez.
//   Buton basılınca pin LOW olur (aktif-low mantığı).
//
// Davranış:
//   RESET_HOLD_MS (3000ms) boyunca basılı tutulursa fabrika sıfırlama yapılır.
//   Böylece kısa kazara basışlar sıfırlamayı tetiklemez.
//
// LED geri bildirimi:
//   0-1 sn  : normal
//   1-2 sn  : sarı yanıp söner (uyarı)
//   2-3 sn  : kırmızı yanıp söner (sıfırlama yaklaşıyor)
//   3+ sn   : tüm LED'ler kırmızı → sıfırlama yapılıyor → restart
#define GPIO_RESET_PIN  0        // BOOT butonu — değiştirmek için buraya yaz
#define RESET_HOLD_MS   3000     // Kaç ms basılı tutulunca sıfırlanır

unsigned long resetPressStart = 0; // Butonun basılmaya başladığı zaman
bool          resetArmed      = false; // Buton basılı mı?

// ── Efekt sistemi ─────────────────────────────────────────────────────────────
String   activeEffect = "off";
uint8_t  effectR = 0, effectG = 150, effectB = 255;
uint8_t  effectSpeed = 128;

unsigned long lastEffectMs = 0;
uint16_t effectStep = 0;

CRGB    meteorTrail[NUM_LEDS];
uint8_t twinkleBri[NUM_LEDS];

// ── Automation ───────────────────────────────────────────────────────────────
#define MAX_RULES 10

struct AutomationRule {
  char  id[9];
  bool  active;
  int   type;
  int   hour, minute, action;
  long  triggerAt;
  bool  triggered;
};

AutomationRule rules[MAX_RULES];
int ruleCount = 0;

// ── Yardımcılar ───────────────────────────────────────────────────────────────
void applyCurrentColor() {
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(currentR, currentG, currentB);
  FastLED.setBrightness(currentBrightness);
  FastLED.show();
}

void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

unsigned long speedToMs(uint8_t speed) {
  return map(speed, 0, 255, 100, 5);
}

// ── Fabrika sıfırlama işlemi ─────────────────────────────────────────────────
// WiFi kimlik bilgilerini ve automation kurallarını siler.
// Sonrasında ESP32 restart edilir → AP moduna (ESP32-Setup) geçer.
void factoryReset() {
  Serial.println("⚠️  FABRIKA SIFIRLAMASI BAŞLIYOR...");

  // Tüm LED'leri kırmızı yap — görsel geri bildirim
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0);
  FastLED.show();
  delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  delay(200);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0);
  FastLED.show();
  delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();

  // WiFi kimlik bilgilerini sil
  prefs.begin("wifi", false);
  prefs.clear();
  prefs.end();
  Serial.println("✅ WiFi bilgileri silindi");

  // Automation kurallarını sil
  prefs.begin("automation", false);
  prefs.clear();
  prefs.end();
  Serial.println("✅ Automation kuralları silindi");

  delay(500);

  // Restart → setup() içinde ssid == "" olacak → AP modu başlayacak
  Serial.println("🔄 Yeniden başlatılıyor...");
  ESP.restart();
}

// ── Fiziksel buton kontrolü ──────────────────────────────────────────────────
// loop() içinde her iterasyonda çağrılır.
// Buton RESET_HOLD_MS boyunca basılı tutulursa factoryReset() tetiklenir.
// LED geri bildirimi: buton ne kadar basılı tutulduğunu gösterir.
void checkResetButton() {
  bool pressed = (digitalRead(GPIO_RESET_PIN) == LOW); // Active-low

  if (pressed && !resetArmed) {
    // Basılmaya başladı
    resetPressStart = millis();
    resetArmed      = true;
  }

  if (resetArmed && pressed) {
    unsigned long held = millis() - resetPressStart;

    // LED geri bildirimi — ne kadar daha basılı tutulması gerektiğini gösterir
    if (held > 1000 && held < 2000) {
      // Sarı uyarı — hâlâ basılı tut
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 300 < 150) ? CRGB(255, 150, 0) : CRGB::Black;
      FastLED.show();
    } else if (held >= 2000 && held < RESET_HOLD_MS) {
      // Kırmızı uyarı — sıfırlama çok yakın
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 200 < 100) ? CRGB(255, 0, 0) : CRGB::Black;
      FastLED.show();
    } else if (held >= RESET_HOLD_MS) {
      // Süre doldu — sıfırla
      factoryReset();
    }
  }

  if (resetArmed && !pressed) {
    // Bırakıldı — sıfırlama iptal, LED'leri normale döndür
    resetArmed = false;
    if (ledIsOn && activeEffect == "off") applyCurrentColor();
    else if (!ledIsOn) { for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show(); }
  }
}

void saveRules() {
  prefs.begin("automation", false);
  prefs.putInt("count", ruleCount);
  for (int i = 0; i < ruleCount; i++) {
    String key = "rule" + String(i);
    prefs.putBytes(key.c_str(), &rules[i], sizeof(AutomationRule));
  }
  prefs.end();
}

void loadRules() {
  prefs.begin("automation", true);
  ruleCount = prefs.getInt("count", 0);
  for (int i = 0; i < ruleCount; i++) {
    String key = "rule" + String(i);
    prefs.getBytes(key.c_str(), &rules[i], sizeof(AutomationRule));
  }
  prefs.end();
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void startAP() {
  WiFi.softAP("ESP32-Setup");
  Serial.println("AP MODE: " + WiFi.softAPIP().toString());
}

void connectToWiFi() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) { delay(500); Serial.print("."); retry++; }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nCONNECTED: " + WiFi.localIP().toString());
    configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("\nFAILED → AP MODE");
    WiFi.softAP("ESP32-Setup");
  }
}

// ── Temel endpoint'ler ────────────────────────────────────────────────────────
void handleSetup() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    ssid = server.arg("ssid"); password = server.arg("password");
    prefs.begin("wifi", false);
    prefs.putString("ssid", ssid); prefs.putString("pass", password);
    prefs.end();
    server.send(200, "text/plain", "SAVED");
    delay(1000); ESP.restart();
  } else { server.send(400, "text/plain", "MISSING PARAMS"); }
}

void handleWhoAmI() {
  addCORSHeaders();
  server.send(200, "application/json", "{\"device\":\"esp32-light\"}");
}

void handleLedOn() {
  activeEffect = "off"; ledIsOn = true; applyCurrentColor();
  server.send(200, "text/plain", "OK");
}

void handleLedOff() {
  activeEffect = "off"; ledIsOn = false;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  server.send(200, "text/plain", "OK");
}

void handleBrightness() {
  if (!server.hasArg("value")) { server.send(400, "text/plain", "MISSING value"); return; }
  int v = constrain(server.arg("value").toInt(), 0, 255);
  currentBrightness = v;
  if (ledIsOn && activeEffect == "off") { FastLED.setBrightness(currentBrightness); FastLED.show(); }
  server.send(200, "application/json", "{\"brightness\":" + String(v) + "}");
}

void handleColor() {
  addCORSHeaders();
  if (!server.hasArg("r") || !server.hasArg("g") || !server.hasArg("b")) {
    server.send(400, "text/plain", "MISSING r,g,b"); return;
  }
  currentR = constrain(server.arg("r").toInt(), 0, 255);
  currentG = constrain(server.arg("g").toInt(), 0, 255);
  currentB = constrain(server.arg("b").toInt(), 0, 255);
  if (ledIsOn && activeEffect == "off") applyCurrentColor();
  server.send(200, "application/json",
    "{\"r\":" + String(currentR) + ",\"g\":" + String(currentG) + ",\"b\":" + String(currentB) + "}");
}

void handleState() {
  addCORSHeaders();
  server.send(200, "application/json",
    "{\"on\":"         + String(ledIsOn ? "true" : "false") +
    ",\"r\":"          + String(currentR) +
    ",\"g\":"          + String(currentG) +
    ",\"b\":"          + String(currentB) +
    ",\"brightness\":" + String(currentBrightness) +
    ",\"effect\":\""   + activeEffect + "\"" +
    ",\"speed\":"      + String(effectSpeed) + "}");
}

void handleWifiScan() {
  addCORSHeaders();
  int n = WiFi.scanNetworks(false, false);
  if (n <= 0) { server.send(200, "application/json", "[]"); return; }
  String json = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    String s = WiFi.SSID(i);
    s.replace("\\", "\\\\"); s.replace("\"", "\\\"");
    json += "{\"ssid\":\"" + s + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";
  WiFi.scanDelete();
  server.send(200, "application/json", json);
}

void handleEffect() {
  addCORSHeaders();
  if (!server.hasArg("type")) { server.send(400, "text/plain", "MISSING type"); return; }
  String type = server.arg("type");
  activeEffect = type; effectStep = 0;
  if (server.hasArg("r"))     effectR     = constrain(server.arg("r").toInt(),     0, 255);
  if (server.hasArg("g"))     effectG     = constrain(server.arg("g").toInt(),     0, 255);
  if (server.hasArg("b"))     effectB     = constrain(server.arg("b").toInt(),     0, 255);
  if (server.hasArg("speed")) effectSpeed = constrain(server.arg("speed").toInt(), 0, 255);
  if (type == "meteor")  for (int i = 0; i < NUM_LEDS; i++) meteorTrail[i] = CRGB::Black;
  if (type == "twinkle") for (int i = 0; i < NUM_LEDS; i++) twinkleBri[i]  = random8();
  if (type == "off") {
    if (ledIsOn) applyCurrentColor();
    else { for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show(); }
  } else { ledIsOn = true; }
  server.send(200, "application/json", "{\"effect\":\"" + type + "\",\"speed\":" + String(effectSpeed) + "}");
}

// ── YENİ: /factory-reset ─────────────────────────────────────────────────────
// Uygulama üzerinden yazılımsal fabrika sıfırlaması.
// Fiziksel buton olmadan veya kullanıcı ağ değiştirirken kullanılır.
// NOT: Bu endpoint ağa erişim gerektirdiğinden "eski ağda son kez" çalışır.
// Yeni eve taşınma senaryosunda fiziksel buton daha güvenilirdir.
void handleFactoryReset() {
  addCORSHeaders();

  // Yanıtı önce gönder — sonra restart olunca istemci yanıtı alabilsin
  server.send(200, "application/json", "{\"status\":\"resetting\"}");

  // Kısa gecikme — yanıtın gönderilmesini bekle
  delay(300);

  factoryReset();
}

// ── Automation endpoint'leri ──────────────────────────────────────────────────
void handleAutomationList() {
  addCORSHeaders();
  String json = "[";
  for (int i = 0; i < ruleCount; i++) {
    if (i > 0) json += ",";
    json += "{\"id\":\"" + String(rules[i].id) + "\","
            "\"active\":"    + String(rules[i].active  ? "true" : "false") + ","
            "\"type\":"      + String(rules[i].type)   + ","
            "\"hour\":"      + String(rules[i].hour)   + ","
            "\"minute\":"    + String(rules[i].minute) + ","
            "\"action\":"    + String(rules[i].action) + ","
            "\"triggerAt\":" + String(rules[i].triggerAt) + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void handleAutomationAdd() {
  addCORSHeaders();
  if (ruleCount >= MAX_RULES) { server.send(400, "text/plain", "MAX_RULES reached"); return; }
  if (!server.hasArg("type") || !server.hasArg("action")) { server.send(400, "text/plain", "MISSING params"); return; }
  AutomationRule r; memset(&r, 0, sizeof(r));
  snprintf(r.id, sizeof(r.id), "%04lx%04d", millis() & 0xFFFF, ruleCount);
  r.active = true; r.type = server.arg("type").toInt(); r.action = server.arg("action").toInt();
  if (r.type == 0) {
    if (!server.hasArg("hour") || !server.hasArg("minute")) { server.send(400, "text/plain", "MISSING hour/minute"); return; }
    r.hour = server.arg("hour").toInt(); r.minute = server.arg("minute").toInt();
  } else {
    if (!server.hasArg("countdown")) { server.send(400, "text/plain", "MISSING countdown"); return; }
    r.triggerAt = (long)time(nullptr) + server.arg("countdown").toInt();
  }
  rules[ruleCount++] = r; saveRules();
  server.send(200, "application/json", "{\"id\":\"" + String(r.id) + "\"}");
}

void handleAutomationDelete() {
  addCORSHeaders();
  if (!server.hasArg("id")) { server.send(400, "text/plain", "MISSING id"); return; }
  String tid = server.arg("id"); int found = -1;
  for (int i = 0; i < ruleCount; i++) if (String(rules[i].id) == tid) { found = i; break; }
  if (found == -1) { server.send(404, "text/plain", "NOT FOUND"); return; }
  for (int i = found; i < ruleCount - 1; i++) rules[i] = rules[i + 1];
  ruleCount--; saveRules();
  server.send(200, "application/json", "{\"status\":\"deleted\"}");
}

void handleAutomationToggle() {
  addCORSHeaders();
  if (!server.hasArg("id")) { server.send(400, "text/plain", "MISSING id"); return; }
  String tid = server.arg("id");
  for (int i = 0; i < ruleCount; i++) {
    if (String(rules[i].id) == tid) {
      rules[i].active = !rules[i].active; saveRules();
      server.send(200, "application/json", "{\"active\":" + String(rules[i].active ? "true" : "false") + "}");
      return;
    }
  }
  server.send(404, "text/plain", "NOT FOUND");
}

void handleAutomationTime() {
  addCORSHeaders();
  time_t now = time(nullptr); struct tm* t = localtime(&now);
  char buf[64];
  snprintf(buf, sizeof(buf), "{\"hour\":%d,\"minute\":%d,\"second\":%d,\"unix\":%ld}",
    t->tm_hour, t->tm_min, t->tm_sec, (long)now);
  server.send(200, "application/json", String(buf));
}

// ── Automation loop ───────────────────────────────────────────────────────────
unsigned long lastCheckMs = 0;

void checkAutomation() {
  if (millis() - lastCheckMs < 1000) return;
  lastCheckMs = millis();
  time_t now = time(nullptr); struct tm* t = localtime(&now);
  for (int i = 0; i < ruleCount; i++) {
    if (!rules[i].active) continue;
    bool shouldTrigger = false;
    if (rules[i].type == 0) {
      if (t->tm_hour == rules[i].hour && t->tm_min == rules[i].minute &&
          t->tm_sec < 5 && !rules[i].triggered) { shouldTrigger = rules[i].triggered = true; }
      if (t->tm_min != rules[i].minute) rules[i].triggered = false;
    } else {
      if ((long)now >= rules[i].triggerAt && !rules[i].triggered) {
        shouldTrigger = rules[i].triggered = true; rules[i].active = false; saveRules();
      }
    }
    if (shouldTrigger) {
      if (rules[i].action == 1) { activeEffect = "off"; ledIsOn = true; applyCurrentColor(); }
      else { activeEffect = "off"; ledIsOn = false; for (int j = 0; j < NUM_LEDS; j++) leds[j] = CRGB::Black; FastLED.show(); }
    }
  }
}

// ── Efekt frame'leri ──────────────────────────────────────────────────────────
void runEffects() {
  if (activeEffect == "off") return;
  unsigned long now     = millis();
  unsigned long frameMs = speedToMs(effectSpeed);

  if (activeEffect == "rainbow") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = CHSV((effectStep + (i * 256 / NUM_LEDS)) % 256, 255, currentBrightness);
    FastLED.show(); effectStep = (effectStep + 2) % 256;
  }
  else if (activeEffect == "breathe") {
    if (now - lastEffectMs < frameMs / 3) return; lastEffectMs = now;
    float rad = (effectStep / 255.0f) * 2.0f * PI;
    uint8_t bri = (uint8_t)((sin(rad) * 0.5f + 0.5f) * currentBrightness);
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = CRGB((effectR * bri) / 255, (effectG * bri) / 255, (effectB * bri) / 255);
    FastLED.show(); effectStep = (effectStep + 1) % 256;
  }
  else if (activeEffect == "wave") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    for (int i = 0; i < NUM_LEDS; i++) {
      float phase = (float)(effectStep + i * 10) / 255.0f * 2.0f * PI;
      uint8_t bri = (uint8_t)((sin(phase) * 0.5f + 0.5f) * currentBrightness);
      leds[i] = CRGB((effectR * bri) / 255, (effectG * bri) / 255, (effectB * bri) / 255);
    }
    FastLED.show(); effectStep = (effectStep + 3) % 256;
  }
  else if (activeEffect == "fire") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    for (int i = 0; i < NUM_LEDS; i++) {
      uint8_t flicker = random8(120, 255); uint8_t g = random8(0, 60);
      leds[i] = CRGB((flicker * currentBrightness) / 255, (g * currentBrightness) / 255, 0);
    }
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "meteor") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    for (int i = 0; i < NUM_LEDS; i++) {
      if (meteorTrail[i].r > 20) meteorTrail[i].r -= 20; else meteorTrail[i].r = 0;
      if (meteorTrail[i].g > 20) meteorTrail[i].g -= 20; else meteorTrail[i].g = 0;
      if (meteorTrail[i].b > 20) meteorTrail[i].b -= 20; else meteorTrail[i].b = 0;
    }
    int pos = effectStep % (NUM_LEDS + 10);
    if (pos < NUM_LEDS) {
      meteorTrail[pos] = CRGB(effectR, effectG, effectB);
      if (pos > 0) meteorTrail[pos-1] = CRGB(effectR/2, effectG/2, effectB/2);
      if (pos > 1) meteorTrail[pos-2] = CRGB(effectR/4, effectG/4, effectB/4);
    }
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = CRGB((meteorTrail[i].r * currentBrightness) / 255,
                     (meteorTrail[i].g * currentBrightness) / 255,
                     (meteorTrail[i].b * currentBrightness) / 255);
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "twinkle") {
    if (now - lastEffectMs < frameMs / 4) return; lastEffectMs = now;
    for (int j = 0; j < 3; j++) twinkleBri[random8(NUM_LEDS)] = random8(200, 255);
    for (int i = 0; i < NUM_LEDS; i++) {
      uint8_t bri = (twinkleBri[i] * currentBrightness) / 255;
      leds[i] = CRGB((effectR * bri) / 255, (effectG * bri) / 255, (effectB * bri) / 255);
      if (twinkleBri[i] > 10) twinkleBri[i] -= 10; else twinkleBri[i] = 0;
    }
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "strobe") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    bool on = (effectStep % 2 == 0);
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = on ? CRGB((effectR * currentBrightness) / 255,
                           (effectG * currentBrightness) / 255,
                           (effectB * currentBrightness) / 255) : CRGB::Black;
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "comet") {
    if (now - lastEffectMs < frameMs) return; lastEffectMs = now;
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
    int head = effectStep % (NUM_LEDS * 2);
    int pos  = head < NUM_LEDS ? head : NUM_LEDS * 2 - head;
    for (int t = 0; t < 8 && pos - t >= 0 && pos - t < NUM_LEDS; t++) {
      uint8_t fade = (uint8_t)(255 - t * 30);
      uint8_t bri  = (fade * currentBrightness) / 255;
      leds[pos - t] = CRGB((effectR * bri) / 255, (effectG * bri) / 255, (effectB * bri) / 255);
    }
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "theater") {
    if (now - lastEffectMs < frameMs * 3) return; lastEffectMs = now;
    int offset = effectStep % 3;
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = ((i + offset) % 3 == 0)
        ? CRGB((effectR * currentBrightness) / 255, (effectG * currentBrightness) / 255, (effectB * currentBrightness) / 255)
        : CRGB::Black;
    FastLED.show(); effectStep++;
  }
  else if (activeEffect == "pulse") {
    if (now - lastEffectMs < frameMs / 4) return; lastEffectMs = now;
    float rad = (effectStep / 255.0f) * 2.0f * PI;
    uint8_t bri = (uint8_t)((sin(rad) * 0.5f + 0.5f) * currentBrightness);
    for (int i = 0; i < NUM_LEDS; i++)
      leds[i] = CRGB((effectR * bri) / 255, (effectG * bri) / 255, (effectB * bri) / 255);
    FastLED.show(); effectStep = (effectStep + 2) % 256;
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Reset butonu pini — INPUT_PULLUP: harici direnç gerekmez
  // Buton GND'ye bağlanınca LOW okur (active-low)
  pinMode(GPIO_RESET_PIN, INPUT_PULLUP);

  FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(currentBrightness);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();

  prefs.begin("wifi", true);
  ssid = prefs.getString("ssid", ""); password = prefs.getString("pass", "");
  prefs.end();

  if (ssid == "") { startAP(); } else { connectToWiFi(); }
  loadRules();

  server.on("/setup",              handleSetup);
  server.on("/whoami",             handleWhoAmI);
  server.on("/led/on",             handleLedOn);
  server.on("/led/off",            handleLedOff);
  server.on("/led/brightness",     handleBrightness);
  server.on("/led/color",          handleColor);
  server.on("/led/state",          handleState);
  server.on("/wifi/scan",          handleWifiScan);
  server.on("/effect",             handleEffect);
  server.on("/factory-reset",      handleFactoryReset);  // ← YENİ
  server.on("/automation/list",    handleAutomationList);
  server.on("/automation/add",     handleAutomationAdd);
  server.on("/automation/delete",  handleAutomationDelete);
  server.on("/automation/toggle",  handleAutomationToggle);
  server.on("/automation/time",    handleAutomationTime);

  server.begin();
  Serial.println("Server başladı — GPIO" + String(GPIO_RESET_PIN) + " reset butonu aktif");
}

// ── loop ─────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  runEffects();
  checkAutomation();
  checkResetButton(); // Her loop'ta fiziksel butonu kontrol et
}
