/**
 * screens/SetupScreen.tsx
 * ESP32'ye WiFi bilgilerini gönderen kurulum ekranı.
 *
 * WiFi listesi ESP32'nin /wifi/scan endpoint'inden çekilir.
 * Bu yaklaşım iOS ve Android'de aynı şekilde çalışır —
 * platform izni veya kısıtlaması yoktur.
 *
 * Akış:
 *   1. Kullanıcı önce ESP32-Setup ağına bağlanır (talimat gösterilir)
 *   2. "Ağları Tara" butonuna basar → ESP32'den WiFi listesi çekilir
 *   3. Listeden kendi ağını seçer
 *   4. Şifresini girer ve kurulumu tamamlar
 *
 * iOS notu:
 *   Bağlı ağ adı @react-native-community/netinfo ile okunur.
 *   ESP32-Setup'a bağlıysa otomatik devam eder, değilse talimat gösterilir.
 */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
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

// ESP32 AP IP adresi — her zaman sabit
const ESP32_AP_IP = '192.168.4.1';

type Props = { onDone: () => void };

type WifiNetwork = {
  ssid: string;
  rssi: number;
};

// rssi değerini görsel sinyal çubuklarına çevir
function signalBars(rssi: number): string {
  if (rssi >= -50) return '████';
  if (rssi >= -65) return '███░';
  if (rssi >= -75) return '██░░';
  if (rssi >= -85) return '█░░░';
  return '░░░░';
}

// rssi'yi kullanıcı dostu sinyal etiketine çevir
function signalLabel(rssi: number): string {
  if (rssi >= -50) return 'Mükemmel';
  if (rssi >= -65) return 'İyi';
  if (rssi >= -75) return 'Orta';
  if (rssi >= -85) return 'Zayıf';
  return 'Çok Zayıf';
}

