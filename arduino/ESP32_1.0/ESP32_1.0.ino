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
  Serial.printf("Automation: %d kural yüklendi\n", ruleCount);
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void startAP() {
  WiFi.softAP("ESP32-Setup-2");
  Serial.println("AP MODE: ESP32-Setup");
  Serial.println(WiFi.softAPIP());
}

void connectToWiFi() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) { delay(500); Serial.print("."); retry++; }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nCONNECTED! IP: " + WiFi.localIP().toString());
    configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("\nFAILED → AP MODE");
    WiFi.softAP("ESP32-Setup");
    Serial.println(WiFi.softAPIP());
  }
}

// ── Mevcut LED endpoint'leri ──────────────────────────────────────────────────
void handleSetup() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    ssid     = server.arg("ssid");
    password = server.arg("password");
    prefs.begin("wifi", false);
    prefs.putString("ssid", ssid);
    prefs.putString("pass", password);
    prefs.end();
    server.send(200, "text/plain", "SAVED");
    delay(1000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "MISSING PARAMS");
  }
}

void handleWhoAmI() {
  addCORSHeaders();
  server.send(200, "application/json", "{\"device\":\"esp32-light\"}");
}

void handleLedOn() {
  ledIsOn = true;
  applyCurrentColor();
  server.send(200, "text/plain", "OK");
}

void handleLedOff() {
  ledIsOn = false;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  server.send(200, "text/plain", "OK");
}

void handleBrightness() {
  if (!server.hasArg("value")) { server.send(400, "text/plain", "MISSING value"); return; }
  int v = constrain(server.arg("value").toInt(), 0, 255);
  currentBrightness = v;
  if (ledIsOn) { FastLED.setBrightness(currentBrightness); FastLED.show(); }
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
  if (ledIsOn) applyCurrentColor();
  server.send(200, "application/json",
    "{\"r\":" + String(currentR) + ",\"g\":" + String(currentG) + ",\"b\":" + String(currentB) + "}");
}

void handleState() {
  addCORSHeaders();
  String res = "{\"on\":"         + String(ledIsOn ? "true" : "false") +
               ",\"r\":"          + String(currentR) +
               ",\"g\":"          + String(currentG) +
               ",\"b\":"          + String(currentB) +
               ",\"brightness\":" + String(currentBrightness) + "}";
  server.send(200, "application/json", res);
}

// ── YENİ: /wifi/scan ─────────────────────────────────────────────────────────
// Çevredeki WiFi ağlarını tarar ve JSON listesi döndürür.
// React Native bu endpoint'i çağırarak kullanıcıya ağ listesi gösterir.
// Her iki platform (iOS + Android) için fetch ile çalışır.
//
// Yanıt formatı:
// [{"ssid":"Ev WiFi","rssi":-65},{"ssid":"Komşu","rssi":-80}]
//
// rssi: sinyal gücü (dBm) — -50 mükemmel, -80 zayıf
void handleWifiScan() {
  addCORSHeaders();

  Serial.println("WiFi scan başladı...");

  // Scan başlat — false: aktif mod (daha hızlı), true: passive mod
  int n = WiFi.scanNetworks(false, false);

  Serial.printf("WiFi scan bitti: %d ağ bulundu\n", n);

  if (n <= 0) {
    server.send(200, "application/json", "[]");
    return;
  }

  String json = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";

    String ssidStr = WiFi.SSID(i);

    // SSID içindeki özel karakterleri escape et (JSON güvenliği)
    ssidStr.replace("\\", "\\\\");
    ssidStr.replace("\"", "\\\"");

    json += "{\"ssid\":\"" + ssidStr + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";

  // Scan sonuçlarını temizle (bellek boşalt)
  WiFi.scanDelete();

  server.send(200, "application/json", json);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Automation endpoint'leri ──────────────────────────────────────────────────
void handleAutomationList() {
  addCORSHeaders();
  String json = "[";
  for (int i = 0; i < ruleCount; i++) {
    if (i > 0) json += ",";
    json += "{\"id\":\"" + String(rules[i].id) + "\","
            "\"active\":"  + String(rules[i].active ? "true" : "false") + ","
            "\"type\":"    + String(rules[i].type)   + ","
            "\"hour\":"    + String(rules[i].hour)   + ","
            "\"minute\":"  + String(rules[i].minute) + ","
            "\"action\":"  + String(rules[i].action) + ","
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
  for (int i = 0; i < ruleCount; i++) { if (String(rules[i].id) == tid) { found = i; break; } }
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
      if (t->tm_hour == rules[i].hour && t->tm_min == rules[i].minute && t->tm_sec < 5 && !rules[i].triggered) {
        shouldTrigger = rules[i].triggered = true;
      }
      if (t->tm_min != rules[i].minute) rules[i].triggered = false;
    } else {
      if ((long)now >= rules[i].triggerAt && !rules[i].triggered) {
        shouldTrigger = rules[i].triggered = true;
        rules[i].active = false; saveRules();
      }
    }
    if (shouldTrigger) {
      if (rules[i].action == 1) { ledIsOn = true; applyCurrentColor(); }
      else { ledIsOn = false; for (int j = 0; j < NUM_LEDS; j++) leds[j] = CRGB::Black; FastLED.show(); }
      Serial.printf("Automation: %s → %s\n", rules[i].id, rules[i].action == 1 ? "ON" : "OFF");
    }
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(currentBrightness);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();

  prefs.begin("wifi", true);
  ssid     = prefs.getString("ssid", "");
  password = prefs.getString("pass", "");
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
  server.on("/wifi/scan",          handleWifiScan);   // ← YENİ
  server.on("/automation/list",    handleAutomationList);
  server.on("/automation/add",     handleAutomationAdd);
  server.on("/automation/delete",  handleAutomationDelete);
  server.on("/automation/toggle",  handleAutomationToggle);
  server.on("/automation/time",    handleAutomationTime);

  server.begin();
  Serial.println("Server başladı");
}

// ── loop ──────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  checkAutomation();
}
