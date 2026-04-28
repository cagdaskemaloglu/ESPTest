#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

WebServer server(80);
Preferences prefs;

String ssid = "";
String password = "";

bool isConfigured = false;

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
  } else {
    Serial.println("\nFAILED TO CONNECT!");
    
    // 🔥 EN KRİTİK KISIM
    Serial.println("AP MODE'A GERI DONULUYOR...");
    WiFi.softAP("ESP32-Setup");
    Serial.println(WiFi.softAPIP());
  }
}

void handleSetup() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    ssid = server.arg("ssid");
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
  digitalWrite(2, HIGH);
  server.send(200, "text/plain", "OK");
}

void handleLedOff() {
  digitalWrite(2, LOW);
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);

  prefs.begin("wifi", true);
  ssid = prefs.getString("ssid", "");
  password = prefs.getString("pass", "");
  prefs.end();

  if (ssid == "") {
    startAP();
  } else {
    connectToWiFi();
  }

  server.on("/setup", handleSetup);
  server.on("/whoami", handleWhoAmI);
  server.on("/led/on", handleLedOn);
  server.on("/led/off", handleLedOff);

  server.begin();
}

void loop() {
  server.handleClient();
}