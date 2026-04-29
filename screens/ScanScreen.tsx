/**
 * screens/ScanScreen.tsx
 * Yerel ağda ESP32 cihazı arayan ekran.
 * Cihaz bulununca direkt açmak yerine isim girdisi alır
 * ve addDevice() ile AsyncStorage'a kaydeder.
 *
 * Props:
 *   onDeviceAdded(device) — cihaz kaydedilince App.tsx'e bildirir
 *   onBack               — geri tuşu
 */

import { useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { addDevice } from '../services/deviceStorage';
import { scanNetwork } from '../services/networkScanner';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = {
  onDeviceAdded: (device: Device) => void; // Kayıt tamamlanınca App.tsx'e döner
  onBack:        () => void;               // Geri → önceki ekrana
};

// Basit benzersiz ID üreteci — crypto.randomUUID() her ortamda çalışmaz
const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function ScanScreen({ onDeviceAdded, onBack }: Props) {
  const [scanning, setScanning]       = useState(false);
  // foundIp: tarama sonucu bulunan IP — isim giriş formunu tetikler
  const [foundIp, setFoundIp]         = useState<string | null>(null);
  const [deviceName, setDeviceName]   = useState('');
  const [saving, setSaving]           = useState(false);

  const startScan = async () => {
    console.log('🚀 SCAN BAŞLADI');
    setScanning(true);
    setFoundIp(null);   // Önceki sonucu temizle
    setDeviceName('');

    await scanNetwork((ip) => {
      console.log('🎯 DEVICE FOUND:', ip);
      setFoundIp(ip);   // IP bulununca formu göster
      setScanning(false);
    });

    setScanning(false);
    console.log('🏁 SCAN BİTTİ');
  };

  // Kullanıcı isim girip onayladı — cihazı kaydet
  const handleSave = async () => {
    if (!foundIp || !deviceName.trim()) return;
    setSaving(true);

    const newDevice: Device = {
      id:      generateId(),
      name:    deviceName.trim(),
      ip:      foundIp,
      addedAt: Date.now(),
    };

    await addDevice(newDevice);      // AsyncStorage'a yaz
    setSaving(false);
    onDeviceAdded(newDevice);        // App.tsx'e bildir → ControlScreen'e geç
  };

  return (
    <SafeAreaView style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← GERİ</Text>
        </TouchableOpacity>
        <Text style={styles.headerBrand}>TORVA · LAB</Text>
        <View style={styles.headerRight}>
          <View style={[
            styles.statusDot,
            { backgroundColor: scanning ? Colors.cyan : Colors.text3 },
          ]} />
          <Text style={styles.headerMeta}>v2.0</Text>
        </View>
      </View>
      <View style={styles.headerDivider} />

      <View style={styles.body}>

        {/* Başlık */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>// TARAMA</Text>
          <Text style={styles.titleMain}>Cihaz{'\n'}Ekle</Text>
          <Text style={styles.titleDesc}>
            Yerel ağda ESP32 cihazı aranıyor
          </Text>
        </View>

        {/* Tarama aktifken gösterge */}
        {scanning && (
          <View style={styles.scanningCard}>
            <ActivityIndicator color={Colors.cyan} size="small" />
            <View style={styles.scanningTextGroup}>
              <Text style={styles.scanningLabel}>AĞ TARANIYOR</Text>
              <Text style={styles.scanningSubLabel}>192.168.1.0/24</Text>
            </View>
          </View>
        )}

        {/* Cihaz bulununca isim giriş formu */}
        {foundIp && !scanning && (
          <View style={styles.foundCard}>

            {/* Bulunan IP bilgisi */}
            <View style={styles.foundHeader}>
              <View style={styles.foundDot} />
              <Text style={styles.foundLabel}>CİHAZ BULUNDU</Text>
            </View>
            <Text style={styles.foundIp}>{foundIp}</Text>

            <View style={styles.dividerLine} />

            {/* Cihaza isim ver */}
            <Text style={styles.fieldLabel}>CİHAZ ADI</Text>
            <TextInput
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="örn. Salon Lambası"
              placeholderTextColor={Colors.text3}
              autoFocus
              style={styles.nameInput}
              onSubmitEditing={handleSave}
            />

            {/* Kaydet butonu */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={!deviceName.trim() || saving}
              activeOpacity={0.75}
              style={[
                styles.saveBtn,
                (!deviceName.trim() || saving) && styles.saveBtnDisabled,
              ]}
            >
              <Text style={[
                styles.saveBtnText,
                (!deviceName.trim() || saving) && styles.saveBtnTextDisabled,
              ]}>
                {saving ? '[ KAYDEDİLİYOR... ]' : '[ KAYDET ve BAĞLAN ]'}
              </Text>
            </TouchableOpacity>

          </View>
        )}

        {/* Ayraç */}
        {!foundIp && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLineRow} />
            <Text style={styles.dividerLabel}>AKSİYON</Text>
            <View style={styles.dividerLineRow} />
          </View>
        )}

        {/* Tarama butonu — cihaz bulununca gizlenir */}
        {!foundIp && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              onPress={startScan}
              disabled={scanning}
              activeOpacity={0.75}
              style={[styles.primaryBtn, scanning && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnLabel}>TARAMA</Text>
              <Text style={[
                styles.primaryBtnText,
                scanning && styles.btnTextDisabled,
              ]}>
                {scanning ? '[ Taranıyor... ]' : '[ Ağda Ara ]'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cihaz bulunduktan sonra tekrar tara seçeneği */}
        {foundIp && (
          <TouchableOpacity onPress={startScan} style={styles.rescanBtn}>
            <Text style={styles.rescanText}>↺ Tekrar Tara</Text>
          </TouchableOpacity>
        )}

      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  backBtn:   { minWidth: 60 },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text2,
  },
  headerBrand: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.text2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 60,
    justifyContent: 'flex-end',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  headerMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text3,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  titleBlock: { gap: Spacing.sm },
  titleEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.cyan,
  },
  titleMain: {
    fontFamily: Fonts.sans,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -0.5,
    color: Colors.text,
    fontWeight: '300',
  },
  titleDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text2,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  scanningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  scanningTextGroup: { gap: 2 },
  scanningLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.cyan,
  },
  scanningSubLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text3,
  },
  // Bulunan cihaz kartı
  foundCard: {
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.md,
    backgroundColor: Colors.cyanAlpha,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  foundDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.cyan,
  },
  foundLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.cyan,
  },
  foundIp: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    letterSpacing: 2,
    color: Colors.text,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.text3,
  },
  nameInput: {
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 1,
    color: Colors.text,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanAlpha,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  saveBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.cyan,
  },
  saveBtnTextDisabled: { color: Colors.text3 },
  rescanBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  rescanText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.text2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLineRow: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
  buttonGroup: { gap: Spacing.md },
  primaryBtn: {
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanAlpha,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  primaryBtnLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.cyan2,
  },
  primaryBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    letterSpacing: 2,
    color: Colors.cyan,
  },
  btnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  btnTextDisabled: { color: Colors.text3 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.md,
  },
  footerText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 2.5,
    color: Colors.text3,
  },
  footerSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border2,
  },
});