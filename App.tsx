/**
 * App.tsx
 * Uygulamanın kök bileşeni — router + global state.
 *
 * Sorumluluklar:
 *   1. AsyncStorage'dan kayıtlı cihazları yüklemek
 *   2. Son kullanılan cihaza direkt geçmek (tekrar tarama gerekmez)
 *   3. Ekranlar arası geçişi yönetmek
 *   4. Aktif cihazı tutmak ve güncellemek
 *
 * Ekran akışı:
 *   Uygulama açılır
 *     ├── Kayıtlı cihaz var  → ControlScreen (son kullanılan)
 *     └── Kayıtlı cihaz yok → StartScreen
 *
 *   StartScreen → SetupScreen → ScanScreen
 *   StartScreen → ScanScreen
 *   ScanScreen  → ControlScreen (yeni cihaz kaydedildi)
 *
 *   ControlScreen "+" → ScanScreen (yeni cihaz ekle)
 *   ControlScreen cihaz adı → DeviceListScreen
 *   DeviceListScreen cihaz seç → ControlScreen (farklı cihaz)
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import ControlScreen from './screens/ControlScreen';
import DeviceListScreen from './screens/DeviceListScreen';
import ScanScreen from './screens/ScanScreen';
import SetupScreen from './screens/SetupScreen';
import StartScreen from './screens/StartScreen';

import {
  getDevices,
  getLastDeviceId,
  saveLastDeviceId,
} from './services/deviceStorage';
import { Colors } from './theme/colors';
import { Device } from './types/Device';

// Uygulamanın olası ekran adımları
type Step = 'loading' | 'start' | 'setup' | 'scan' | 'control' | 'deviceList';

export default function App() {
  const [step, setStep]               = useState<Step>('loading');
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  // ── Uygulama açılınca kayıtlı cihazları kontrol et ─────────────
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const devices    = await getDevices();
    const lastId     = await getLastDeviceId();

    if (devices.length === 0) {
      // Hiç cihaz yok — kurulum/tarama ekranına gönder
      setStep('start');
      return;
    }

    // Son kullanılan cihazı bul, yoksa listedeki ilk cihazı seç
    const lastDevice = devices.find((d) => d.id === lastId) ?? devices[0];
    setActiveDevice(lastDevice);
    setStep('control');
  };

  // Cihaz seçildiğinde hem state'i hem AsyncStorage'ı güncelle
  const selectDevice = async (device: Device) => {
    setActiveDevice(device);
    await saveLastDeviceId(device.id);
    setStep('control');
  };

  // ── Yükleniyor ─────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.cyan} size="large" />
      </View>
    );
  }

  // ── Başlangıç ekranı ───────────────────────────────────────────
  if (step === 'start') {
    return (
      <StartScreen
        onSetup={() => setStep('setup')}
        onScan={()  => setStep('scan')}
      />
    );
  }

  // ── WiFi kurulum ekranı ────────────────────────────────────────
  if (step === 'setup') {
    return (
      <SetupScreen
        onDone={() => {
          console.log('✅ SETUP TAMAMLANDI');
          setStep('scan');
        }}
      />
    );
  }

  // ── Ağ tarama / yeni cihaz ekleme ekranı ──────────────────────
  if (step === 'scan') {
    return (
      <ScanScreen
        onDeviceAdded={(device) => selectDevice(device)}
        onBack={() => {
          // Kayıtlı cihaz varsa geri dön, yoksa başlangıca
          activeDevice ? setStep('control') : setStep('start');
        }}
      />
    );
  }

  // ── Cihaz listesi ekranı ───────────────────────────────────────
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

  // ── Ana kontrol ekranı ─────────────────────────────────────────
  if (step === 'control' && activeDevice) {
    return (
      <ControlScreen
        device={activeDevice}
        onOpenList={()  => setStep('deviceList')}
        onAddDevice={() => setStep('scan')}
      />
    );
  }

  // Beklenmedik durum — normalde buraya düşmemeli
  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});