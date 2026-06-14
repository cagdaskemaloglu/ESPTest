/**
 * screens/SetupScreen.tsx
 * ESP32'ye WiFi bilgilerini ve PIN'i gönderen kurulum ekranı.
 *
 * Akış:
 *   1. ESP32-Setup ağına ping → bağlantı kontrolü
 *   2. WiFi ağlarını tara (ESP32'den)
 *   3. SSID seç + şifre gir
 *   4. PIN belirle (4-6 hane)
 *   5. Kurulumu tamamla → ESP32 restart → ev WiFi'ına bağlanır
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

const ESP32_AP_IP      = '192.168.4.1';
const PING_INTERVAL_MS = 3000;
const PING_TIMEOUT_MS  = 2000;

type Props = { onDone: () => void; onBack: () => void };
type ConnState = 'checking' | 'connected' | 'disconnected';

type WifiNetwork = { ssid: string; rssi: number };

function signalBars(rssi: number): string {
  if (rssi >= -50) return '████';
  if (rssi >= -65) return '███░';
  if (rssi >= -75) return '██░░';
  if (rssi >= -85) return '█░░░';
  return '░░░░';
}

function signalLabel(rssi: number): string {
  if (rssi >= -50) return 'Mükemmel';
  if (rssi >= -65) return 'İyi';
  if (rssi >= -75) return 'Orta';
  if (rssi >= -85) return 'Zayıf';
  return 'Çok Zayıf';
}

export default function SetupScreen({ onDone, onBack }: Props) {
  const [ssid, setSsid]         = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin]           = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [loading, setLoading]   = useState(false);
  const [phase, setPhase]       = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const [connState, setConnState] = useState<ConnState>('checking');
  const [wifiList, setWifiList]   = useState<WifiNetwork[]>([]);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [pinError, setPinError]   = useState<string | null>(null);
  // Manuel SSID girişi — varsayılan kapalı
  const [showManualInput, setShowManualInput] = useState(false);
  // Dropdown — tarama bitince otomatik açılır, seçince kapanır
  const [showDropdown, setShowDropdown] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(true);

  const pingESP32 = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const res   = await fetch(`http://${ESP32_AP_IP}/whoami`, { signal: controller.signal });
      clearTimeout(timer);
      if (!mountedRef.current) return;
      setConnState(res.ok ? 'connected' : 'disconnected');
    } catch {
      if (!mountedRef.current) return;
      setConnState('disconnected');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    pingESP32();
    intervalRef.current = setInterval(pingESP32, PING_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pingESP32]);

  // ESP32'ye bağlanınca otomatik WiFi taraması başlat
  const prevConnState = useRef<ConnState>('checking');
  useEffect(() => {
    if (prevConnState.current !== 'connected' && connState === 'connected') {
      scanWifiNetworks();
    }
    prevConnState.current = connState;
  }, [connState]);

  const scanWifiNetworks = async () => {
    setWifiError(null);
    setScanningWifi(true);
    setWifiList([]);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res   = await fetch(`http://${ESP32_AP_IP}/wifi/scan`, { signal: controller.signal });
      clearTimeout(timer);
      if (!mountedRef.current) return;
      const data = await res.json() as WifiNetwork[];
      if (data.length === 0) {
        setWifiError('Çevrede ağ bulunamadı. Tekrar dene.');
      } else {
        setWifiList(data.filter((n) => n.ssid.trim() !== '').sort((a, b) => b.rssi - a.rssi));
        setShowDropdown(true); // Tarama bitince otomatik aç
      }
    } catch {
      if (!mountedRef.current) return;
      setWifiError('Ağ listesi alınamadı.\nESP32-Setup ağına bağlı olduğundan emin ol.');
    }
    setScanningWifi(false);
  };

  const validatePin = (): boolean => {
    setPinError(null);
    // PIN boşsa opsiyonel — doğrulama atla
    if (pin.length === 0) return true;
    if (pin.length < 4) { setPinError('PIN en az 4 haneli olmalı'); return false; }
    if (pin.length > 6) { setPinError('PIN en fazla 6 haneli olmalı'); return false; }
    if (!/^\d+$/.test(pin)) { setPinError('PIN sadece rakamlardan oluşmalı'); return false; }
    if (pin !== pinConfirm) { setPinError('PIN\'ler eşleşmiyor'); return false; }
    return true;
  };

  const setup = async () => {
    if (!ssid.trim()) { setStatusMsg('WiFi ağ adı boş olamaz.'); setPhase('error'); return; }
    if (!validatePin()) return;

    setLoading(true);
    setPhase('connecting');
    setStatusMsg("ESP32'ye bağlanıyor...");

    try {
      // WiFi + PIN aynı istekte gönderilir
      const url = `http://${ESP32_AP_IP}/setup` +
        `?ssid=${encodeURIComponent(ssid)}` +
        `&password=${encodeURIComponent(password)}` +
        `&pin=${encodeURIComponent(pin)}`;

      const res  = await fetch(url);
      const text = await res.text();
      console.log('SETUP RESPONSE:', text);

      setPhase('done');
      setStatusMsg('Kaydedildi! ESP32 yeniden başlıyor...');

      // Kurulum tamamlandı — StartScreen'de "Cihaz Ara" aktif olsun
      await AsyncStorage.setItem('torva_setup_done', 'true');

      setTimeout(() => {
        setLoading(false);
        onDone();
      }, 2000);
    } catch {
      setPhase('error');
      setStatusMsg("❌ ESP32'ye bağlanılamadı. ESP32-Setup ağına bağlı olduğundan emin ol.");
      setLoading(false);
    }
  };

  const isConnected = connState === 'connected';
  const isChecking  = connState === 'checking';

  const statusColor =
    phase === 'error'      ? Colors.red   :
    phase === 'done'       ? Colors.green :
    phase === 'connecting' ? Colors.cyan  :
    Colors.text2;

  const dotColor =
    isChecking  ? Colors.text3 :
    isConnected ? Colors.green :
    Colors.red;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
            <Text style={styles.headerBackText}>← GERİ</Text>
          </TouchableOpacity>
          <Text style={styles.headerBrand}>TORVA · LAB</Text>
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={styles.headerMeta}>SETUP</Text>
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
            <Text style={styles.titleLabel}>// KURULUM</Text>
            <Text style={styles.titleSub}>ESP32 Wi-Fi Yapılandırması</Text>
          </View>

          {/* Bağlantı durum kartı */}
          <View style={[styles.connCard, {
            borderColor: isConnected ? Colors.green : isChecking ? Colors.border : Colors.red,
            backgroundColor: isConnected ? Colors.greenAlpha : Colors.bg3,
          }]}>
            <View style={styles.connCardRow}>
              {isChecking
                ? <ActivityIndicator size="small" color={Colors.cyan} style={styles.connIcon} />
                : <View style={[styles.connDot, { backgroundColor: dotColor }]} />
              }
              <View style={styles.connCardText}>
                {isChecking && (
                  <><Text style={styles.connCardTitle}>ESP32 aranıyor...</Text>
                  <Text style={styles.connCardSub}>192.168.4.1 kontrol ediliyor</Text></>
                )}
                {isConnected && (
                  <><Text style={[styles.connCardTitle, { color: Colors.green }]}>ESP32-Setup'a bağlısın ✓</Text>
                  <Text style={styles.connCardSub}>WiFi ağlarını tarayabilir ve kurulumu tamamlayabilirsin</Text></>
                )}
                {connState === 'disconnected' && (
                  <><Text style={[styles.connCardTitle, { color: Colors.red }]}>ESP32-Setup ağına bağlı değilsin</Text>
                  <Text style={styles.connCardSub}>Telefon WiFi ayarlarından ESP32-Setup ağını seç</Text></>
                )}
              </View>
              {!isChecking && (
                <TouchableOpacity onPress={pingESP32} style={styles.refreshBtn}>
                  <Text style={styles.refreshText}>↺</Text>
                </TouchableOpacity>
              )}
            </View>

            {connState === 'disconnected' && (
              <View style={styles.connSteps}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>01</Text>
                  <Text style={styles.stepText}>Telefon WiFi ayarlarını aç</Text>
                </View>
                <View style={styles.stepDivider} />
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>02</Text>
                  <Text style={styles.stepText}>
                    <Text style={styles.stepHighlight}>ESP32-Setup</Text>{' '}ağını seç ve bağlan
                  </Text>
                </View>
                <View style={styles.stepDivider} />
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>03</Text>
                  <Text style={styles.stepText}>Bu uygulamaya geri dön — bağlantı otomatik algılanacak</Text>
                </View>
              </View>
            )}
          </View>

          {/* WiFi tarama + seçim */}
          <View style={styles.wifiSection}>

            {/* Bölüm başlığı */}
            <View style={styles.wifiHeader}>
              <Text style={styles.wifiHeaderLabel}>WiFi AĞINI SEÇ</Text>
              {isConnected && (
                <TouchableOpacity onPress={scanWifiNetworks} disabled={scanningWifi}>
                  <Text style={[styles.wifiRescanText, scanningWifi && { color: Colors.text3 }]}>
                    {scanningWifi ? 'Taranıyor...' : '↺ Yenile'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Taranıyor göstergesi */}
            {scanningWifi && (
              <View style={styles.scanningRow}>
                <ActivityIndicator size="small" color={Colors.cyan} />
                <Text style={styles.scanningText}>ESP32 ağları tarıyor...</Text>
              </View>
            )}

            {/* Hata */}
            {wifiError && !scanningWifi && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{wifiError}</Text>
              </View>
            )}

            {/* Bağlı değilse bilgi */}
            {!isConnected && !scanningWifi && wifiList.length === 0 && !wifiError && (
              <View style={styles.wifiNotConnectedBox}>
                <Text style={styles.wifiNotConnectedText}>
                  ESP32-Setup ağına bağlandıktan sonra ağ listesi otomatik yüklenir.
                </Text>
              </View>
            )}

            {/* WiFi dropdown listesi */}
            {!scanningWifi && wifiList.length > 0 && (
              <View style={styles.wifiDropdown}>

                {/* Dropdown başlık — tıklayınca aç/kapat */}
                <TouchableOpacity
                  onPress={() => setShowDropdown((p) => !p)}
                  activeOpacity={0.75}
                  style={styles.wifiDropdownHeader}
                >
                  <Text style={styles.wifiDropdownHeaderLabel}>
                    {ssid && !showManualInput
                      ? `✓  ${ssid}`
                      : `${wifiList.length} ağ bulundu — seçmek için bas`}
                  </Text>
                  <Text style={styles.wifiDropdownChevron}>
                    {showDropdown ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {/* Liste — showDropdown açıksa göster */}
                {showDropdown && (
                  <View style={styles.wifiList}>
                    {wifiList.map((network, idx) => (
                      <TouchableOpacity
                        key={`${network.ssid}-${idx}`}
                        onPress={() => {
                          setSsid(network.ssid);
                          setShowManualInput(false);
                          setShowDropdown(false); // Seçince kapat
                        }}
                        activeOpacity={0.75}
                        style={[
                          styles.wifiItem,
                          ssid === network.ssid && !showManualInput && styles.wifiItemSelected,
                          idx === wifiList.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={styles.wifiItemLeft}>
                          <View style={[styles.wifiItemDot, {
                            backgroundColor: ssid === network.ssid && !showManualInput
                              ? Colors.cyan : Colors.border2,
                          }]} />
                          <Text style={[
                            styles.wifiItemSsid,
                            ssid === network.ssid && !showManualInput && { color: Colors.cyan },
                          ]}>
                            {network.ssid}
                          </Text>
                        </View>
                        <View style={styles.wifiItemRight}>
                          <Text style={styles.wifiItemBars}>{signalBars(network.rssi)}</Text>
                          <Text style={styles.wifiItemLabel}>{signalLabel(network.rssi)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Seçilen ağ göstergesi — dropdown kapalıyken */}
            {ssid !== '' && !showManualInput && !showDropdown && (
              <View style={styles.selectedNetworkRow}>
                <View style={styles.selectedNetworkDot} />
                <Text style={styles.selectedNetworkLabel}>SEÇİLEN:</Text>
                <Text style={styles.selectedNetworkSsid}>{ssid}</Text>
              </View>
            )}

            {/* Manuel giriş toggle */}
            <TouchableOpacity
              onPress={() => {
                setShowManualInput((p) => !p);
                if (!showManualInput) { setSsid(''); setShowDropdown(false); }
                else setShowDropdown(wifiList.length > 0);
              }}
              style={styles.manualToggle}
              activeOpacity={0.7}
            >
              <Text style={styles.manualToggleText}>
                {showManualInput ? '▲ Listeden seç' : '✎ Ağ adını elle gir'}
              </Text>
            </TouchableOpacity>

            {/* Manuel SSID input */}
            {showManualInput && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>WiFi ADI (SSID)</Text>
                <TextInput
                  value={ssid}
                  onChangeText={setSsid}
                  placeholder="ağ adını gir"
                  placeholderTextColor={Colors.text3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="next"
                  style={styles.input}
                />
              </View>
            )}

          </View>

          {/* Şifre */}
          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ŞİFRE</Text>
              <TextInput
                value={password} onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.text3}
                secureTextEntry autoCapitalize="none" autoCorrect={false} returnKeyType="next"
                style={styles.input}
              />
            </View>
          </View>

          {/* PIN Belirleme */}
          <View style={styles.pinSection}>
            <View style={styles.pinHeader}>
              <Text style={styles.pinTitle}>// GÜVENLİK PIN'İ (OPSİYONEL)</Text>
              <Text style={styles.pinDesc}>
                4-6 haneli bir PIN belirleyebilirsin. PIN belirlerseniz aynı ağdaki
                başkalarının cihazına erişmesi engellenir. Boş bırakırsan PIN koruması olmaz.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PIN (4-6 HANE) — OPSİYONEL</Text>
              <TextInput
                value={pin} onChangeText={(t) => { setPin(t); setPinError(null); }}
                placeholder="boş bırakabilirsin"
                placeholderTextColor={Colors.text3}
                keyboardType="numeric" maxLength={6} returnKeyType="next"
                secureTextEntry
                style={[styles.input, pinError && styles.inputError]}
              />
            </View>

            {/* PIN girildiyse tekrar alanı göster */}
            {pin.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PIN TEKRAR</Text>
                <TextInput
                  value={pinConfirm} onChangeText={(t) => { setPinConfirm(t); setPinError(null); }}
                  placeholder="PIN'i tekrar gir"
                  placeholderTextColor={Colors.text3}
                  keyboardType="numeric" maxLength={6} returnKeyType="done"
                  secureTextEntry onSubmitEditing={setup}
                  style={[styles.input, pinError && styles.inputError]}
                />
              </View>
            )}

            {pinError && (
              <View style={styles.pinErrorBox}>
                <Text style={styles.pinErrorText}>⚠ {pinError}</Text>
              </View>
            )}

            <View style={styles.pinNote}>
              <Text style={styles.pinNoteText}>
                {pin.length > 0
                  ? '📌 PIN\'ini not et — cihaz sıfırlanırsa yeniden belirlenir.'
                  : 'ℹ️  PIN belirlemeden devam edebilirsin. Dilediğin zaman cihazı sıfırlayıp yeniden kurabilirsin.'}
              </Text>
            </View>
          </View>

          {/* Durum */}
          {statusMsg !== '' && (
            <View style={[styles.statusBar, { backgroundColor: statusColor + '22' }]}>
              <View style={[styles.statusBarAccent, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusMsg}</Text>
            </View>
          )}

          {/* Butonlar */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              onPress={setup}
              disabled={loading || !ssid.trim()}
              activeOpacity={0.75}
              style={[styles.primaryBtn, (loading || !ssid.trim()) && styles.primaryBtnDisabled]}
            >
              <Text style={[styles.primaryBtnText, (loading || !ssid.trim()) && styles.primaryBtnTextDisabled]}>
                {loading ? '[ BAĞLANIYOR... ]' : '[ KURULUMU TAMAMLA ]'}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{ESP32_AP_IP}</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>ESP32 Access Point</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  kavWrapper: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  scrollContent: { flexGrow: 1, gap: Spacing.xl, paddingBottom: Spacing.xl },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.lg },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerBackBtn: { paddingVertical: 4, paddingRight: Spacing.md },
  headerBackText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text2 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  headerMeta: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },
  titleBlock: { gap: Spacing.xs },
  titleLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleSub: { fontFamily: Fonts.sans, fontSize: 22, letterSpacing: 0.5, color: Colors.text, fontWeight: '300' },
  connCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.md },
  connCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  connIcon: { marginTop: 2 },
  connDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  connCardText: { flex: 1, gap: 2 },
  connCardTitle: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', color: Colors.text },
  connCardSub: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3, lineHeight: 16 },
  refreshBtn: { padding: 4 },
  refreshText: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text2 },
  connSteps: { gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepNum: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan, marginTop: 2, minWidth: 20 },
  stepText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, flex: 1, lineHeight: 20 },
  stepHighlight: { fontFamily: Fonts.mono, color: Colors.cyan, fontSize: 12 },
  stepDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border3 },
  wifiSection: { gap: Spacing.md },
  wifiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wifiHeaderLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  wifiRescanText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  scanningText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },
  wifiNotConnectedBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg3, padding: Spacing.md },
  wifiNotConnectedText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3, lineHeight: 16 },
  errorBox: { borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm, backgroundColor: Colors.redAlpha, padding: Spacing.md },
  errorText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red, lineHeight: 18 },
  wifiDropdown: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  wifiDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  wifiDropdownHeaderLabel: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text, flex: 1 },
  wifiDropdownChevron: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text3, marginLeft: Spacing.sm },
  wifiList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, overflow: 'hidden' },
  wifiItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border3 },
  wifiItemSelected: { backgroundColor: Colors.cyanAlpha },
  wifiItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  wifiItemDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  wifiItemSsid: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.text, flex: 1 },
  wifiItemRight: { alignItems: 'flex-end', gap: 2 },
  wifiItemBars: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text2, letterSpacing: 1 },
  wifiItemLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  selectedNetworkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  selectedNetworkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cyan },
  selectedNetworkLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  selectedNetworkSsid: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 1, color: Colors.cyan, flex: 1 },
  manualToggle: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  manualToggleText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  formSection: { gap: Spacing.lg },
  fieldGroup: { gap: Spacing.sm },
  fieldLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  input: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 1, color: Colors.text },
  inputError: { borderColor: Colors.red },
  // PIN bölümü
  pinSection: { gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.lg },
  pinHeader: { gap: Spacing.sm },
  pinTitle: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.cyan },
  pinDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, lineHeight: 20 },
  pinErrorBox: { borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm, backgroundColor: Colors.redAlpha, padding: Spacing.md },
  pinErrorText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },
  pinNote: { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm, backgroundColor: Colors.bg4, padding: Spacing.md },
  pinNoteText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text3, lineHeight: 18 },
  statusBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  statusBarAccent: { width: 2, minHeight: 16, borderRadius: 1 },
  statusText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, flex: 1, lineHeight: 18 },
  buttonGroup: { gap: Spacing.md },
  primaryBtn: { width: '100%', height: 50, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg3 },
  primaryBtnText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 3, color: Colors.cyan },
  primaryBtnTextDisabled: { color: Colors.text3 },
  secondaryBtn: { width: '100%', height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 3, color: Colors.text2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});