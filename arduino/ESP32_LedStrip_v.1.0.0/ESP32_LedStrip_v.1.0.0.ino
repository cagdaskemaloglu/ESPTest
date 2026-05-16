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

// ── Firmware sürümü ───────────────────────────────────────────────────────────
// Her güncellemede bu sabiti artır
#define FIRMWARE_VERSION "1.0.0"

// version.json URL — public repo
#define VERSION_JSON_URL "https://raw.githubusercontent.com/cagdaskemaloglu/torva-firmware/main/version.json"

// ── WS2812B ──────────────────────────────────────────────────────────────────
#define LED_PIN   2
#define NUM_LEDS  30

CRGB leds[NUM_LEDS];
int     currentBrightness = 255;
uint8_t currentR = 255, currentG = 255, currentB = 255;
bool    ledIsOn  = false;

// ── Brute force koruma ────────────────────────────────────────────────────────
#define MAX_FAILED_ATTEMPTS 5
#define LOCKOUT_DURATION_MS 30000

int           failedAttempts = 0;
unsigned long lockoutStart   = 0;
bool          isLockedOut    = false;

// ── Efekt sistemi ─────────────────────────────────────────────────────────────
String   activeEffect = "off";
uint8_t  effectR = 0, effectG = 150, effectB = 255;
uint8_t  effectSpeed = 128;
unsigned long lastEffectMs = 0;
uint16_t effectStep = 0;
CRGB     meteorTrail[NUM_LEDS];
uint8_t  twinkleBri[NUM_LEDS];

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

// ── Fiziksel reset butonu ─────────────────────────────────────────────────────
#define GPIO_RESET_PIN  0
#define RESET_HOLD_MS   3000
unsigned long resetPressStart = 0;
bool          resetArmed      = false;

// ── OTA durum ────────────────────────────────────────────────────────────────
bool otaInProgress = false;

// OTA kontrol sonucu — checkForUpdate() tarafından döndürülür
struct OTACheckResult {
  bool   available;
  String newVersion;
  String binUrl;
  String notes;
};

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

// ── Sürüm karşılaştırma ───────────────────────────────────────────────────────
// "1.0.0" formatındaki sürümleri karşılaştırır
// Döner: -1 (a < b), 0 (a == b), 1 (a > b)
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

// ── OTA: Güncelleme kontrolü ─────────────────────────────────────────────────
// version.json'u çeker, yeni sürüm var mı kontrol eder
OTACheckResult checkForUpdate() {
  OTACheckResult result = { false, "", "", "" };

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("OTA: WiFi bağlı değil");
    return result;
  }

  Serial.println("OTA: Sürüm kontrolü başlıyor...");
  Serial.println("OTA: URL = " + String(VERSION_JSON_URL));

  HTTPClient http;
  http.begin(VERSION_JSON_URL);
  http.setTimeout(10000);

  int httpCode = http.GET();
  Serial.printf("OTA: HTTP kodu = %d\n", httpCode);

  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("OTA: HTTP hatası %d\n", httpCode);
    http.end();
    return result;
  }

  String payload = http.getString();
  http.end();
  Serial.println("OTA: Yanıt = " + payload);

  // JSON parse
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("OTA: JSON parse hatası");
    return result;
  }

  String remoteVersion = doc["version"] | "";
  String binUrl        = doc["url"]     | "";
  String notes         = doc["notes"]   | "";

  Serial.printf("OTA: Mevcut = %s, Uzak = %s\n", FIRMWARE_VERSION, remoteVersion.c_str());

  if (remoteVersion.isEmpty() || binUrl.isEmpty()) {
    Serial.println("OTA: Geçersiz version.json");
    return result;
  }

  if (compareVersions(String(FIRMWARE_VERSION), remoteVersion) < 0) {
    Serial.printf("OTA: Güncelleme mevcut! %s → %s\n", FIRMWARE_VERSION, remoteVersion.c_str());
    result.available   = true;
    result.newVersion  = remoteVersion;
    result.binUrl      = binUrl;
    result.notes       = notes;
  } else {
    Serial.println("OTA: Güncel, güncelleme yok");
  }

  return result;
}

