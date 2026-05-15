/**
 * App.tsx
 * Kök bileşen — router + global state.
 *
 * Splash akışı:
 *   1. Expo built-in splash (app.json'daki statik görsel) hemen gösterilir
 *   2. initApp() arka planda çalışır (cihaz kontrolü, izinler)
 *   3. SplashAnimation bileşeni animasyonu oynatır (3 saniye)
 *   4. Animasyon bitince ExpoSplash.hideAsync() → asıl ekrana geçiş
 *
 * Kurulum:
 *   npx expo install expo-splash-screen react-native-svg
 */

import * as ExpoSplash from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import SplashAnimation from './components/SplashAnimation';
import AutomationScreen from './screens/AutomationScreen';
import ControlScreen from './screens/ControlScreen';
import DeviceListScreen from './screens/DeviceListScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PresetsScreen from './screens/PresetsScreen';
import ScanScreen from './screens/ScanScreen';
import SetupScreen from './screens/SetupScreen';
import StartScreen from './screens/StartScreen';

import {
  getDevices,
  getLastDeviceId,
  saveLastDeviceId,
} from './services/deviceStorage';
import { requestNotificationPermission } from './services/notificationService';
import { Colors } from './theme/colors';
import { Device } from './types/Device';

// Expo splash screen'in otomatik kapanmasını engelle
// Biz animasyonu kendimiz kontrol edeceğiz
ExpoSplash.preventAutoHideAsync();

type Step =
  | 'loading'
  | 'onboarding'
  | 'start'
  | 'setup'
  | 'scan'
  | 'control'
  | 'deviceList'
  | 'automation'
  | 'presets';

export default function App() {
  const [step, setStep]                   = useState<Step>('loading');
  const [activeDevice, setActiveDevice]   = useState<Device | null>(null);
  // appReady: initApp tamamlandı mı?
  const [appReady, setAppReady]           = useState(false);
  // splashDone: animasyon bitti mi?
  const [splashDone, setSplashDone]       = useState(false);

  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    try {
      // Bildirim iznini iste
      await requestNotificationPermission();

      const devices = await getDevices();
      const lastId  = await getLastDeviceId();

      if (devices.length === 0) {
        setStep('onboarding');
      } else {
        const last = devices.find((d) => d.id === lastId) ?? devices[0];
        setActiveDevice(last);
        setStep('control');
      }
    } catch (e) {
      console.error('initApp hata:', e);
      setStep('start');
    } finally {
      setAppReady(true);
    }
  };

  // Splash animasyonu bitince Expo splash'i gizle
  const handleSplashFinish = useCallback(async () => {
    await ExpoSplash.hideAsync();
    setSplashDone(true);
  }, []);

  const selectDevice = async (device: Device) => {
    setActiveDevice(device);
    await saveLastDeviceId(device.id);
    setStep('control');
  };

  // Uygulama hazır değilse boş ekran göster
  // (Expo splash hâlâ üstte, kullanıcı görmez)
  if (!appReady) {
    return <View style={styles.loading} />;
  }

  // Splash animasyonu henüz bitmedi — SplashAnimation göster
  if (!splashDone) {
    return <SplashAnimation onFinish={handleSplashFinish} />;
  }

  // ── Normal uygulama akışı ──────────────────────────────────────

  if (step === 'onboarding') {
    return <OnboardingScreen onDone={() => setStep('start')} />;
  }

  if (step === 'start') {
    return (
      <StartScreen
        onSetup={() => setStep('setup')}
        onScan={()  => setStep('scan')}
      />
    );
  }

  if (step === 'setup') {
    return (
      <SetupScreen
        onDone={() => { console.log('✅ SETUP TAMAMLANDI'); setStep('scan'); }}
      />
    );
  }

  if (step === 'scan') {
    return (
      <ScanScreen
        onDeviceAdded={(device)    => selectDevice(device)}
        onDeviceSelected={(device) => selectDevice(device)}
        onBack={() => activeDevice ? setStep('control') : setStep('start')}
      />
    );
  }

  if (step === 'deviceList' && activeDevice) {
    return (
      <DeviceListScreen
        activeDeviceId={activeDevice.id}
        onSelect={(device) => selectDevice(device)}
        onAddNew={() => setStep('scan')}
        onBack={() => setStep('control')}
        onStart={() => setStep('start')}
      />
    );
  }

  if (step === 'automation' && activeDevice) {
    return (
      <AutomationScreen
        device={activeDevice}
        onBack={() => setStep('control')}
      />
    );
  }

  if (step === 'presets' && activeDevice) {
    return (
      <PresetsScreen
        device={activeDevice}
        onBack={() => setStep('control')}
      />
    );
  }

  if (step === 'control' && activeDevice) {
    return (
      <ControlScreen
        device={activeDevice}
        onOpenList={()        => setStep('deviceList')}
        onAddDevice={()       => setStep('scan')}
        onOpenAutomation={()  => setStep('automation')}
        onOpenPresets={()     => setStep('presets')}
      />
    );
  }

  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});