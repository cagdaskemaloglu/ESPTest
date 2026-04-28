import { useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';

import ControlScreen from './screens/ControlScreen';
import SetupScreen from './screens/SetupScreen';
import { scanNetwork } from './services/networkScanner';

type Step = 'start' | 'setup' | 'scan' | 'control';

export default function App() {
  const [step, setStep] = useState<Step>('start');
  const [deviceIP, setDeviceIP] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // 🔍 SCAN START
  const startScan = async () => {
    console.log("🚀 SCAN BUTTON BASILDI");

    setScanning(true);

    await scanNetwork((ip) => {
      console.log("🎯 DEVICE FOUND:", ip);

      setDeviceIP(ip);
      setStep('control');
      setScanning(false);
    });

    setScanning(false);
  };

  // 🏠 START SCREEN
  if (step === 'start') {
    return (
      <View style={{ marginTop: 100, gap: 20 }}>
        <Text>Smart Light</Text>

        <Button
          title="🔧 Kurulum Başlat"
          onPress={() => setStep('setup')}
        />

        <Button
          title="🔍 Cihaz Ara"
          onPress={() => setStep('scan')}
        />
      </View>
    );
  }

  // ⚙️ SETUP SCREEN
  if (step === 'setup') {
    return (
      <SetupScreen
        onDone={() => {
          console.log("✅ SETUP TAMAMLANDI");
          setStep('scan');
        }}
      />
    );
  }

  // 🔍 SCAN SCREEN
  if (step === 'scan') {
    return (
      <View style={{ marginTop: 100, gap: 20 }}>
        <Text>Cihaz Arama</Text>

        <Button title="Ağda Ara" onPress={startScan} />

        {scanning && <ActivityIndicator size="large" />}

        <Button title="Geri" onPress={() => setStep('start')} />
      </View>
    );
  }

  // 🎮 CONTROL SCREEN
  if (step === 'control' && deviceIP) {
    return <ControlScreen ip={deviceIP} />;
  }

  return null;
}