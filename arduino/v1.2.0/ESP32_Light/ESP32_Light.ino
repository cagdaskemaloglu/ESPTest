#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>
#include <FastLED.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ArduinoJson.h>

WebServer server(80);
Preferences prefs;

String ssid      = "";
String password  = "";
String devicePin = "";

#define FIRMWARE_VERSION "1.2.0"
#define VERSION_JSON_URL "https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json"

#define DEVICE_PARTS_DEFAULT "base01,body02,head01"
#define DEVICE_COLORS_DEFAULT "{\"base01\":\"#1a1a1a\",\"body02\":\"#c8b89a\",\"head01\":\"#2a2a2a\"}"
#define DEVICE_ROUGHNESS_DEFAULT "{\"base01\":0.8,\"body02\":0.6,\"head01\":0.9}"
#define DEVICE_METALNESS_DEFAULT "{\"base01\":0.1,\"body02\":0.2,\"head01\":0.05}"
#define NUM_CHANNELS 1

String deviceParts     = "";
String deviceColors    = "";
String deviceRoughness = "";
String deviceMetalness = "";

#define LED_PIN   2
#define NUM_LEDS  30

CRGB leds[NUM_LEDS];
int     currentBrightness = 255;
uint8_t currentR = 255, currentG = 255, currentB = 255;
bool    ledIsOn  = false;

#define MAX_FAILED_ATTEMPTS 5
#define LOCKOUT_DURATION_MS 30000
int           failedAttempts = 0;
unsigned long lockoutStart   = 0;
bool          isLockedOut    = false;

String   activeEffect = "off";
uint8_t  effectR = 0, effectG = 150, effectB = 255;
uint8_t  effectSpeed = 128;
unsigned long lastEffectMs = 0;
uint16_t effectStep = 0;
CRGB     meteorTrail[NUM_LEDS];
uint8_t  twinkleBri[NUM_LEDS];

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

#define GPIO_RESET_PIN  0
#define RESET_HOLD_MS   3000
unsigned long resetPressStart = 0;
bool          resetArmed      = false;

// ── OTA — struct önce tanımlanmalı ───────────────────────────────────────────
bool otaInProgress = false;

struct OTACheckResult {
  bool   available;
  String newVersion;
  String binUrl;
  String notes;
};

// ── Fade (Uyku Modu) değişkenleri ────────────────────────────────────────────
bool     fadeActive     = false;
long     fadeDurationMs = 0;
long     fadeStartMs    = 0;
uint8_t  fadeStartBri   = 255;
uint8_t  fadeTargetBri  = 0;
bool     fadeOffAtEnd   = true;

// ── Yardımcılar ───────────────────────────────────────────────────────────────
void applyCurrentColor() {
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(currentR, currentG, currentB);
  FastLED.setBrightness(currentBrightness);
  FastLED.show();
}

void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Pin");
}

unsigned long speedToMs(uint8_t speed) {
  return map(speed, 0, 255, 100, 5);
}

int compareVersions(const String& a, const String& b) {
  int aMajor = 0, aMinor = 0, aPatch = 0;
  int bMajor = 0, bMinor = 0, bPatch = 0;
  sscanf(a.c_str(), "%d.%d.%d", &aMajor, &aMinor, &aPatch);
  sscanf(b.c_str(), "%d.%d.%d", &bMajor, &bMinor, &bPatch);
  if (aMajor != bMajor) return aMajor < bMajor ? -1 : 1;
  if (aMinor != bMinor) return aMinor < bMinor ? -1 : 1;
  if (aPatch != bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

OTACheckResult checkForUpdate() {
  OTACheckResult result = { false, "", "", "" };
  if (WiFi.status() != WL_CONNECTED) { Serial.println("OTA: WiFi bağlı değil"); return result; }
  Serial.println("OTA: Sürüm kontrolü başlıyor...");
  HTTPClient http;
  http.begin(VERSION_JSON_URL);
  http.setTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  int httpCode = http.GET();
  Serial.printf("OTA: HTTP kodu = %d\n", httpCode);
  if (httpCode != HTTP_CODE_OK) { http.end(); return result; }
  String payload = http.getString();
  http.end();
  Serial.println("OTA: Yanıt = " + payload);
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) { Serial.println("OTA: JSON parse hatası"); return result; }
  String remoteVersion = doc["version"] | "";
  String binUrl        = doc["url"]     | "";
  String notes         = doc["notes"]   | "";
  Serial.printf("OTA: Mevcut = %s, Uzak = %s\n", FIRMWARE_VERSION, remoteVersion.c_str());
  if (remoteVersion.isEmpty() || binUrl.isEmpty()) { Serial.println("OTA: Geçersiz version.json"); return result; }
  if (compareVersions(String(FIRMWARE_VERSION), remoteVersion) < 0) {
    Serial.printf("OTA: Güncelleme mevcut! %s → %s\n", FIRMWARE_VERSION, remoteVersion.c_str());
    result.available = true; result.newVersion = remoteVersion; result.binUrl = binUrl; result.notes = notes;
  } else { Serial.println("OTA: Güncel, güncelleme yok"); }
  return result;
}

bool applyUpdate(const String& binUrl) {
  Serial.println("OTA: Güncelleme başlıyor...");
  otaInProgress = true;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, 0, 50);
  FastLED.show();
  HTTPClient http;
  http.begin(binUrl);
  http.setTimeout(60000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) { Serial.printf("OTA: .bin indirme hatası %d\n", httpCode); http.end(); otaInProgress = false; return false; }
  int contentLength = http.getSize();
  Serial.printf("OTA: Dosya boyutu = %d bytes\n", contentLength);
  if (contentLength <= 0) { Serial.println("OTA: Geçersiz dosya boyutu"); http.end(); otaInProgress = false; return false; }
  if (!Update.begin(contentLength)) { Serial.println("OTA: Update.begin hatası — yeterli alan yok"); http.end(); otaInProgress = false; return false; }
  Update.onProgress([](size_t done, size_t total) { Serial.printf("OTA: %%%d\n", (int)(done * 100 / total)); });
  WiFiClient& stream = http.getStream();
  size_t written = Update.writeStream(stream);
  http.end();
  if (written != (size_t)contentLength) { Serial.printf("OTA: Yazma hatası\n"); Update.abort(); otaInProgress = false; return false; }
  if (!Update.end()) { Serial.printf("OTA: Update.end hatası: %s\n", Update.errorString()); otaInProgress = false; return false; }
  Serial.println("OTA: Güncelleme başarılı! Yeniden başlatılıyor...");
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, 80, 0);
  FastLED.show(); delay(1000);
  ESP.restart();
  return true;
}

