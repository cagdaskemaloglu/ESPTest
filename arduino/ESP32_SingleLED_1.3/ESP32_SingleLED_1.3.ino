/**
 * ESP32_SingleLED.ino
 * Tek renkli LED veya ampul için ESP32 firmware.
 *
 * Farklar (WS2812B'ye göre):
 *   - FastLED yok — PWM ile ledcAttach/ledcWrite kullanılır
 *   - Renk kontrolü yok (RGB yok)
 *   - Efekt sistemi yok
 *   - /whoami: type="single_led", capabilities=["on_off","brightness"]
 *
 * /whoami yanıtı:
 *   {"device":"esp32-light","type":"single_led","capabilities":["on_off","brightness"]}
 *
 * Desteklenen endpoint'ler:
 *   /whoami
 *   /led/on
 *   /led/off
 *   /led/brightness?value=0..255
 *   /led/state
 *   /wifi/scan
 *   /setup
 *   /factory-reset
 *   /automation/list|add|delete|toggle|time
 *
 * Bağlantı:
 *   LED (+) → GPIO LED_PIN → 220Ω direnç → LED (-) → GND
 *   Ampul modülü: röle veya MOSFET üzerinden
 *
 * PWM ayarları:
 *   5000 Hz, 8-bit (0-255)
 *   Arduino core v3.x API: ledcAttach + ledcWrite
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>

WebServer server(80);
Preferences prefs;

String ssid     = "";
String password = "";

// ── LED PWM ayarları ──────────────────────────────────────────────────────────
#define LED_PIN      2      // PWM çıkışı — LED'in bağlı olduğu pin
#define PWM_FREQ     5000   // 5 kHz PWM frekansı
#define PWM_RES_BITS 8      // 8-bit çözünürlük → 0-255

int  currentBrightness = 255;
bool ledIsOn           = false;

// ── Fiziksel reset butonu ─────────────────────────────────────────────────────
#define GPIO_RESET_PIN  0      // BOOT butonu (GND'ye bağlı, active-low)
#define RESET_HOLD_MS   3000   // 3 saniye basılı tut → fabrika sıfırlama

unsigned long resetPressStart = 0;
bool          resetArmed      = false;

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
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void applyBrightness() {
  ledcWrite(LED_PIN, ledIsOn ? currentBrightness : 0);
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

// ── Fabrika sıfırlama ─────────────────────────────────────────────────────────
void factoryReset() {
  Serial.println("⚠️  FABRIKA SIFIRLAMASI...");

  // Görsel geri bildirim — LED 2 kez hızlı yanar söner
  ledcWrite(LED_PIN, 255); delay(200);
  ledcWrite(LED_PIN, 0);   delay(200);
  ledcWrite(LED_PIN, 255); delay(200);
  ledcWrite(LED_PIN, 0);   delay(200);

  prefs.begin("wifi", false);      prefs.clear(); prefs.end();
  prefs.begin("automation", false); prefs.clear(); prefs.end();

  delay(300);
  ESP.restart();
}

// ── Fiziksel buton kontrolü ───────────────────────────────────────────────────
void checkResetButton() {
  bool pressed = (digitalRead(GPIO_RESET_PIN) == LOW);

  if (pressed && !resetArmed) {
    resetPressStart = millis();
    resetArmed      = true;
  }

  if (resetArmed && pressed) {
    unsigned long held = millis() - resetPressStart;
    // LED geri bildirimi
    if (held > 1000 && held < 2000) {
      ledcWrite(LED_PIN, (held % 300 < 150) ? 128 : 0); // Orta parlaklık yanıp söner
    } else if (held >= 2000 && held < RESET_HOLD_MS) {
      ledcWrite(LED_PIN, (held % 200 < 100) ? 255 : 0); // Tam parlaklık yanıp söner
    } else if (held >= RESET_HOLD_MS) {
      factoryReset();
    }
  }

  if (resetArmed && !pressed) {
    resetArmed = false;
    applyBrightness(); // LED'i normal durumuna döndür
  }
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

// ── Endpoint'ler ───────────────────────────────────────────────────────────────

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

// /whoami — type ve capabilities ile birlikte yanıt verir
// React Native bu yanıtı okuyarak UI'ı otomatik yapılandırır
void handleWhoAmI() {
  addCORSHeaders();
  server.send(200, "application/json",
    "{"
      "\"device\":\"esp32-light\","
      "\"type\":\"single_led\","
      "\"capabilities\":[\"on_off\",\"brightness\"]"
    "}"
  );
}

void handleLedOn() {
  ledIsOn = true;
  ledcWrite(LED_PIN, currentBrightness);
  server.send(200, "text/plain", "OK");
}

void handleLedOff() {
  ledIsOn = false;
  ledcWrite(LED_PIN, 0);
  server.send(200, "text/plain", "OK");
}

void handleBrightness() {
  if (!server.hasArg("value")) { server.send(400, "text/plain", "MISSING value"); return; }
  int v = constrain(server.arg("value").toInt(), 0, 255);
  currentBrightness = v;
  if (ledIsOn) ledcWrite(LED_PIN, currentBrightness);
  server.send(200, "application/json", "{\"brightness\":" + String(v) + "}");
}

void handleState() {
  addCORSHeaders();
  server.send(200, "application/json",
    "{\"on\":"         + String(ledIsOn ? "true" : "false") +
    ",\"brightness\":" + String(currentBrightness) + "}");
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

void handleFactoryReset() {
  addCORSHeaders();
  server.send(200, "application/json", "{\"status\":\"resetting\"}");
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
    if (!server.hasArg("countdown")) { server.send(400, "text/param", "MISSING countdown"); return; }
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
      if (rules[i].action == 1) {
        ledIsOn = true;
        ledcWrite(LED_PIN, currentBrightness);
        Serial.printf("Automation: %s → LED ON\n", rules[i].id);
      } else {
        ledIsOn = false;
        ledcWrite(LED_PIN, 0);
        Serial.printf("Automation: %s → LED OFF\n", rules[i].id);
      }
    }
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // PWM başlat (Arduino core v3.x API)
  ledcAttach(LED_PIN, PWM_FREQ, PWM_RES_BITS);
  ledcWrite(LED_PIN, 0); // Başlangıçta kapalı

  // Reset butonu
  pinMode(GPIO_RESET_PIN, INPUT_PULLUP);

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
  server.on("/led/state",          handleState);
  server.on("/wifi/scan",          handleWifiScan);
  server.on("/factory-reset",      handleFactoryReset);
  server.on("/automation/list",    handleAutomationList);
  server.on("/automation/add",     handleAutomationAdd);
  server.on("/automation/delete",  handleAutomationDelete);
  server.on("/automation/toggle",  handleAutomationToggle);
  server.on("/automation/time",    handleAutomationTime);

  server.begin();
  Serial.println("SingleLED Server başladı — GPIO" + String(LED_PIN));
}

// ── loop ─────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  checkAutomation();
  checkResetButton();
}