// ── OTA: Güncelleme uygula ────────────────────────────────────────────────────
// .bin dosyasını indirir ve flash'a yazar
// Güncelleme sırasında LED'ler mavi yanıp söner
bool applyUpdate(const String& binUrl) {
  Serial.println("OTA: Güncelleme başlıyor...");
  otaInProgress = true;

  // Güncelleme sırasında LED geri bildirimi
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, 0, 50);
  FastLED.show();

  HTTPClient http;
  http.begin(binUrl);
  http.setTimeout(60000); // 60 saniye — büyük dosyalar için

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("OTA: .bin indirme hatası %d\n", httpCode);
    http.end();
    otaInProgress = false;
    return false;
  }

  int contentLength = http.getSize();
  Serial.printf("OTA: Dosya boyutu = %d bytes\n", contentLength);

  if (contentLength <= 0) {
    Serial.println("OTA: Geçersiz dosya boyutu");
    http.end();
    otaInProgress = false;
    return false;
  }

  // Flash'a yaz
  if (!Update.begin(contentLength)) {
    Serial.println("OTA: Update.begin hatası — yeterli alan yok");
    http.end();
    otaInProgress = false;
    return false;
  }

  // İlerleme callback — LED'i yanıp söndür
  Update.onProgress([](size_t done, size_t total) {
    int pct = (done * 100) / total;
    Serial.printf("OTA: %%%d\n", pct);
    // Her %10'da LED rengi değiştir
    if (pct % 10 == 0) {
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = (pct / 10 % 2 == 0) ? CRGB(0, 0, 80) : CRGB::Black;
      }
      FastLED.show();
    }
  });

  WiFiClient& stream  = http.getStream();
  size_t written      = Update.writeStream(stream);
  http.end();

  if (written != (size_t)contentLength) {
    Serial.printf("OTA: Yazma hatası — beklenen %d, yazılan %d\n", contentLength, written);
    Update.abort();
    otaInProgress = false;
    return false;
  }

  if (!Update.end()) {
    Serial.printf("OTA: Update.end hatası: %s\n", Update.errorString());
    otaInProgress = false;
    return false;
  }

  Serial.println("OTA: Güncelleme başarılı! Yeniden başlatılıyor...");

  // Başarı LED animasyonu
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, 80, 0);
  FastLED.show();
  delay(1000);

  ESP.restart();
  return true; // Buraya ulaşılmaz
}

// ── PIN doğrulama ─────────────────────────────────────────────────────────────
bool checkPIN() {
  if (isLockedOut) {
    unsigned long elapsed = millis() - lockoutStart;
    if (elapsed < LOCKOUT_DURATION_MS) {
      unsigned long remaining = (LOCKOUT_DURATION_MS - elapsed) / 1000;
      server.send(429, "application/json",
        "{\"error\":\"too_many_attempts\",\"retry_after\":" + String(remaining) + "}");
      return false;
    } else {
      isLockedOut = false; failedAttempts = 0;
    }
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
    server.send(403, "application/json",
      "{\"error\":\"invalid_pin\",\"attempts_left\":" + String(MAX_FAILED_ATTEMPTS - failedAttempts) + "}");
  }
  return false;
}

// ── Fabrika sıfırlama ─────────────────────────────────────────────────────────
void factoryReset() {
  Serial.println("FABRIKA SIFIRLAMASI...");
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0);
  FastLED.show(); delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show(); delay(200);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(255, 0, 0);
  FastLED.show(); delay(500);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  prefs.begin("wifi",       false); prefs.clear(); prefs.end();
  prefs.begin("automation", false); prefs.clear(); prefs.end();
  prefs.begin("security",   false); prefs.clear(); prefs.end();
  delay(500);
  ESP.restart();
}

// ── Fiziksel buton ────────────────────────────────────────────────────────────
void checkResetButton() {
  bool pressed = (digitalRead(GPIO_RESET_PIN) == LOW);
  if (pressed && !resetArmed) { resetPressStart = millis(); resetArmed = true; }
  if (resetArmed && pressed) {
    unsigned long held = millis() - resetPressStart;
    if (held > 1000 && held < 2000) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 300 < 150) ? CRGB(255, 150, 0) : CRGB::Black;
      FastLED.show();
    } else if (held >= 2000 && held < RESET_HOLD_MS) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = (held % 200 < 100) ? CRGB(255, 0, 0) : CRGB::Black;
      FastLED.show();
    } else if (held >= RESET_HOLD_MS) { factoryReset(); }
  }
  if (resetArmed && !pressed) {
    resetArmed = false;
    if (ledIsOn && activeEffect == "off") applyCurrentColor();
    else if (!ledIsOn) { for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black; FastLED.show(); }
  }
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void startAP() { WiFi.softAP("ESP32-Setup"); Serial.println("AP: " + WiFi.softAPIP().toString()); }

