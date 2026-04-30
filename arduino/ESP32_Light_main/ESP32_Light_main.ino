#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>

WebServer server(80);
Preferences prefs;

String ssid     = "";
String password = "";

// ── PWM ayarları ─────────────────────────────────────────────────────────────
const int LED_PIN      = 2;
const int PWM_FREQ     = 5000;
const int PWM_RES_BITS = 8;      // 0-255

int currentBrightness = 255;
// ─────────────────────────────────────────────────────────────────────────────

// ── Automation veri yapısı ───────────────────────────────────────────────────
// Her kural maksimum 8 karakter ID, tip, saat/dakika ve aksiyon tutar.
// ESP32'nin belleği kısıtlı olduğu için maksimum 10 kural destekleniyor.

#define MAX_RULES 10

struct AutomationRule {
  char   id[9];       // Benzersiz 8 karakter ID (örn. "a1b2c3d4")
  bool   active;      // Kural aktif mi?
  int    type;        // 0 = günlük zamanlayıcı, 1 = tek seferlik countdown
  int    hour;        // type=0 için saat (0-23)
  int    minute;      // type=0 için dakika (0-59)
  int    action;      // 0 = kapat, 1 = aç
  long   triggerAt;   // type=1 için Unix timestamp (ne zaman tetiklenecek)
  bool   triggered;   // type=1: daha önce tetiklendi mi?
};

AutomationRule rules[MAX_RULES];
int ruleCount = 0;
// ─────────────────────────────────────────────────────────────────────────────

// ── Yardımcı: kuralları Preferences'a kaydet ─────────────────────────────────
void saveRules() {
  prefs.begin("automation", false);
  prefs.putInt("count", ruleCount);
  for (int i = 0; i < ruleCount; i++) {
    String key = "rule" + String(i);
    prefs.putBytes(key.c_str(), &rules[i], sizeof(AutomationRule));
  }
  prefs.end();
}

// ── Yardımcı: kuralları Preferences'tan yükle ────────────────────────────────
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

// ── Yardımcı: CORS header ekle (React Native fetch için gerekli) ─────────────
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── Mevcut WiFi fonksiyonları — dokunulmadı ───────────────────────────────────
void startAP() {
  WiFi.softAP("ESP32-Light");
  Serial.println("AP MODE BASLADI");
  Serial.println(WiFi.softAPIP());
}

void connectToWiFi() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nCONNECTED!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    // WiFi bağlantısı kurulunca NTP ile saati senkronize et
    // "Europe/Istanbul" = UTC+3
    configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("NTP senkronizasyonu başladı...");
  } else {
    Serial.println("\nFAILED TO CONNECT!");
    Serial.println("AP MODE'A GERI DONULUYOR...");
    WiFi.softAP("ESP32-Setup");
    Serial.println(WiFi.softAPIP());
  }
}

// ── Mevcut LED endpoint'leri — dokunulmadı ────────────────────────────────────
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
  server.send(200, "application/json", "{\"device\":\"esp32-light\"}");
}

void handleLedOn() {
  currentBrightness = 255;
  ledcWrite(LED_PIN, currentBrightness);
  server.send(200, "text/plain", "OK");
}

void handleLedOff() {
  ledcWrite(LED_PIN, 0);
  server.send(200, "text/plain", "OK");
}

void handleBrightness() {
  if (!server.hasArg("value")) {
    server.send(400, "text/plain", "MISSING: value param (0-255)");
    return;
  }
  int value = server.arg("value").toInt();
  if (value < 0)   value = 0;
  if (value > 255) value = 255;
  currentBrightness = value;
  ledcWrite(LED_PIN, currentBrightness);
  Serial.printf("Brightness set: %d\n", currentBrightness);
  String response = "{\"brightness\":" + String(currentBrightness) + "}";
  server.send(200, "application/json", response);
}

// ── Automation endpoint'leri ─────────────────────────────────────────────────

