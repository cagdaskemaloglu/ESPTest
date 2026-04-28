import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';

export default function SetupScreen({ onDone }: { onDone: () => void }) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("ESP32 ağına bağlan (ESP32-Setup)");

  const setup = async () => {
    console.log("SETUP BAŞLADI");

    setStatus("ESP32'ye bağlanıyor...");

    try {
      const url = `http://192.168.4.1/setup?ssid=${ssid}&password=${password}`;
      console.log("REQUEST:", url);

      const res = await fetch(url);
      const text = await res.text();

      console.log("RESPONSE:", text);

      setStatus("Kaydedildi! ESP32 yeniden başlıyor...");

      setTimeout(() => {
        setStatus("Şimdi kendi WiFi ağına geri dön ve 'Cihaz Ara'ya bas");
        onDone();
      }, 2000);

    } catch (e) {
      console.log("HATA:", e);
      setStatus("❌ ESP32'ye bağlanılamadı. WiFi kontrol et!");
    }
  };

  return (
    <View style={{ marginTop: 80, padding: 20, gap: 15 }}>
      
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
        Kurulum
      </Text>

      <Text>
        1. Telefonunu "ESP32-Setup" WiFi ağına bağla
      </Text>

      <Text>
        2. Aşağıya kendi WiFi bilgilerini gir
      </Text>

      <Text>WiFi Adı (SSID)</Text>
      <TextInput
        value={ssid}
        onChangeText={setSsid}
        placeholder="WiFi adı"
        style={{ borderWidth: 1, padding: 10 }}
      />

      <Text>Şifre</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Şifre"
        style={{ borderWidth: 1, padding: 10 }}
      />

      <Button title="Kurulumu Tamamla" onPress={setup} />

      <Text style={{ marginTop: 10 }}>
        {status}
      </Text>

      <Button title="Geri" onPress={onDone} />
    </View>
  );
}