void connectToWiFi() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting");
  int retry = 0;
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
  server.send(200, "application/json",
    "{\"device\":\"esp32-light\","
    "\"type\":\"ws2812b\","
    "\"capabilities\":[\"on_off\",\"brightness\",\"color\",\"effects\"],"
    "\"leds\":" + String(NUM_LEDS) + ","
    "\"pin_required\":" + String(devicePin != "" ? "true" : "false") + ","
    "\"firmware\":\"" + String(FIRMWARE_VERSION) + "\"}");
}

void handleLedOn()  { addCORSHeaders(); if (!checkPIN()) return; activeEffect = "off"; ledIsOn = true;  applyCurrentColor(); server.send(200, "text/plain", "OK"); }
void handleLedOff() { addCORSHeaders(); if (!checkPIN()) return; activeEffect = "off"; ledIsOn = false; for (int i=0;i<NUM_LEDS;i++) leds[i]=CRGB::Black; FastLED.show(); server.send(200,"text/plain","OK"); }

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

// ── YENİ: OTA endpoint'leri ───────────────────────────────────────────────────

// GET /ota/check
// GitHub'dan version.json çeker, güncelleme var mı kontrol eder.
// PIN korumalı.
// Yanıt:
//   Güncelleme varsa:  {"available":true,  "current":"1.0.0","latest":"1.0.1","notes":"..."}
//   Güncel ise:        {"available":false, "current":"1.0.0","latest":"1.0.0"}
//   Hata:              {"available":false, "error":"..."}
void handleOtaCheck() {
  addCORSHeaders();
  if (!checkPIN()) return;

  if (WiFi.status() != WL_CONNECTED) {
    server.send(503, "application/json", "{\"available\":false,\"error\":\"no_wifi\"}");
    return;
  }

  OTACheckResult result = checkForUpdate();

  if (result.available) {
    String escapedNotes = result.notes;
    escapedNotes.replace("\"", "\\\"");
    server.send(200, "application/json",
      "{\"available\":true"
      ",\"current\":\"" + String(FIRMWARE_VERSION) + "\""
      ",\"latest\":\""  + result.newVersion + "\""
      ",\"notes\":\""   + escapedNotes + "\"}");
  } else {
    server.send(200, "application/json",
      "{\"available\":false"
      ",\"current\":\"" + String(FIRMWARE_VERSION) + "\""
      ",\"latest\":\""  + String(FIRMWARE_VERSION) + "\"}");
  }
}

// GET /ota/update
// Güncellemeyi başlatır — .bin indirilir ve flash'a yazılır.
// Bu işlem ~30-60 saniye sürer, ESP32 cevap vermez.
// Tamamlanınca ESP32 otomatik restart eder.
// PIN korumalı.
void handleOtaUpdate() {
  addCORSHeaders();
  if (!checkPIN()) return;

  if (WiFi.status() != WL_CONNECTED) {
    server.send(503, "application/json", "{\"status\":\"error\",\"error\":\"no_wifi\"}");
    return;
  }

  if (otaInProgress) {
    server.send(409, "application/json", "{\"status\":\"already_updating\"}");
    return;
  }

  // Yanıtı hemen gönder — güncelleme başlamadan önce
  // (güncelleme sırasında server cevap veremez)
  server.send(200, "application/json",
    "{\"status\":\"updating\","
    "\"current\":\"" + String(FIRMWARE_VERSION) + "\"}");

  delay(100); // Yanıtın gönderilmesini bekle

  // Güncelleme kontrol et ve uygula
  OTACheckResult result = checkForUpdate();

  if (!result.available) {
    Serial.println("OTA: Güncelleme yok, iptal");
    return;
  }

  applyUpdate(result.binUrl);
  // applyUpdate() restart eder, buraya ulaşılmaz
}

// ── Automation endpoint'leri ──────────────────────────────────────────────────
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

// ── Automation loop ───────────────────────────────────────────────────────────
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

// ── Efekt frame'leri ──────────────────────────────────────────────────────────
void runEffects() {
  if(activeEffect=="off"||otaInProgress) return;
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
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────
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
  server.on("/ota/check",         handleOtaCheck);   // ← YENİ
  server.on("/ota/update",        handleOtaUpdate);  // ← YENİ
  server.on("/automation/list",   handleAutomationList);
  server.on("/automation/add",    handleAutomationAdd);
  server.on("/automation/delete", handleAutomationDelete);
  server.on("/automation/toggle", handleAutomationToggle);
  server.on("/automation/time",   handleAutomationTime);

  server.begin();
  Serial.println("Server başladı");
}

// ── loop ─────────────────────────────────────────────────────────────────────
void loop() {
  if(!otaInProgress) {
    server.handleClient();
    runEffects();
    checkAutomation();
    checkResetButton();
  }
}

