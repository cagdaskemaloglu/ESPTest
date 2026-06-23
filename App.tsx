/**
 * App.tsx — Router + global state
 * ControlScreen her zaman mount'ta kalır — GLView destroy/recreate önlenir.
 */

import * as ExpoSplash from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import ErrorBoundary from './components/ErrorBoundary';
import SplashAnimation from './components/SplashAnimation';
import ControlScreen from './screens/ControlScreen';
import DeviceListScreen from './screens/DeviceListScreen';
import GroupScreen from './screens/GroupScreen';
import LegalScreen from './screens/LegalScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ScanScreen from './screens/ScanScreen';
import SetupScreen from './screens/SetupScreen';
import StartScreen from './screens/StartScreen';
import StatsScreen from './screens/StatsScreen';

import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { getDevices, getLastDeviceId, saveLastDeviceId } from './services/deviceStorage';
import { requestNotificationPermission } from './services/notificationService';
import { preloadGeometries } from './services/stlCache';
import { Colors } from './theme/colors';
import { Device } from './types/Device';

ExpoSplash.preventAutoHideAsync();

type Step = 'loading' | 'onboarding' | 'start' | 'setup' | 'scan' | 'control' | 'deviceList' | 'legal' | 'groups' | 'stats';

// Üst seviye App — LanguageProvider ile sarmalar.
// Asıl mantık AppInner içinde, çünkü useLanguage() Provider altında çağrılmalı.
// ErrorBoundary, LanguageProvider'ın İÇİNDE konumlanır: böylece bir render
// hatası yakalandığında bile context.t() üzerinden doğru dilde mesaj gösterilebilir.
export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </LanguageProvider>
  );
}

function AppInner() {
  const { ready: languageReady } = useLanguage();
  const [step, setStep]                 = useState<Step>('loading');
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);
  const [devices, setDevices]           = useState<Device[]>([]);
  const [appReady, setAppReady]         = useState(false);
  const [splashDone, setSplashDone]     = useState(false);
  const [scanDelay, setScanDelay]       = useState(0);
  const [syncKey, setSyncKey]           = useState(0);

  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    try {
      await requestNotificationPermission();
      const loaded = await getDevices();
      const lastId = await getLastDeviceId();
      setDevices(loaded);

      const allParts = [...new Set(loaded.flatMap((d) => d.parts ?? []))];
      if (allParts.length > 0) preloadGeometries(allParts).catch(() => {});

      if (loaded.length === 0) {
        setStep('onboarding');
      } else {
        const last = loaded.find((d) => d.id === lastId) ?? loaded[0];
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
    const updated = await getDevices();
    setDevices(updated);
    goToControl();
  };

  // Overlay ekranlardan control'e her dönüşte LED durumunu yenile
  const goToControl = () => {
    setStep('control');
    setSyncKey((k) => k + 1);
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  // languageReady da beklenir — splash sırasında dil zaten algılanmış olur,
  // böylece ilk gerçek ekran (onboarding/start) doğru dilde açılır.
  if (!appReady || !languageReady) return <View style={styles.bg} />;
  if (!splashDone) return <SplashAnimation onFinish={handleSplashFinish} />;
  if (step === 'onboarding') return <OnboardingScreen onDone={() => setStep('start')} />;

  // ── Overlay ekranı ─────────────────────────────────────────────────────────
  const renderOverlay = (): React.ReactNode => {
    if (step === 'start') return (
      <StartScreen
        onSetup={() => setStep('setup')}
        onScan={() => { setScanDelay(0); setStep('scan'); }}
        onBack={devices.length > 0 ? () => goToControl() : undefined}
      />
    );
    if (step === 'setup') return (
      <SetupScreen
        onDone={() => { setScanDelay(12000); setStep('scan'); }}
        onBack={() => setStep('start')}
      />
    );
    if (step === 'scan') return (
      <ScanScreen
        onDeviceAdded={(device)    => selectDevice(device)}
        onDeviceSelected={(device) => selectDevice(device)}
        onBack={() => activeDevice ? goToControl() : setStep('start')}
        initialDelay={scanDelay}
      />
    );
    if (step === 'deviceList' && activeDevice) return (
      <DeviceListScreen
        activeDeviceId={activeDevice.id}
        onSelect={(device) => selectDevice(device)}
        onAddNew={() => { setScanDelay(0); setStep('scan'); }}
        onSetup={() => setStep('setup')}
        onBack={() => goToControl()}
        onStart={() => setStep('start')}
        onLegal={() => setStep('legal')}
      />
    );
    if (step === 'legal') return (
      <LegalScreen onBack={() => setStep(activeDevice ? 'deviceList' : 'start')} />
    );
    if (step === 'groups' && activeDevice) return (
      <GroupScreen
        devices={devices}
        onBack={() => goToControl()}
      />
    );
    if (step === 'stats' && activeDevice) return (
      <StatsScreen
        devices={devices}
        onBack={() => goToControl()}
      />
    );
    return null;
  };

  const showControl = step === 'control' && !!activeDevice;
  const overlay     = renderOverlay();

  return (
    <View style={styles.bg}>
      {/* ControlScreen — her zaman mount'ta, GLView canlı kalır */}
      {activeDevice && (
        <View
          style={[StyleSheet.absoluteFill, { opacity: showControl ? 1 : 0 }]}
          pointerEvents={showControl ? 'auto' : 'none'}
        >
          <ControlScreen
            device={activeDevice}
            devices={devices}
            onOpenList={()           => setStep('deviceList')}
            onAddDevice={()          => setStep('start')}
            onDeviceChange={(device) => selectDevice(device)}
            onOpenGroups={()         => setStep('groups')}
            onOpenStats={()          => setStep('stats')}
            syncKey={syncKey}
          />
        </View>
      )}

      {/* Overlay ekranlar */}
      {overlay && (
        <View style={StyleSheet.absoluteFill}>
          {overlay}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: Colors.bg },
});