// GET /automation/list
// Kayıtlı tüm kuralları JSON dizisi olarak döndürür.
// React Native bu listeyi AutomationScreen'de gösterir.
void handleAutomationList() {
  addCORSHeaders();

  String json = "[";
  for (int i = 0; i < ruleCount; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"id\":\"" + String(rules[i].id) + "\",";
    json += "\"active\":" + String(rules[i].active ? "true" : "false") + ",";
    json += "\"type\":"   + String(rules[i].type)   + ",";
    json += "\"hour\":"   + String(rules[i].hour)   + ",";
    json += "\"minute\":" + String(rules[i].minute) + ",";
    json += "\"action\":" + String(rules[i].action) + ",";
    json += "\"triggerAt\":" + String(rules[i].triggerAt);
    json += "}";
  }
  json += "]";

  server.send(200, "application/json", json);
}

// GET /automation/add?type=0&hour=22&minute=0&action=0
// GET /automation/add?type=1&countdown=1800&action=0   (saniye cinsinden)
// Yeni kural ekler ve Preferences'a kaydeder.
void handleAutomationAdd() {
  addCORSHeaders();

  if (ruleCount >= MAX_RULES) {
    server.send(400, "text/plain", "MAX_RULES reached (10)");
    return;
  }
  if (!server.hasArg("type") || !server.hasArg("action")) {
    server.send(400, "text/plain", "MISSING: type, action");
    return;
  }

  AutomationRule r;
  memset(&r, 0, sizeof(r));

  // Benzersiz ID üret: millis() + index kombinasyonu
  snprintf(r.id, sizeof(r.id), "%04lx%04d", millis() & 0xFFFF, ruleCount);
  r.active  = true;
  r.type    = server.arg("type").toInt();
  r.action  = server.arg("action").toInt();

  if (r.type == 0) {
    // Günlük zamanlayıcı — saat ve dakika gerekli
    if (!server.hasArg("hour") || !server.hasArg("minute")) {
      server.send(400, "text/plain", "MISSING: hour, minute for type=0");
      return;
    }
    r.hour   = server.arg("hour").toInt();
    r.minute = server.arg("minute").toInt();
    r.triggerAt = 0;
    r.triggered = false;
  } else {
    // Tek seferlik countdown — kaç saniye sonra tetiklenecek
    if (!server.hasArg("countdown")) {
      server.send(400, "text/plain", "MISSING: countdown for type=1");
      return;
    }
    long countdown = server.arg("countdown").toInt();
    // Mevcut Unix timestamp + countdown saniyesi
    r.triggerAt = (long)time(nullptr) + countdown;
    r.triggered = false;
    r.hour      = 0;
    r.minute    = 0;
  }

  rules[ruleCount++] = r;
  saveRules();

  Serial.printf("Kural eklendi: %s type=%d action=%d\n", r.id, r.type, r.action);
  String response = "{\"id\":\"" + String(r.id) + "\",\"status\":\"added\"}";
  server.send(200, "application/json", response);
}

// GET /automation/delete?id=XXXXXXXX
// Verilen ID'li kuralı siler, listeyi sıkıştırır ve kaydeder.
void handleAutomationDelete() {
  addCORSHeaders();

  if (!server.hasArg("id")) {
    server.send(400, "text/plain", "MISSING: id");
    return;
  }

  String targetId = server.arg("id");
  int    foundIdx = -1;

  for (int i = 0; i < ruleCount; i++) {
    if (String(rules[i].id) == targetId) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx == -1) {
    server.send(404, "text/plain", "NOT FOUND");
    return;
  }

  // Bulunan kuralı çıkar, sonrakileri öne kaydır
  for (int i = foundIdx; i < ruleCount - 1; i++) {
    rules[i] = rules[i + 1];
  }
  ruleCount--;
  saveRules();

  Serial.printf("Kural silindi: %s\n", targetId.c_str());
  server.send(200, "application/json", "{\"status\":\"deleted\"}");
}

// GET /automation/toggle?id=XXXXXXXX
// Kuralın active durumunu tersine çevirir.
void handleAutomationToggle() {
  addCORSHeaders();

  if (!server.hasArg("id")) {
    server.send(400, "text/plain", "MISSING: id");
    return;
  }

  String targetId = server.arg("id");

  for (int i = 0; i < ruleCount; i++) {
    if (String(rules[i].id) == targetId) {
      rules[i].active = !rules[i].active;
      saveRules();
      String state = rules[i].active ? "true" : "false";
      server.send(200, "application/json", "{\"active\":" + state + "}");
      Serial.printf("Kural toggle: %s → active=%s\n", targetId.c_str(), state.c_str());
      return;
    }
  }

  server.send(404, "text/plain", "NOT FOUND");
}