bool checkPIN() {
  if (isLockedOut) {
    unsigned long elapsed = millis() - lockoutStart;
    if (elapsed < LOCKOUT_DURATION_MS) {
      unsigned long remaining = (LOCKOUT_DURATION_MS - elapsed) / 1000;
      server.send(429, "application/json", "{\"error\":\"too_many_attempts\",\"retry_after\":" + String(remaining) + "}");
      return false;
    } else { isLockedOut = false; failedAttempts = 0; }
  }
  if (devicePin == "") return true;
  String requestPin = "";
  if      (server.hasArg("pin"))      requestPin = server.arg("pin");
  else if (server.hasHeader("X-Pin")) requestPin = server.header("X-Pin");
  if (requestPin == devicePin) { failedAttempts = 0; return true; }
  failedAttempts++;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    isLockedOut = true; lockoutStart = millis();
    server.send(429, "application/json", "{\"error\":\"too_many_attempts\",\"retry_after\":30}");
  } else {
    server.send(403, "application/json", "{\"error\":\"invalid_pin\",\"attempts_left\":" + String(MAX_FAILED_ATTEMPTS - failedAttempts) + "}");
  }
  return false;
}

void factoryReset() {
  Serial.println("FABRIKA SIFIRLAMASI...");
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0); FastLED.show(); delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show(); delay(200);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0); FastLED.show(); delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show();
  prefs.begin("wifi",       false); prefs.clear(); prefs.end();
  prefs.begin("automation", false); prefs.clear(); prefs.end();
  prefs.begin("security",   false); prefs.clear(); prefs.end();
  delay(500); ESP.restart();
}

void checkResetButton() {
  bool pressed = (digitalRead(GPIO_RESET_PIN) == LOW);
  if (pressed && !resetArmed) { resetPressStart = millis(); resetArmed = true; }
  if (resetArmed && pressed) {
    unsigned long held = millis() - resetPressStart;
    if (held > 1000 && held < 2000) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 300 < 150) ? CRGB(255, 150, 0) : CRGB::Black; FastLED.show();
    } else if (held >= 2000 && held < RESET_HOLD_MS) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 200 < 100) ? CRGB(255, 0, 0) : CRGB::Black; FastLED.show();
    } else if (held >= RESET_HOLD_MS) { factoryReset(); }
  }
  if (resetArmed && !pressed) {
    resetArmed = false;
    if (ledIsOn && activeEffect == "off") applyCurrentColor();
    else if (!ledIsOn) { for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show(); }
  }
}

void startAP() { WiFi.softAP("ESP32-Setup"); Serial.println("AP: " + WiFi.softAPIP().toString()); }

#define DEVICE_PARTS_VERSION 3
void loadOrInitParts() {
  prefs.begin("device", false);
  int savedVersion = prefs.getInt("parts_ver", 0);
  if (savedVersion != DEVICE_PARTS_VERSION) {
    prefs.putInt("parts_ver",  DEVICE_PARTS_VERSION);
    prefs.putString("parts",     DEVICE_PARTS_DEFAULT);
    prefs.putString("colors",    DEVICE_COLORS_DEFAULT);
    prefs.putString("roughness", DEVICE_ROUGHNESS_DEFAULT);
    prefs.putString("metalness", DEVICE_METALNESS_DEFAULT);
    deviceParts = DEVICE_PARTS_DEFAULT; deviceColors = DEVICE_COLORS_DEFAULT;
    deviceRoughness = DEVICE_ROUGHNESS_DEFAULT; deviceMetalness = DEVICE_METALNESS_DEFAULT;
    Serial.printf("✅ Parts güncellendi (v%d): %s\n", DEVICE_PARTS_VERSION, deviceParts.c_str());
  } else {
    deviceParts     = prefs.getString("parts",     DEVICE_PARTS_DEFAULT);
    deviceColors    = prefs.getString("colors",    DEVICE_COLORS_DEFAULT);
    deviceRoughness = prefs.getString("roughness", DEVICE_ROUGHNESS_DEFAULT);
    deviceMetalness = prefs.getString("metalness", DEVICE_METALNESS_DEFAULT);
    Serial.printf("📦 Parts yüklendi (v%d): %s\n", DEVICE_PARTS_VERSION, deviceParts.c_str());
  }
  prefs.end();
}