export default function SetupScreen({ onDone }: Props) {
  const [ssid, setSsid]         = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState('ESP32-Setup ağına bağlandıktan sonra ağları tarayabilirsin');
  const [loading, setLoading]   = useState(false);
  const [phase, setPhase]       = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');

  // ESP32-Setup ağına bağlı mı?
  const [isOnESP32, setIsOnESP32]     = useState(false);
  const [connectedSsid, setConnectedSsid] = useState<string | null>(null);
  const [checkingConn, setCheckingConn]   = useState(true);

  // WiFi listesi
  const [wifiList, setWifiList]       = useState<WifiNetwork[]>([]);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [showList, setShowList]         = useState(false);
  const [wifiError, setWifiError]       = useState<string | null>(null);

  // Bağlı ağı kontrol et — her 3 saniyede bir güncelle
  useEffect(() => {
    const check = async () => {
      setCheckingConn(true);
      try {
        const state = await NetInfo.fetch();
        const currentSsid = (state as any)?.details?.ssid ?? null;
        setConnectedSsid(currentSsid);
        setIsOnESP32(
          currentSsid === 'ESP32-Setup' || currentSsid === 'ESP32-Light'
        );
      } catch {
        setIsOnESP32(false);
      }
      setCheckingConn(false);
    };

    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  // ESP32'den WiFi listesini çek
  const scanWifiNetworks = async () => {
    setWifiError(null);
    setScanningWifi(true);
    setShowList(true);
    setWifiList([]);

    try {
      // ESP32'nin WiFi taraması ~2-3 saniye sürer
      const res  = await fetch(`http://${ESP32_AP_IP}/wifi/scan`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json() as WifiNetwork[];

      if (data.length === 0) {
        setWifiError('Çevrede ağ bulunamadı. Tekrar dene.');
      } else {
        // Sinyal gücüne göre sırala, boş SSID'leri filtrele
        const sorted = data
          .filter((n) => n.ssid && n.ssid.trim() !== '')
          .sort((a, b) => b.rssi - a.rssi);
        setWifiList(sorted);
      }
    } catch (e) {
      setWifiError(
        'ESP32\'ye bağlanılamadı.\n' +
        'ESP32-Setup ağına bağlı olduğundan emin ol.'
      );
    }

    setScanningWifi(false);
  };

  // Listeden ağ seç
  const selectNetwork = (network: WifiNetwork) => {
    setSsid(network.ssid);
    setShowList(false);
  };

  // Kurulum isteği gönder
  const setup = async () => {
    if (!ssid.trim()) {
      setStatus('WiFi ağ adı boş olamaz.');
      setPhase('error');
      return;
    }

    console.log('SETUP BAŞLADI');
    setLoading(true);
    setPhase('connecting');
    setStatus("ESP32'ye bağlanıyor...");

    try {
      const url  = `http://${ESP32_AP_IP}/setup?ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(password)}`;
      console.log('REQUEST:', url);
      const res  = await fetch(url);
      const text = await res.text();
      console.log('RESPONSE:', text);

      setPhase('done');
      setStatus('Kaydedildi! ESP32 yeniden başlıyor...');

      setTimeout(() => {
        setStatus("Şimdi kendi WiFi ağına geri dön ve 'Cihaz Ara'ya bas");
        setLoading(false);
        onDone();
      }, 2000);

    } catch (e) {
      console.log('HATA:', e);
      setPhase('error');
      setStatus("❌ ESP32'ye bağlanılamadı. ESP32-Setup ağına bağlı olduğundan emin ol.");
      setLoading(false);
    }
  };

  const statusColor =
    phase === 'error'      ? Colors.red   :
    phase === 'done'       ? Colors.green :
    phase === 'connecting' ? Colors.cyan  :
    Colors.text2;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>TORVA · LAB</Text>
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, {
              backgroundColor:
                phase === 'connecting' ? Colors.cyan  :
                phase === 'done'       ? Colors.green :
                phase === 'error'      ? Colors.red   :
                isOnESP32              ? Colors.green :
                Colors.text3,
            }]} />
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

          {/* ── Bağlantı durum kartı ── */}
          <View style={[styles.connCard, {
            borderColor: isOnESP32 ? Colors.green : Colors.border,
            backgroundColor: isOnESP32 ? Colors.greenAlpha : Colors.bg3,
          }]}>
            <View style={styles.connCardRow}>
              {checkingConn ? (
                <ActivityIndicator size="small" color={Colors.cyan} />
              ) : (
                <View style={[styles.connDot, {
                  backgroundColor: isOnESP32 ? Colors.green : Colors.amber,
                }]} />
              )}
              <View style={styles.connCardText}>
                {isOnESP32 ? (
                  <>
                    <Text style={[styles.connCardTitle, { color: Colors.green }]}>
                      ESP32-Setup ağına bağlısın
                    </Text>
                    <Text style={styles.connCardSub}>
                      Aşağıdan WiFi ağlarını tarayabilirsin
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.connCardTitle, { color: Colors.amber }]}>
                      ESP32-Setup ağına bağlı değilsin
                    </Text>
                    <Text style={styles.connCardSub}>
                      {connectedSsid
                        ? `Şu an bağlısın: ${connectedSsid}`
                        : 'Telefon WiFi ayarlarından ESP32-Setup ağını seç'}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Bağlı değilken adım talimatı */}
            {!isOnESP32 && (
              <View style={styles.connSteps}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>01</Text>
                  <Text style={styles.stepText}>
                    Telefon WiFi ayarlarını aç
                  </Text>
                </View>
                <View style={styles.stepDivider} />
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>02</Text>
                  <Text style={styles.stepText}>
                    <Text style={styles.stepHighlight}>ESP32-Setup</Text>
                    {' '}ağını seç ve bağlan
                  </Text>
                </View>
                <View style={styles.stepDivider} />
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>03</Text>
                  <Text style={styles.stepText}>
                    Bu uygulamaya geri dön — bağlantı otomatik algılanacak
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── WiFi tarama bölümü ── */}
          <View style={styles.wifiSection}>

            {/* Tara butonu */}
            <TouchableOpacity
              onPress={scanWifiNetworks}
              disabled={scanningWifi || !isOnESP32}
              activeOpacity={0.75}
              style={[
                styles.scanWifiBtn,
                (!isOnESP32 || scanningWifi) && styles.scanWifiBtnDisabled,
              ]}
            >
              {scanningWifi ? (
                <ActivityIndicator size="small" color={Colors.cyan} />
              ) : (
                <Text style={styles.scanWifiBtnLabel}>YAKINDAKI AĞLAR</Text>
              )}
              <Text style={[
                styles.scanWifiBtnText,
                (!isOnESP32 || scanningWifi) && { color: Colors.text3 },
              ]}>
                {scanningWifi
                  ? 'ESP32 ağları tarıyor...'
                  : isOnESP32
                    ? '[ Ağları Tara ]'
                    : '[ Önce ESP32-Setup\'a Bağlan ]'}
              </Text>
            </TouchableOpacity>

            {/* WiFi hata mesajı */}
            {wifiError && (
              <View style={styles.wifiErrorBox}>
                <Text style={styles.wifiErrorText}>{wifiError}</Text>
              </View>
            )}

            {/* WiFi listesi */}
            {showList && !scanningWifi && wifiList.length > 0 && (
              <View style={styles.wifiList}>
                {wifiList.map((network, idx) => (
                  <TouchableOpacity
                    key={`${network.ssid}-${idx}`}
                    onPress={() => selectNetwork(network)}
                    activeOpacity={0.75}
                    style={[
                      styles.wifiItem,
                      ssid === network.ssid && styles.wifiItemSelected,
                      idx === wifiList.length - 1 && styles.wifiItemLast,
                    ]}
                  >
                    {/* Sol: seçili göstergesi + SSID */}
                    <View style={styles.wifiItemLeft}>
                      <View style={[styles.wifiItemDot, {
                        backgroundColor: ssid === network.ssid
                          ? Colors.cyan : Colors.border2,
                      }]} />
                      <Text style={[
                        styles.wifiItemSsid,
                        ssid === network.ssid && { color: Colors.cyan },
                      ]}>
                        {network.ssid}
                      </Text>
                    </View>

                    {/* Sağ: sinyal gücü */}
                    <View style={styles.wifiItemRight}>
                      <Text style={styles.wifiItemBars}>
                        {signalBars(network.rssi)}
                      </Text>
                      <Text style={styles.wifiItemLabel}>
                        {signalLabel(network.rssi)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>

          {/* ── Form ── */}
          <View style={styles.formSection}>

            {/* SSID */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>WiFi SSID</Text>
              <TextInput
                value={ssid}
                onChangeText={setSsid}
                placeholder="ağ adını gir veya listeden seç"
                placeholderTextColor={Colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.input}
              />
            </View>

            {/* Şifre */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ŞİFRE</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.text3}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={setup}
                style={styles.input}
              />
            </View>

          </View>

          {/* Durum mesajı */}
          <View style={[styles.statusBar, { backgroundColor: statusColor + '22' }]}>
            <View style={[styles.statusBarAccent, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
          </View>

          {/* Butonlar */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              onPress={setup}
              disabled={loading || !ssid.trim()}
              activeOpacity={0.75}
              style={[styles.primaryBtn, (loading || !ssid.trim()) && styles.primaryBtnDisabled]}
            >
              <Text style={[
                styles.primaryBtnText,
                (loading || !ssid.trim()) && styles.primaryBtnTextDisabled,
              ]}>
                {loading ? '[ BAĞLANIYOR... ]' : '[ KURULUMU TAMAMLA ]'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDone} activeOpacity={0.75} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>← GERİ</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
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

  // Header
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.lg },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  headerMeta: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },

  // Başlık
  titleBlock: { gap: Spacing.xs },
  titleLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleSub: { fontFamily: Fonts.sans, fontSize: 22, letterSpacing: 0.5, color: Colors.text, fontWeight: '300' },

  // Bağlantı durum kartı
  connCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.md },
  connCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  connDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  connCardText: { flex: 1, gap: 2 },
  connCardTitle: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500' },
  connCardSub: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3, lineHeight: 16 },

  // Bağlı değilken adımlar
  connSteps: { gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepNum: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan, marginTop: 2, minWidth: 20 },
  stepText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, flex: 1, lineHeight: 20 },
  stepHighlight: { fontFamily: Fonts.mono, color: Colors.cyan, fontSize: 12 },
  stepDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border3 },

  // WiFi tarama
  wifiSection: { gap: Spacing.md },
  scanWifiBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg3, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scanWifiBtnDisabled: { opacity: 0.5 },
  scanWifiBtnLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3, minWidth: 100 },
  scanWifiBtnText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 2, color: Colors.cyan },

  // WiFi hata
  wifiErrorBox: { borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm, backgroundColor: Colors.redAlpha, padding: Spacing.md },
  wifiErrorText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red, lineHeight: 18 },

  // WiFi listesi
  wifiList: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  wifiItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border3 },
  wifiItemLast: { borderBottomWidth: 0 },
  wifiItemSelected: { backgroundColor: Colors.cyanAlpha },
  wifiItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  wifiItemDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  wifiItemSsid: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.text, flex: 1 },
  wifiItemRight: { alignItems: 'flex-end', gap: 2 },
  wifiItemBars: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text2, letterSpacing: 1 },
  wifiItemLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },

  // Form
  formSection: { gap: Spacing.lg },
  fieldGroup: { gap: Spacing.sm },
  fieldLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  input: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 1, color: Colors.text },

  // Durum
  statusBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  statusBarAccent: { width: 2, minHeight: 16, borderRadius: 1 },
  statusText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, flex: 1, lineHeight: 18 },

  // Butonlar
  buttonGroup: { gap: Spacing.md },
  primaryBtn: { width: '100%', height: 50, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg3 },
  primaryBtnText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 3, color: Colors.cyan },
  primaryBtnTextDisabled: { color: Colors.text3 },
  secondaryBtn: { width: '100%', height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 3, color: Colors.text2 },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});