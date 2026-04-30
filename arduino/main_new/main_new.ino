#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>
#include <FastLED.h>   // ✅ EKLENDİ

WebServer server(80);
Preferences prefs;

String ssid     = "";
String password = "";

// ── LED ayarları (WS2812B) ─────────────────────────────────────────────
#define LED_PIN 2        // ⚠️ D5 kullanıyorsun
#define NUM_LEDS 30      // LED sayını buraya yaz

CRGB leds[NUM_LEDS];
int currentBrightness = 255;
// ───────────────────────────────────────────────────────────────────────

// ── Automation veri yapısı ─────────────────────────────────────────────
#define MAX_RULES 10

struct AutomationRule {
  char   id[9];
  bool   active;
  int    type;
  int    hour;
  int    minute;
  int    action;
  long   triggerAt;
  bool   triggered;
};

AutomationRule rules[MAX_RULES];
int ruleCount = 0;

// ── (diğer tüm fonksiyonların AYNI kalıyor, değişmedi) ─────────────────

// SADECE LED KONTROL FONKSİYONLARI DEĞİŞTİ 👇

// ── LED ON ────────────────────────────────────────────────────────────
void handleLedOn() {
  for(int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB::White;
  }
  FastLED.setBrightness(currentBrightness);
  FastLED.show();
  server.send(200, "text/plain", "OK");
}

// ── LED OFF ───────────────────────────────────────────────────────────
void handleLedOff() {
  for(int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB::Black;
  }
  FastLED.show();
  server.send(200, "text/plain", "OK");
}

// ── BRIGHTNESS ────────────────────────────────────────────────────────
void handleBrightness() {
  if (!server.hasArg("value")) {
    server.send(400, "text/plain", "MISSING: value param (0-255)");
    return;
  }

  int value = server.arg("value").toInt();
  if (value < 0)   value = 0;
  if (value > 255) value = 255;

  currentBrightness = value;

  FastLED.setBrightness(currentBrightness);
  FastLED.show();

  String response = "{\"brightness\":" + String(currentBrightness) + "}";
  server.send(200, "application/json", response);
}

// ── setup ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // ❌ ledcAttach kaldırıldı
  // ✅ FastLED başlatıldı
  FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(currentBrightness);

  // WiFi (AYNI)
  prefs.begin("wifi", true);
  ssid     = prefs.getString("ssid", "");
  password = prefs.getString("pass", "");
  prefs.end();

  if (ssid == "") {
    WiFi.softAP("ESP32-Light");
  } else {
    WiFi.begin(ssid.c_str(), password.c_str());
  }

  // Server endpoint (AYNI)
  server.on("/led/on", handleLedOn);
  server.on("/led/off", handleLedOff);
  server.on("/led/brightness", handleBrightness);

  server.begin();
}

// ── loop ──────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
}