String partsToJsonArray(const String& parts) {
  String json = "["; int start = 0; bool first = true;
  for (int i = 0; i <= (int)parts.length(); i++) {
    if (i == (int)parts.length() || parts[i] == ',') {
      String key = parts.substring(start, i); key.trim();
      if (key.length() > 0) { if (!first) json += ","; json += "\"" + key + "\""; first = false; }
      start = i + 1;
    }
  }
  json += "]"; return json;
}

void connectToWiFi() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting"); int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) { delay(500); Serial.print("."); retry++; }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nCONNECTED: " + WiFi.localIP().toString());
    configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  } else { Serial.println("\nFAILED → AP"); WiFi.softAP("ESP32-Setup"); }
}

// ── Endpoint'ler ──────────────────────────────────────────────────────────────
void handleSetup() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    ssid = server.arg("ssid"); password = server.arg("password");
    if (server.hasArg("pin") && server.arg("pin").length() >= 4) {
      devicePin = server.arg("pin");
      prefs.begin("security", false); prefs.putString("pin", devicePin); prefs.end();
    }
    prefs.begin("wifi", false); prefs.putString("ssid", ssid); prefs.putString("pass", password); prefs.end();
    server.send(200, "text/plain", "SAVED"); delay(1000); ESP.restart();
  } else { server.send(400, "text/plain", "MISSING PARAMS"); }
}

void handleWhoAmI() {
  addCORSHeaders();
  String partsJson    = partsToJsonArray(deviceParts);
  String channelsJson = "[{\"id\":0,\"name\":\"Şerit\",\"capabilities\":[\"on_off\",\"brightness\",\"color\",\"effects\"],\"leds\":" + String(NUM_LEDS) + "}]";
  server.send(200, "application/json",
    "{\"device\":\"esp32-light\",\"type\":\"ws2812b\","
    "\"channels\":"      + channelsJson    + ","
    "\"parts\":"         + partsJson       + ","
    "\"partColors\":"    + deviceColors    + ","
    "\"partRoughness\":" + deviceRoughness + ","
    "\"partMetalness\":" + deviceMetalness + ","
    "\"capabilities\":[\"on_off\",\"brightness\",\"color\",\"effects\"],"
    "\"leds\":"         + String(NUM_LEDS) + ","
    "\"pin_required\":" + String(devicePin != "" ? "true" : "false") + ","
    "\"firmware\":\""   + String(FIRMWARE_VERSION) + "\"}");
}

// handleLedOn/Off — fade'i de sıfırla
void handleLedOn()  { addCORSHeaders(); if (!checkPIN()) return; fadeActive = false; activeEffect = "off"; ledIsOn = true;  applyCurrentColor(); server.send(200, "text/plain", "OK"); }
void handleLedOff() { addCORSHeaders(); if (!checkPIN()) return; fadeActive = false; activeEffect = "off"; ledIsOn = false; for (int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black; FastLED.show(); server.send(200,"text/plain","OK"); }

void handleBrightness() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!server.hasArg("value")) { server.send(400,"text/plain","MISSING value"); return; }
  int v = constrain(server.arg("value").toInt(), 0, 255); currentBrightness = v;
  if (ledIsOn && activeEffect == "off") { FastLED.setBrightness(currentBrightness); FastLED.show(); }
  server.send(200,"application/json","{\"brightness\":"+String(v)+"}");
}

void handleColor() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!server.hasArg("r")||!server.hasArg("g")||!server.hasArg("b")) { server.send(400,"text/plain","MISSING r,g,b"); return; }
  currentR=constrain(server.arg("r").toInt(),0,255); currentG=constrain(server.arg("g").toInt(),0,255); currentB=constrain(server.arg("b").toInt(),0,255);
  if (ledIsOn && activeEffect=="off") applyCurrentColor();
  server.send(200,"application/json","{\"r\":"+String(currentR)+",\"g\":"+String(currentG)+",\"b\":"+String(currentB)+"}");
}

void handleState() {
  addCORSHeaders(); if (!checkPIN()) return;
  server.send(200,"application/json",
    "{\"on\":"+String(ledIsOn?"true":"false")+
    ",\"r\":"+String(currentR)+",\"g\":"+String(currentG)+",\"b\":"+String(currentB)+
    ",\"brightness\":"+String(currentBrightness)+
    ",\"effect\":\""+activeEffect+"\""+
    ",\"speed\":"+String(effectSpeed)+
    ",\"fade_active\":"+String(fadeActive?"true":"false")+
    ",\"firmware\":\""+String(FIRMWARE_VERSION)+"\"}");
}

