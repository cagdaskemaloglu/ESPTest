/**
 * App.tsx
 * Kök bileşen — router + global state.
 *
 * Bildirim izni:
 *   Uygulama ilk açılışta requestNotificationPermission() çağrılır.
 *   Kullanıcı izin verirse automation bildirimleri çalışır.
 *   İzin reddedilirse uygulama çalışmaya devam eder — bildirimler gelmez.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
  const [step, setStep]                 = useState<Step>('loading');
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    // Bildirim iznini uygulama açılışında iste
    await requestNotificationPermission();

    const devices = await getDevices();
    const lastId  = await getLastDeviceId();

    if (devices.length === 0) {
      setStep('onboarding');
      return;
    }

    const last = devices.find((d) => d.id === lastId) ?? devices[0];
    setActiveDevice(last);
    setStep('control');
  };

  const selectDevice = async (device: Device) => {
    setActiveDevice(device);
    await saveLastDeviceId(device.id);
    setStep('control');
  };

  if (step === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.cyan} size="large" />
      </View>
    );
  }

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

  return null;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});