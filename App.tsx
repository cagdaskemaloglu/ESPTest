/**
 * App.tsx
 * Kök bileşen — router + global state.
 *
 * Sahneler ve Otomasyon artık ControlScreen içinde accordion olarak çalışır.
 * Ayrı ekran adımları kaldırıldı.
 */

import * as ExpoSplash from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import SplashAnimation from './components/SplashAnimation';
import ControlScreen from './screens/ControlScreen';
import DeviceListScreen from './screens/DeviceListScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ScanScreen from './screens/ScanScreen';
import SetupScreen from './screens/SetupScreen';
import StartScreen from './screens/StartScreen';

import {
  getDevices,
  getLastDeviceId,
  saveLastDeviceId,
} from './services/deviceStorage';
import { requestNotificationPermission } from './services/notificationService';
import { preloadGeometries } from './services/stlCache';
import { Colors } from './theme/colors';
import { Device } from './types/Device';

ExpoSplash.preventAutoHideAsync();

type Step =
  | 'loading'
  | 'onboarding'
  | 'start'
  | 'setup'
  | 'scan'
  | 'control'
  | 'deviceList';

export default function App() {
  const [step, setStep]                 = useState<Step>('loading');
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);
  const [devices, setDevices]           = useState<Device[]>([]);
  const [appReady, setAppReady]         = useState(false);
  const [splashDone, setSplashDone]     = useState(false);
  const [scanDelay, setScanDelay]       = useState(0);

  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    try {
      await requestNotificationPermission();
      const devices = await getDevices();
      const lastId  = await getLastDeviceId();
      setDevices(devices);

      // Tüm cihazların parts listesini splash sırasında cache'le
      const allParts = [...new Set(devices.flatMap((d) => d.parts ?? []))];
      if (allParts.length > 0) {
        preloadGeometries(allParts).catch(() => {}); // Arka planda — bekleme
      }

      if (devices.length === 0) {
        setStep('onboarding');
      } else {
        const last = devices.find((d) => d.id === lastId) ?? devices[0];
        setActiveDevice(last);
        setStep('control');
      }
    } catch {
      setStep('start');
    } finally {
      setAppReady(true);
    }
  };

  const handleSplashFinish = useCallback(async () => {
    await ExpoSplash.hideAsync();
    setSplashDone(true);
  }, []);

  const selectDevice = async (device: Device) => {
    setActiveDevice(device);
    await saveLastDeviceId(device.id);
    // Güncel cihaz listesini yenile
    const updated = await getDevices();
    setDevices(updated);
    setStep('control');
  };

  if (!appReady)   return <View style={styles.bg} />;
  if (!splashDone) return <SplashAnimation onFinish={handleSplashFinish} />;

  if (step === 'onboarding') return <OnboardingScreen onDone={() => setStep('start')} />;

  if (step === 'start') {
    return (
      <StartScreen
        onSetup={() => setStep('setup')}
        onScan={() => { setScanDelay(0); setStep('scan'); }}
        onBack={devices.length > 0 ? () => setStep('control') : undefined}
      />
    );
  }

  if (step === 'setup') {
    return (
      <SetupScreen
        onDone={() => { setScanDelay(12000); setStep('scan'); }}
        onBack={() => setStep('start')}
      />
    );
  }

  if (step === 'scan') {
    return (
      <ScanScreen
        onDeviceAdded={(device)    => selectDevice(device)}
        onDeviceSelected={(device) => selectDevice(device)}
        onBack={() => activeDevice ? setStep('control') : setStep('start')}
        initialDelay={scanDelay}
      />
    );
  }

  if (step === 'deviceList' && activeDevice) {
    return (
      <DeviceListScreen
        activeDeviceId={activeDevice.id}
        onSelect={(device) => selectDevice(device)}
        onAddNew={() => { setScanDelay(0); setStep('scan'); }}
        onSetup={() => setStep('setup')}
        onBack={() => setStep('control')}
        onStart={() => setStep('start')}
      />
    );
  }

  // ControlScreen her zaman mount'ta kalır — GLView destroy/recreate önlenir
  // step !== 'control' iken üstüne diğer ekranlar gelir ama ControlScreen unmount olmaz
  return (
    <>
      <View style={{ flex: 1, display: step === 'control' && activeDevice ? 'flex' : 'none' }}>
        {activeDevice && (
          <ControlScreen
            device={activeDevice}
            devices={devices}
            onOpenList={()           => setStep('deviceList')}
            onAddDevice={()          => setStep('start')}
            onDeviceChange={(device) => selectDevice(device)}
          />
        )}
      </View>
      {step !== 'control' && <View style={styles.bg} />}
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: Colors.bg },
});