void handleWifiScan() {
  addCORSHeaders();
  int n = WiFi.scanNetworks(false, false);
  if (n <= 0) { server.send(200,"application/json","[]"); return; }
  String json = "[";
  for (int i=0;i<n;i++) {
    if (i>0) json+=",";
    String s=WiFi.SSID(i); s.replace("\\","\\\\"); s.replace("\"","\\\"");
    json+="{\"ssid\":\""+s+"\",\"rssi\":"+String(WiFi.RSSI(i))+"}";
  }
  json+="]"; WiFi.scanDelete(); server.send(200,"application/json",json);
}

void handleEffect() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!server.hasArg("type")) { server.send(400,"text/plain","MISSING type"); return; }
  String type=server.arg("type"); activeEffect=type; effectStep=0;
  if (server.hasArg("r"))     effectR    =constrain(server.arg("r").toInt(),0,255);
  if (server.hasArg("g"))     effectG    =constrain(server.arg("g").toInt(),0,255);
  if (server.hasArg("b"))     effectB    =constrain(server.arg("b").toInt(),0,255);
  if (server.hasArg("speed")) effectSpeed=constrain(server.arg("speed").toInt(),0,255);
  if (type=="meteor")  for(int i=0;i<NUM_LEDS;i++) meteorTrail[i]=CRGB::Black;
  if (type=="twinkle") for(int i=0;i<NUM_LEDS;i++) twinkleBri[i]=random8();
  if (type=="off") { if(ledIsOn) applyCurrentColor(); else { for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black; FastLED.show(); } }
  else { ledIsOn=true; }
  server.send(200,"application/json","{\"effect\":\""+type+"\",\"speed\":"+String(effectSpeed)+"}");
}

void handleSetPin() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!server.hasArg("new_pin")||server.arg("new_pin").length()<4) { server.send(400,"application/json","{\"error\":\"pin_too_short\"}"); return; }
  devicePin=server.arg("new_pin"); prefs.begin("security",false); prefs.putString("pin",devicePin); prefs.end();
  server.send(200,"application/json","{\"status\":\"pin_updated\"}");
}

void handleFactoryReset() {
  addCORSHeaders(); if (!checkPIN()) return;
  server.send(200,"application/json","{\"status\":\"resetting\"}"); delay(300); factoryReset();
}

void handleOtaCheck() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (WiFi.status() != WL_CONNECTED) { server.send(503,"application/json","{\"available\":false,\"error\":\"no_wifi\"}"); return; }
  OTACheckResult result = checkForUpdate();
  if (result.available) {
    String escapedNotes = result.notes; escapedNotes.replace("\"","\\\"");
    server.send(200,"application/json","{\"available\":true,\"current\":\""+String(FIRMWARE_VERSION)+"\",\"latest\":\""+result.newVersion+"\",\"notes\":\""+escapedNotes+"\"}");
  } else {
    server.send(200,"application/json","{\"available\":false,\"current\":\""+String(FIRMWARE_VERSION)+"\",\"latest\":\""+String(FIRMWARE_VERSION)+"\"}");
  }
}

void handleOtaUpdate() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (WiFi.status() != WL_CONNECTED) { server.send(503,"application/json","{\"status\":\"error\",\"error\":\"no_wifi\"}"); return; }
  if (otaInProgress) { server.send(409,"application/json","{\"status\":\"already_updating\"}"); return; }
  server.send(200,"application/json","{\"status\":\"updating\",\"current\":\""+String(FIRMWARE_VERSION)+"\"}");
  delay(100);
  OTACheckResult result = checkForUpdate();
  if (!result.available) { Serial.println("OTA: Güncelleme yok, iptal"); return; }
  applyUpdate(result.binUrl);
}

// ── Fade (Uyku Modu) endpoint'leri ───────────────────────────────────────────
void handleFade() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!server.hasArg("duration")) { server.send(400,"application/json","{\"error\":\"missing duration\"}"); return; }
  if (server.hasArg("cancel") && server.arg("cancel") == "1") {
    fadeActive = false;
    server.send(200,"application/json","{\"status\":\"cancelled\"}"); return;
  }
  long duration = server.arg("duration").toInt();
  if (duration <= 0) { server.send(400,"application/json","{\"error\":\"invalid duration\"}"); return; }
  fadeActive     = true;
  fadeDurationMs = duration * 1000L;
  fadeStartMs    = millis();
  fadeStartBri   = currentBrightness;
  fadeTargetBri  = server.hasArg("target") ? constrain(server.arg("target").toInt(), 0, 255) : 0;
  fadeOffAtEnd   = (fadeTargetBri == 0);
  if (!ledIsOn) { activeEffect = "off"; ledIsOn = true; applyCurrentColor(); }
  Serial.printf("🌙 Fade başladı: %ld sn, %d→%d\n", duration, fadeStartBri, fadeTargetBri);
  server.send(200,"application/json",
    "{\"status\":\"started\",\"duration\":"+String(duration)+
    ",\"from\":"+String(fadeStartBri)+",\"to\":"+String(fadeTargetBri)+"}");
}