// GET /automation/time
// ESP32'nin mevcut saatini döndürür.
// React Native bu değeri göstererek NTP senkronizasyonunu doğrular.
void handleAutomationTime() {
  addCORSHeaders();

  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  char buf[64];
  snprintf(buf, sizeof(buf),
    "{\"hour\":%d,\"minute\":%d,\"second\":%d,\"unix\":%ld}",
    t->tm_hour, t->tm_min, t->tm_sec, (long)now
  );

  server.send(200, "application/json", String(buf));
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Automation loop kontrolü ─────────────────────────────────────────────────
// Her saniye çağrılır. Aktif kuralları kontrol eder ve tetikler.
unsigned long lastCheckMs = 0;

void checkAutomation() {
  if (millis() - lastCheckMs < 1000) return; // Her saniyede bir kontrol et
  lastCheckMs = millis();

  time_t    now = time(nullptr);
  struct tm* t  = localtime(&now);

  for (int i = 0; i < ruleCount; i++) {
    if (!rules[i].active) continue;

    bool shouldTrigger = false;

    if (rules[i].type == 0) {
      // Günlük zamanlayıcı: saat ve dakika eşleşince, saniye 0-4 arasındayken tetikle
      // 5 saniyelik pencere: ESP32'nin 1 saniyelik döngüsünde kesinlikle yakalanır
      if (t->tm_hour   == rules[i].hour   &&
          t->tm_min    == rules[i].minute  &&
          t->tm_sec    < 5                 &&
          !rules[i].triggered) {
        shouldTrigger        = true;
        rules[i].triggered   = true;  // Aynı dakikada iki kez tetiklenmesin
      }
      // Dakika geçince triggered sıfırla (bir sonraki güne hazırlan)
      if (t->tm_min != rules[i].minute) {
        rules[i].triggered = false;
      }

    } else {
      // Tek seferlik countdown: triggerAt zamanı geçtiyse tetikle
      if ((long)now >= rules[i].triggerAt && !rules[i].triggered) {
        shouldTrigger      = true;
        rules[i].triggered = true;
        rules[i].active    = false; // Tek seferlik — tetiklendi, devre dışı bırak
        saveRules();
      }
    }

    if (shouldTrigger) {
      if (rules[i].action == 1) {
        // Aç
        currentBrightness = 255;
        ledcWrite(LED_PIN, 255);
        Serial.printf("Automation tetiklendi: %s → LED ON\n", rules[i].id);
      } else {
        // Kapat
        ledcWrite(LED_PIN, 0);
        Serial.printf("Automation tetiklendi: %s → LED OFF\n", rules[i].id);
      }
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  // PWM başlat (Arduino core v3.x)
  ledcAttach(LED_PIN, PWM_FREQ, PWM_RES_BITS);
  ledcWrite(LED_PIN, 0);

  // WiFi kimlik bilgilerini yükle
  prefs.begin("wifi", true);
  ssid     = prefs.getString("ssid", "");
  password = prefs.getString("pass", "");
  prefs.end();

  if (ssid == "") {
    startAP();
  } else {
    connectToWiFi();
  }

  // Automation kurallarını yükle
  loadRules();

  // ── Endpoint kayıtları ──────────────────────────────────────────
  server.on("/setup",              handleSetup);
  server.on("/whoami",             handleWhoAmI);
  server.on("/led/on",             handleLedOn);
  server.on("/led/off",            handleLedOff);
  server.on("/led/brightness",     handleBrightness);
  server.on("/automation/list",    handleAutomationList);
  server.on("/automation/add",     handleAutomationAdd);
  server.on("/automation/delete",  handleAutomationDelete);
  server.on("/automation/toggle",  handleAutomationToggle);
  server.on("/automation/time",    handleAutomationTime);
  // ────────────────────────────────────────────────────────────────

  server.begin();
  Serial.println("Server başladı");
}

void loop() {
  server.handleClient();
  checkAutomation(); // Her loop'ta automation kurallarını kontrol et
}
