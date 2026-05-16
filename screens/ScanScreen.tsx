/**
 * screens/ScanScreen.tsx
 * Yerel ağdaki tüm ESP32 cihazlarını bulur ve ekler.
 *
 * PIN entegrasyonu:
 *   - pinRequired: true olan cihazlarda 🔒 rozeti gösterilir
 *   - Yeni cihaz eklerken PIN girişi istenir
 *   - Kayıtlı cihaza bağlanırken PIN ControlScreen'de istenir
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDevice, getDevices } from '../services/deviceStorage';
import { FoundDevice, scanNetwork } from '../services/networkScanner';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device, DeviceType, defaultCapabilities } from '../types/Device';

type Props = {
  onDeviceAdded:    (device: Device) => void;
  onDeviceSelected: (device: Device) => void;
  onBack:           () => void;
};

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const TYPE_META: Record<DeviceType, { label: string; color: string; bg: string }> = {
  ws2812b:    { label: 'RGB Şerit',       color: Colors.purple, bg: Colors.purpleAlpha },
  single_led: { label: 'Tek LED / Ampul', color: Colors.amber,  bg: 'rgba(232,160,32,0.1)' },
  relay:      { label: 'Röle / Ampul',    color: Colors.amber,  bg: 'rgba(232,160,32,0.1)' },
  unknown:    { label: 'Bilinmiyor',      color: Colors.text3,  bg: Colors.bg4 },
};

// Yeni cihaz kayıt formu state
type FormState = {
  ip:          string;
  deviceName:  string;
  pin:         string;
  pinRequired: boolean;
};

export default function ScanScreen({ onDeviceAdded, onDeviceSelected, onBack }: Props) {
  const [scanning, setScanning]           = useState(false);
  const [progress, setProgress]           = useState({ scanned: 0, total: 254 });
  const [foundDevices, setFoundDevices]   = useState<FoundDevice[]>([]);
  const [registeredDevices, setRegistered] = useState<Device[]>([]);
  const [form, setForm]                   = useState<FormState | null>(null);
  const [saving, setSaving]               = useState(false);
  const [pinError, setPinError]           = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    getDevices().then(setRegistered);
    return () => { mountedRef.current = false; };
  }, []);

  const startScan = async () => {
    setScanning(true);
    setFoundDevices([]);
    setForm(null);
    setProgress({ scanned: 0, total: 254 });

    await scanNetwork({
      onDeviceFound: (device) => {
        if (!mountedRef.current) return;
        setFoundDevices((prev) =>
          prev.some((d) => d.ip === device.ip) ? prev : [...prev, device]
        );
      },
      onProgress: (scanned, total) => {
        if (!mountedRef.current) return;
        setProgress({ scanned, total });
      },
    });

    if (mountedRef.current) setScanning(false);
  };

  const findRegistered = (ip: string): Device | undefined =>
    registeredDevices.find((d) => d.ip === ip);

  const handleSelectDevice = (found: FoundDevice) => {
    const existing = findRegistered(found.ip);
    if (existing) {
      Alert.alert(
        'Cihaz Zaten Kayıtlı',
        `"${existing.name}" (${found.ip}) zaten listenizde.\nBu cihaza bağlanmak ister misiniz?`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Bağlan', onPress: () => onDeviceSelected(existing) },
        ]
      );
    } else {
      // Yeni cihaz — isim + PIN formu aç
      setForm({
        ip:          found.ip,
        deviceName:  '',
        pin:         '',
        pinRequired: found.pinRequired,
      });
      setPinError(null);
    }
  };

  const handleSave = async () => {
    if (!form || !form.deviceName.trim()) return;

    // PIN girilmişse minimum 4 hane kontrolü yap
    if (form.pin.length > 0 && form.pin.length < 4) {
      setPinError('PIN en az 4 haneli olmalı');
      return;
    }

    setSaving(true);

    const found = foundDevices.find((d) => d.ip === form.ip);
    const type  = found?.type ?? 'unknown';

    const newDevice: Device = {
      id:           generateId(),
      name:         form.deviceName.trim(),
      ip:           form.ip,
      addedAt:      Date.now(),
      brightness:   255,
      color:        { r: 255, g: 255, b: 255 },
      type,
      capabilities: found?.capabilities ?? defaultCapabilities(type),
      leds:         found?.leds,
      pin:          form.pin,
    };

    await addDevice(newDevice);
    setSaving(false);
    onDeviceAdded(newDevice);
  };

  const progressPct = progress.total > 0
    ? Math.round((progress.scanned / progress.total) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← GERİ</Text>
          </TouchableOpacity>
          <Text style={styles.headerBrand}>TORVA · LAB</Text>
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, { backgroundColor: scanning ? Colors.cyan : Colors.text3 }]} />
            <Text style={styles.headerMeta}>v2.0</Text>
          </View>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Başlık */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleEyebrow}>// TARAMA</Text>
            <Text style={styles.titleMain}>Cihaz{'\n'}Ekle</Text>
            <Text style={styles.titleDesc}>Yerel ağdaki tüm ESP32 cihazları listelenir</Text>

            {/* WiFi uyarısı */}
            <View style={styles.wifiWarning}>
              <Text style={styles.wifiWarningText}>
                📶 Tarama yapabilmek için ESP32'nin bağlı olduğu ev WiFi ağında olmalısın.
                ESP32-Setup ağında değil, kendi internet ağında olduğundan emin ol.
              </Text>
            </View>
          </View>

          {/* Tarama göstergesi */}
          {scanning && (
            <>
              <View style={styles.scanningCard}>
                <ActivityIndicator color={Colors.cyan} size="small" />
                <View style={styles.scanningTextGroup}>
                  <Text style={styles.scanningLabel}>AĞ TARANIYOR</Text>
                  <Text style={styles.scanningSubLabel}>
                    {progress.scanned} / {progress.total} IP · {foundDevices.length} cihaz bulundu
                  </Text>
                </View>
                <Text style={styles.scanningPct}>{progressPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </>
          )}

          {/* Bulunan cihazlar */}
          {foundDevices.length > 0 && !form && (
            <View style={styles.deviceListSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>
                  {scanning ? 'BULUNANLAR' : `${foundDevices.length} CİHAZ BULUNDU`}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.deviceList}>
                {foundDevices.map((device, idx) => {
                  const existing = findRegistered(device.ip);
                  const meta     = TYPE_META[device.type];
                  const isLast   = idx === foundDevices.length - 1;

                  return (
                    <TouchableOpacity
                      key={device.ip}
                      onPress={() => handleSelectDevice(device)}
                      activeOpacity={0.75}
                      style={[
                        styles.deviceRow,
                        !isLast && styles.deviceRowBorder,
                        existing && styles.deviceRowRegistered,
                      ]}
                    >
                      <View style={styles.deviceRowLeft}>
                        <View style={[styles.deviceDot, {
                          backgroundColor: existing ? Colors.cyan : Colors.green,
                        }]} />
                        <View style={styles.deviceRowInfo}>
                          <View style={styles.deviceIpRow}>
                            <Text style={styles.deviceRowIp}>{device.ip}</Text>
                            {/* PIN rozeti */}
                            {device.pinRequired && (
                              <View style={styles.pinBadge}>
                                <Text style={styles.pinBadgeText}>🔒 PIN</Text>
                              </View>
                            )}
                          </View>

                          {/* Cihaz tipi rozeti */}
                          <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                              {meta.label}
                              {device.leds ? ` · ${device.leds} LED` : ''}
                            </Text>
                          </View>

                          {existing
                            ? <Text style={[styles.deviceRowName, { color: Colors.cyan }]}>{existing.name}</Text>
                            : <Text style={styles.deviceRowNew}>Yeni cihaz — eklemek için bas</Text>
                          }
                        </View>
                      </View>

                      <View style={styles.deviceRowRight}>
                        {existing ? (
                          <View style={styles.registeredBadge}>
                            <Text style={styles.registeredBadgeText}>KAYITLI</Text>
                          </View>
                        ) : (
                          <Text style={styles.addArrow}>+</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Boş durum */}
          {!scanning && foundDevices.length === 0 && progress.scanned > 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Cihaz bulunamadı</Text>
              <Text style={styles.emptySubText}>
                ESP32'nin aynı WiFi ağında olduğundan emin ol
              </Text>
            </View>
          )}

          {/* Yeni cihaz kayıt formu */}
          {form && (
            <View style={styles.nameForm}>

              {/* Seçilen cihaz bilgisi */}
              <View style={styles.selectedHeader}>
                <View style={styles.selectedIpRow}>
                  <View style={styles.selectedIpDot} />
                  <Text style={styles.selectedIpLabel}>SEÇİLEN CİHAZ</Text>
                  <Text style={styles.selectedIpValue}>{form.ip}</Text>
                  {form.pinRequired && (
                    <View style={styles.pinBadge}>
                      <Text style={styles.pinBadgeText}>🔒 PIN</Text>
                    </View>
                  )}
                </View>

                {/* Tip rozeti */}
                {(() => {
                  const found = foundDevices.find((d) => d.ip === form.ip);
                  const meta  = found ? TYPE_META[found.type] : null;
                  return meta ? (
                    <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  ) : null;
                })()}
              </View>

              <View style={styles.nameDivider} />

              {/* Cihaz adı */}
              <Text style={styles.fieldLabel}>CİHAZ ADI</Text>
              <TextInput
                value={form.deviceName}
                onChangeText={(t) => setForm({ ...form, deviceName: t })}
                placeholder="örn. Salon Lambası"
                placeholderTextColor={Colors.text3}
                autoFocus={!form.pinRequired}
                returnKeyType={form.pinRequired ? 'next' : 'done'}
                onSubmitEditing={form.pinRequired ? undefined : handleSave}
                style={styles.nameInput}
              />

              {/* PIN girişi — opsiyonel */}
              <Text style={styles.fieldLabel}>CİHAZ PIN'İ (OPSİYONEL)</Text>
              <TextInput
                value={form.pin}
                onChangeText={(t) => {
                  setForm({ ...form, pin: t.replace(/\D/g, '') });
                  setPinError(null);
                }}
                placeholder={form.pinRequired ? 'Kurulumda belirlediğin PIN' : 'PIN belirlenmediyse boş bırak'}
                placeholderTextColor={Colors.text3}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                style={[styles.nameInput, pinError && { borderColor: Colors.red }]}
              />
              {pinError && (
                <View style={styles.pinErrorBox}>
                  <Text style={styles.pinErrorText}>⚠ {pinError}</Text>
                </View>
              )}
              <View style={styles.pinHintBox}>
                <Text style={styles.pinHintText}>
                  {form.pinRequired
                    ? '🔒 Bu cihaz PIN korumalı. Kurulum sırasında belirlediğin PIN\'i gir.'
                    : 'ℹ️  PIN belirlenmediyse boş bırakabilirsin.'}
                </Text>
              </View>

              {/* Kaydet butonu */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!form.deviceName.trim() || saving}
                activeOpacity={0.75}
                style={[
                  styles.saveBtn,
                  (!form.deviceName.trim() || saving) && styles.saveBtnDisabled,
                ]}
              >
                <Text style={[
                  styles.saveBtnText,
                  (!form.deviceName.trim() || saving) && styles.saveBtnTextDisabled,
                ]}>
                  {saving ? '[ KAYDEDİLİYOR... ]' : '[ KAYDET ve BAĞLAN ]'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setForm(null); setPinError(null); }}
                activeOpacity={0.75}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>← Listeye Dön</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tarama butonu */}
          {!form && (
            <>
              {foundDevices.length === 0 && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>AKSİYON</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}
              <TouchableOpacity
                onPress={startScan}
                disabled={scanning}
                activeOpacity={0.75}
                style={[styles.primaryBtn, scanning && styles.btnDisabled]}
              >
                <Text style={styles.primaryBtnLabel}>
                  {foundDevices.length > 0 ? 'YENİDEN TARA' : 'TARAMA'}
                </Text>
                <Text style={[styles.primaryBtnText, scanning && styles.btnTextDisabled]}>
                  {scanning ? '[ Taranıyor... ]' : foundDevices.length > 0 ? '[ Tekrar Tara ]' : '[ Ağda Ara ]'}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  kavWrapper: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  scrollContent: { flexGrow: 1, gap: Spacing.xl, paddingBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.lg },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 60, justifyContent: 'flex-end' },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  headerMeta: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },
  titleBlock: { gap: Spacing.sm },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: { fontFamily: Fonts.sans, fontSize: 42, lineHeight: 48, letterSpacing: -0.5, color: Colors.text, fontWeight: '300' },
  titleDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, lineHeight: 20, marginTop: Spacing.xs },
  wifiWarning: { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm, backgroundColor: Colors.bg3, padding: Spacing.md, marginTop: Spacing.xs },
  wifiWarningText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text3, lineHeight: 18 },
  scanningCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg3, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  scanningTextGroup: { flex: 1, gap: 2 },
  scanningLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.cyan },
  scanningSubLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  scanningPct: { fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 2, color: Colors.cyan },
  progressTrack: { height: 2, backgroundColor: Colors.border, borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.cyan, borderRadius: 1 },
  deviceListSection: { gap: Spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  dividerLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  deviceList: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  deviceRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border3 },
  deviceRowRegistered: { backgroundColor: Colors.cyanAlpha },
  deviceRowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, flex: 1 },
  deviceDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 4 },
  deviceRowInfo: { flex: 1, gap: Spacing.xs },
  deviceIpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deviceRowIp: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 1.5, color: Colors.text },
  pinBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2 },
  pinBadgeText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text2 },
  typeBadge: { flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  typeBadgeText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1 },
  deviceRowName: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text2 },
  deviceRowNew: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3 },
  deviceRowRight: { alignItems: 'flex-end' },
  registeredBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  registeredBadgeText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.cyan },
  addArrow: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.green },
  emptyBox: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text2 },
  emptySubText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text3, textAlign: 'center' },
  nameForm: { borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.md, backgroundColor: Colors.cyanAlpha, padding: Spacing.lg, gap: Spacing.md },
  selectedHeader: { gap: Spacing.sm },
  selectedIpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  selectedIpDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: Colors.cyan },
  selectedIpLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.cyan },
  selectedIpValue: { fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 2, color: Colors.text },
  nameDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  fieldLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  nameInput: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 1, color: Colors.text },
  pinErrorBox: { borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm, backgroundColor: Colors.redAlpha, padding: Spacing.sm },
  pinErrorText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },
  pinHintBox: { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm, backgroundColor: Colors.bg4, padding: Spacing.sm },
  pinHintText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3, lineHeight: 16 },
  saveBtn: { borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.bg2, paddingVertical: Spacing.md, alignItems: 'center' },
  saveBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg3 },
  saveBtnText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.cyan },
  saveBtnTextDisabled: { color: Colors.text3 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.text2 },
  primaryBtn: { borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 2 },
  primaryBtnLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.cyan2 },
  primaryBtnText: { fontFamily: Fonts.mono, fontSize: 15, letterSpacing: 2, color: Colors.cyan },
  btnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg3 },
  btnTextDisabled: { color: Colors.text3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});