void handleFadeState() {
  addCORSHeaders(); if (!checkPIN()) return;
  if (!fadeActive) { server.send(200,"application/json","{\"active\":false}"); return; }
  long elapsed   = millis() - fadeStartMs;
  long remaining = max(0L, (fadeDurationMs - elapsed) / 1000L);
  int  progress  = (int)min(100L, elapsed * 100L / fadeDurationMs);
  server.send(200,"application/json",
    "{\"active\":true,\"remaining\":"+String(remaining)+
    ",\"progress\":"+String(progress)+",\"current\":"+String(currentBrightness)+"}");
}

void runFade() {
  if (!fadeActive || otaInProgress) return;
  long elapsed = millis() - fadeStartMs;
  if (elapsed >= fadeDurationMs) {
    fadeActive = false;
    currentBrightness = fadeTargetBri;
    if (fadeOffAtEnd) {
      activeEffect = "off"; ledIsOn = false;
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
      FastLED.show();
      Serial.println("🌙 Fade tamamlandı — ışık kapatıldı");
    } else { FastLED.setBrightness(currentBrightness); FastLED.show(); }
    return;
  }
  float t = (float)elapsed / (float)fadeDurationMs;
  uint8_t newBri = (uint8_t)(fadeStartBri + (fadeTargetBri - fadeStartBri) * t);
  if (newBri != currentBrightness) {
    currentBrightness = newBri;
    FastLED.setBrightness(currentBrightness);
    FastLED.show();
  }
}

// ── Automation ────────────────────────────────────────────────────────────────
void saveRules() {
  prefs.begin("automation",false); prefs.putInt("count",ruleCount);
  for(int i=0;i<ruleCount;i++){String key="rule"+String(i);prefs.putBytes(key.c_str(),&rules[i],sizeof(AutomationRule));} prefs.end();
}
void loadRules() {
  prefs.begin("automation",true); ruleCount=prefs.getInt("count",0);
  for(int i=0;i<ruleCount;i++){String key="rule"+String(i);prefs.getBytes(key.c_str(),&rules[i],sizeof(AutomationRule));} prefs.end();
}

void handleAutomationList() {
  addCORSHeaders(); if (!checkPIN()) return;
  String json="[";
  for(int i=0;i<ruleCount;i++){
    if(i>0) json+=",";
    json+="{\"id\":\""+String(rules[i].id)+"\","
         "\"active\":"+String(rules[i].active?"true":"false")+","
         "\"type\":"+String(rules[i].type)+","
         "\"hour\":"+String(rules[i].hour)+","
         "\"minute\":"+String(rules[i].minute)+","
         "\"action\":"+String(rules[i].action)+","
         "\"triggerAt\":"+String(rules[i].triggerAt)+"}";
  }
  json+="]"; server.send(200,"application/json",json);
}

void handleAutomationAdd() {
  addCORSHeaders(); if (!checkPIN()) return;
  if(ruleCount>=MAX_RULES){server.send(400,"text/plain","MAX_RULES");return;}
  if(!server.hasArg("type")||!server.hasArg("action")){server.send(400,"text/plain","MISSING");return;}
  AutomationRule r; memset(&r,0,sizeof(r));
  snprintf(r.id,sizeof(r.id),"%04lx%04d",millis()&0xFFFF,ruleCount);
  r.active=true; r.type=server.arg("type").toInt(); r.action=server.arg("action").toInt();
  if(r.type==0){
    if(!server.hasArg("hour")||!server.hasArg("minute")){server.send(400,"text/plain","MISSING hour/min");return;}
    r.hour=server.arg("hour").toInt(); r.minute=server.arg("minute").toInt();
  } else {
    if(!server.hasArg("countdown")){server.send(400,"text/plain","MISSING countdown");return;}
    r.triggerAt=(long)time(nullptr)+server.arg("countdown").toInt();
  }
  rules[ruleCount++]=r; saveRules();
  server.send(200,"application/json","{\"id\":\""+String(r.id)+"\"}");
}

void handleAutomationDelete() {
  addCORSHeaders(); if (!checkPIN()) return;
  if(!server.hasArg("id")){server.send(400,"text/plain","MISSING id");return;}
  String tid=server.arg("id"); int found=-1;
  for(int i=0;i<ruleCount;i++) if(String(rules[i].id)==tid){found=i;break;}
  if(found==-1){server.send(404,"text/plain","NOT FOUND");return;}
  for(int i=found;i<ruleCount-1;i++) rules[i]=rules[i+1];
  ruleCount--; saveRules(); server.send(200,"application/json","{\"status\":\"deleted\"}");
}

void handleAutomationToggle() {
  addCORSHeaders(); if (!checkPIN()) return;
  if(!server.hasArg("id")){server.send(400,"text/plain","MISSING id");return;}
  String tid=server.arg("id");
  for(int i=0;i<ruleCount;i++){
    if(String(rules[i].id)==tid){
      rules[i].active=!rules[i].active; saveRules();
      server.send(200,"application/json","{\"active\":"+String(rules[i].active?"true":"false")+"}"); return;
    }
  }
  server.send(404,"text/plain","NOT FOUND");
}

void handleAutomationTime() {
  addCORSHeaders(); if (!checkPIN()) return;
  time_t now=time(nullptr); struct tm* t=localtime(&now);
  char buf[64]; snprintf(buf,sizeof(buf),"{\"hour\":%d,\"minute\":%d,\"second\":%d,\"unix\":%ld}",t->tm_hour,t->tm_min,t->tm_sec,(long)now);
  server.send(200,"application/json",String(buf));
}

unsigned long lastCheckMs = 0;
void checkAutomation() {
  if(millis()-lastCheckMs<1000) return; lastCheckMs=millis();
  time_t now=time(nullptr); struct tm* t=localtime(&now);
  for(int i=0;i<ruleCount;i++){
    if(!rules[i].active) continue;
    bool shouldTrigger=false;
    if(rules[i].type==0){
      if(t->tm_hour==rules[i].hour&&t->tm_min==rules[i].minute&&t->tm_sec<5&&!rules[i].triggered){shouldTrigger=rules[i].triggered=true;}
      if(t->tm_min!=rules[i].minute) rules[i].triggered=false;
    } else {
      if((long)now>=rules[i].triggerAt&&!rules[i].triggered){shouldTrigger=rules[i].triggered=true;rules[i].active=false;saveRules();}
    }
    if(shouldTrigger){
      if(rules[i].action==1){activeEffect="off";ledIsOn=true;applyCurrentColor();}
      else{activeEffect="off";ledIsOn=false;for(int j=0;j<NUM_LEDS;j++) leds[j]=CRGB::Black;FastLED.show();}
    }
  }
}

void runEffects() {
  // Fade aktifken efekt çalıştırma
  if(activeEffect=="off"||otaInProgress||fadeActive) return;
  unsigned long now=millis(); unsigned long frameMs=speedToMs(effectSpeed);
  if(activeEffect=="rainbow"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CHSV((effectStep+(i*256/NUM_LEDS))%256,255,currentBrightness);
    FastLED.show(); effectStep=(effectStep+2)%256;
  } else if(activeEffect=="breathe"){
    if(now-lastEffectMs<frameMs/3) return; lastEffectMs=now;
    float rad=(effectStep/255.0f)*2.0f*PI; uint8_t bri=(uint8_t)((sin(rad)*0.5f+0.5f)*currentBrightness);
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);
    FastLED.show(); effectStep=(effectStep+1)%256;
  } else if(activeEffect=="wave"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){float phase=(float)(effectStep+i*10)/255.0f*2.0f*PI;uint8_t bri=(uint8_t)((sin(phase)*0.5f+0.5f)*currentBrightness);leds[i]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);}
    FastLED.show(); effectStep=(effectStep+3)%256;
  } else if(activeEffect=="fire"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){uint8_t fl=random8(120,255);uint8_t g=random8(0,60);leds[i]=CRGB((fl*currentBrightness)/255,(g*currentBrightness)/255,0);}
    FastLED.show(); effectStep++;
  } else if(activeEffect=="meteor"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){if(meteorTrail[i].r>20)meteorTrail[i].r-=20;else meteorTrail[i].r=0;if(meteorTrail[i].g>20)meteorTrail[i].g-=20;else meteorTrail[i].g=0;if(meteorTrail[i].b>20)meteorTrail[i].b-=20;else meteorTrail[i].b=0;}
    int pos=effectStep%(NUM_LEDS+10);
    if(pos<NUM_LEDS){meteorTrail[pos]=CRGB(effectR,effectG,effectB);if(pos>0)meteorTrail[pos-1]=CRGB(effectR/2,effectG/2,effectB/2);if(pos>1)meteorTrail[pos-2]=CRGB(effectR/4,effectG/4,effectB/4);}
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB((meteorTrail[i].r*currentBrightness)/255,(meteorTrail[i].g*currentBrightness)/255,(meteorTrail[i].b*currentBrightness)/255);
    FastLED.show(); effectStep++;
  } else if(activeEffect=="twinkle"){
    if(now-lastEffectMs<frameMs/4) return; lastEffectMs=now;
    for(int j=0;j<3;j++) twinkleBri[random8(NUM_LEDS)]=random8(200,255);
    for(int i=0;i<NUM_LEDS;i++){uint8_t bri=(twinkleBri[i]*currentBrightness)/255;leds[i]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);if(twinkleBri[i]>10)twinkleBri[i]-=10;else twinkleBri[i]=0;}
    FastLED.show(); effectStep++;
  } else if(activeEffect=="strobe"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    bool on=(effectStep%2==0);
    for(int i=0;i<NUM_LEDS;i++) leds[i]=on?CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255):CRGB::Black;
    FastLED.show(); effectStep++;
  } else if(activeEffect=="comet"){
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black;
    int head=effectStep%(NUM_LEDS*2); int pos=head<NUM_LEDS?head:NUM_LEDS*2-head;
    for(int t=0;t<8&&pos-t>=0&&pos-t<NUM_LEDS;t++){uint8_t fade=(uint8_t)(255-t*30);uint8_t bri=(fade*currentBrightness)/255;leds[pos-t]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);}
    FastLED.show(); effectStep++;
  } else if(activeEffect=="theater"){
    if(now-lastEffectMs<frameMs*3) return; lastEffectMs=now;
    int offset=effectStep%3;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=((i+offset)%3==0)?CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255):CRGB::Black;
    FastLED.show(); effectStep++;
  } else if(activeEffect=="pulse"){
    if(now-lastEffectMs<frameMs/4) return; lastEffectMs=now;
    float rad=(effectStep/255.0f)*2.0f*PI; uint8_t bri=(uint8_t)((sin(rad)*0.5f+0.5f)*currentBrightness);
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);
    FastLED.show(); effectStep=(effectStep+2)%256;

  // ── Yeni efektler ──────────────────────────────────────────────────────────

  } else if(activeEffect=="colorCycle"){
    // Tek renk yavaşça başka renge geçer (hue sweep)
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    CRGB c = CHSV(effectStep, 255, currentBrightness);
    for(int i=0;i<NUM_LEDS;i++) leds[i]=c;
    FastLED.show(); effectStep=(effectStep+1)%256;

  } else if(activeEffect=="gradient"){
    // Şeridin bir ucundan diğerine renk geçişi
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){
      uint8_t hue=(effectStep+(i*256/NUM_LEDS))%256;
      uint8_t bri=currentBrightness;
      leds[i]=CHSV(hue,255,bri);
    }
    FastLED.show(); effectStep=(effectStep+1)%256;

  } else if(activeEffect=="wipe"){
    // Renk bir uçtan diğerine süpürür, sonra sıfırlanır
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    int pos=effectStep%((NUM_LEDS+1)*2);
    if(pos<=NUM_LEDS){
      if(pos>0) leds[pos-1]=CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255);
    } else {
      int clearPos=pos-NUM_LEDS-1;
      if(clearPos<NUM_LEDS) leds[clearPos]=CRGB::Black;
    }
    FastLED.show(); effectStep++;

  } else if(activeEffect=="bouncing"){
    // Işık noktası ileri geri sekip durur
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black;
    int cycle=effectStep%(NUM_LEDS*2);
    int pos=cycle<NUM_LEDS?cycle:NUM_LEDS*2-cycle-1;
    pos=constrain(pos,0,NUM_LEDS-1);
    leds[pos]=CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255);
    if(pos>0) leds[pos-1]=CRGB((effectR*currentBrightness/3)/255,(effectG*currentBrightness/3)/255,(effectB*currentBrightness/3)/255);
    if(pos<NUM_LEDS-1) leds[pos+1]=CRGB((effectR*currentBrightness/3)/255,(effectG*currentBrightness/3)/255,(effectB*currentBrightness/3)/255);
    FastLED.show(); effectStep++;

  } else if(activeEffect=="scanner"){
    // Knight Rider tarzı sağa sola tarama
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black;
    int cycle=effectStep%(NUM_LEDS*2-2);
    int pos=cycle<NUM_LEDS?cycle:NUM_LEDS*2-2-cycle;
    pos=constrain(pos,0,NUM_LEDS-1);
    for(int t=0;t<5;t++){
      int p=pos-t; if(p<0) break;
      uint8_t fade=255-t*50;
      leds[p]=CRGB((effectR*currentBrightness/255*fade)/255,(effectG*currentBrightness/255*fade)/255,(effectB*currentBrightness/255*fade)/255);
    }
    FastLED.show(); effectStep++;

  } else if(activeEffect=="chase"){
    // Birden fazla ışık noktası peş peşe koşar
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black;
    for(int dot=0;dot<3;dot++){
      int pos=(effectStep+dot*(NUM_LEDS/3))%NUM_LEDS;
      leds[pos]=CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255);
      if(pos>0) leds[pos-1]=CRGB((effectR*currentBrightness/4)/255,(effectG*currentBrightness/4)/255,(effectB*currentBrightness/4)/255);
    }
    FastLED.show(); effectStep=(effectStep+1)%NUM_LEDS;

  } else if(activeEffect=="ripple"){
    // Orta noktadan dalgalar yayılır
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){
      int dist=abs(i-NUM_LEDS/2);
      int wave=(effectStep-dist*3+256)%256;
      float bri=((float)sin8(wave))/255.0f*currentBrightness;
      leds[i]=CRGB((effectR*bri)/255,(effectG*bri)/255,(effectB*bri)/255);
    }
    FastLED.show(); effectStep=(effectStep+4)%256;

  } else if(activeEffect=="sparkle"){
    // Rastgele tek piksel anında parlar ve söner
    if(now-lastEffectMs<frameMs/4) return; lastEffectMs=now;
    // Önce tümünü karart
    for(int i=0;i<NUM_LEDS;i++){
      if(leds[i].r>10) leds[i].r-=10; else leds[i].r=0;
      if(leds[i].g>10) leds[i].g-=10; else leds[i].g=0;
      if(leds[i].b>10) leds[i].b-=10; else leds[i].b=0;
    }
    // Rastgele 2 piksel yak
    for(int k=0;k<2;k++){
      int p=random8(NUM_LEDS);
      leds[p]=CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255);
    }
    FastLED.show(); effectStep++;

  } else if(activeEffect=="noise"){
    // Perlin noise ile organik dalgalanma
    if(now-lastEffectMs<frameMs/2) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){
      uint8_t n=inoise8(i*30, effectStep*3);
      uint8_t hue=(effectStep+n/2)%256;
      uint8_t bri=(n*currentBrightness)/255;
      leds[i]=CHSV(hue,220,bri);
    }
    FastLED.show(); effectStep++;

  } else if(activeEffect=="larsonScanner"){
    // Soldan sağa gidip dönen yumuşak ışık topu
    if(now-lastEffectMs<frameMs) return; lastEffectMs=now;
    for(int i=0;i<NUM_LEDS;i++){
      leds[i].nscale8(180); // yavaş söndür
    }
    int cycle=effectStep%(NUM_LEDS*2-2);
    int pos=cycle<NUM_LEDS?cycle:NUM_LEDS*2-2-cycle;
    pos=constrain(pos,0,NUM_LEDS-1);
    leds[pos]=CRGB((effectR*currentBrightness)/255,(effectG*currentBrightness)/255,(effectB*currentBrightness)/255);
    FastLED.show(); effectStep++;

  } else if(activeEffect=="confetti"){
    // Rastgele renk ve konumda sürekli patlamalar
    if(now-lastEffectMs<frameMs/3) return; lastEffectMs=now;
    // Tüm pikselleri hafif karart
    fadeToBlackBy(leds, NUM_LEDS, 10);
    // Rastgele yeni piksel ekle
    int p=random8(NUM_LEDS);
    leds[p]=CHSV((effectStep+random8(64))%256, 200, currentBrightness);
    FastLED.show(); effectStep=(effectStep+1)%256;

  } else if(activeEffect=="juggle"){
    // Birbirinden bağımsız farklı hızlarda birkaç top
    if(now-lastEffectMs<frameMs/2) return; lastEffectMs=now;
    fadeToBlackBy(leds, NUM_LEDS, 20);
    for(int i=0;i<4;i++){
      int pos=beatsin8(i+3, 0, NUM_LEDS-1, 0, i*64);
      leds[pos]|=CHSV((effectStep+(i*64))%256, 200, currentBrightness);
    }
    FastLED.show(); effectStep=(effectStep+1)%256;

  } else if(activeEffect=="bpm"){
    // Ritme senkron nabız atışı
    if(now-lastEffectMs<frameMs/4) return; lastEffectMs=now;
    uint8_t beat=beatsin8(120, 64, 255);
    for(int i=0;i<NUM_LEDS;i++){
      leds[i]=CHSV((effectStep+(i*2))%256, 255, (beat*currentBrightness)/255);
    }
    FastLED.show(); effectStep=(effectStep+1)%256;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.printf("\n=== Torva Smart Light v%s ===\n", FIRMWARE_VERSION);
  pinMode(GPIO_RESET_PIN, INPUT_PULLUP);
  FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(currentBrightness);
  for(int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black;
  FastLED.show();
  prefs.begin("wifi",true); ssid=prefs.getString("ssid",""); password=prefs.getString("pass",""); prefs.end();
  prefs.begin("security",true); devicePin=prefs.getString("pin",""); prefs.end();
  loadOrInitParts();
  Serial.printf("PIN koruması: %s\n", devicePin!=""?"AKTİF":"KAPALI");
  if(ssid=="") startAP(); else connectToWiFi();
  loadRules();

  server.on("/setup",             handleSetup);
  server.on("/whoami",            handleWhoAmI);
  server.on("/pin/set",           handleSetPin);
  server.on("/led/on",            handleLedOn);
  server.on("/led/off",           handleLedOff);
  server.on("/led/brightness",    handleBrightness);
  server.on("/led/color",         handleColor);
  server.on("/led/state",         handleState);
  server.on("/wifi/scan",         handleWifiScan);
  server.on("/effect",            handleEffect);
  server.on("/factory-reset",     handleFactoryReset);
  server.on("/ota/check",         handleOtaCheck);
  server.on("/ota/update",        handleOtaUpdate);
  server.on("/led/fade",          handleFade);
  server.on("/led/fade/state",    handleFadeState);
  server.on("/automation/list",   handleAutomationList);
  server.on("/automation/add",    handleAutomationAdd);
  server.on("/automation/delete", handleAutomationDelete);
  server.on("/automation/toggle", handleAutomationToggle);
  server.on("/automation/time",   handleAutomationTime);

  server.begin();
  Serial.println("Server başladı");
}

void loop() {
  if(!otaInProgress) {
    server.handleClient();
    runEffects();
    runFade();
    checkAutomation();
    checkResetButton();
  }
}
