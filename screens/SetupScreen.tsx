import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

export default function SetupScreen({ onDone }: { onDone: () => void }) {
  const [ssid, setSsid]         = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState('ESP32 ağına bağlan (ESP32-Setup)');
  const [loading, setLoading]   = useState(false);
  const [phase, setPhase]       = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');

  const setup = async () => {
    console.log('SETUP BAŞLADI');
    setLoading(true);
    setPhase('connecting');
    setStatus("ESP32'ye bağlanıyor...");

    try {
      const url = `http://192.168.4.1/setup?ssid=${ssid}&password=${password}`;
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
      setStatus("❌ ESP32'ye bağlanılamadı. WiFi kontrol et!");
      setLoading(false);
    }
  };

  const statusColor =
    phase === 'error'      ? Colors.red  :
    phase === 'done'       ? Colors.green :
    phase === 'connecting' ? Colors.cyan  :
    Colors.text2;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>TORVA · LAB</Text>
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, {
              backgroundColor: phase === 'connecting' ? Colors.cyan
                             : phase === 'done'       ? Colors.green
                             : phase === 'error'      ? Colors.red
                             : Colors.text3,
            }]} />
            <Text style={styles.headerMeta}>SETUP</Text>
          </View>
        </View>

        <View style={styles.headerDivider} />

        {/* ── Başlık ── */}
        <View style={styles.titleRow}>
          <Text style={styles.titleLabel}>// KURULUM</Text>
          <Text style={styles.titleSub}>ESP32 Wi-Fi Yapılandırması</Text>
        </View>

        {/* ── Adım kartları ── */}
        <View style={styles.stepsCard}>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>01</Text>
            <Text style={styles.stepText}>
              Telefonunu{' '}
              <Text style={styles.stepHighlight}>ESP32-Setup</Text>
              {' '}WiFi ağına bağla
            </Text>
          </View>
          <View style={styles.stepDivider} />
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>02</Text>
            <Text style={styles.stepText}>
              Aşağıya kendi WiFi bilgilerini gir ve kurulumu tamamla
            </Text>
          </View>
        </View>

        {/* ── Form ── */}
        <View style={styles.formSection}>

          {/* SSID */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>WiFi SSID</Text>
            <TextInput
              value={ssid}
              onChangeText={setSsid}
              placeholder="ağ adını gir"
              placeholderTextColor={Colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
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
              style={styles.input}
            />
          </View>

        </View>

        {/* ── Durum mesajı ── */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBar, { backgroundColor: statusColor + '22' }]}>
            <View style={[styles.statusBarAccent, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status}
            </Text>
          </View>
        </View>

        {/* ── Butonlar ── */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            onPress={setup}
            disabled={loading || !ssid}
            activeOpacity={0.75}
            style={[
              styles.primaryBtn,
              (loading || !ssid) && styles.primaryBtnDisabled,
            ]}
          >
            <Text style={[
              styles.primaryBtnText,
              (loading || !ssid) && styles.primaryBtnTextDisabled,
            ]}>
              {loading ? '[ BAĞLANIYOR... ]' : '[ KURULUMU TAMAMLA ]'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDone}
            activeOpacity={0.75}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>← GERİ</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>192.168.4.1</Text>
          <View style={styles.footerSep} />
          <Text style={styles.footerText}>ESP32 Access Point</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // ── Header ──
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Başlık ──
  titleRow: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  titleLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.cyan,
  },
  titleSub: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    letterSpacing: 0.5,
    color: Colors.text,
    fontWeight: '300',
  },

  // ── Adım kartı ──
  stepsCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepNum: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.cyan,
    marginTop: 2,
    minWidth: 20,
  },
  stepText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text2,
    flex: 1,
    lineHeight: 20,
  },
  stepHighlight: {
    fontFamily: Fonts.mono,
    color: Colors.cyan,
    fontSize: 12,
  },
  stepDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border3,
    marginVertical: Spacing.xs,
  },

  // ── Form ──
  formSection: {
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.text3,
  },
  input: {
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 1,
    color: Colors.text,
  },

  // ── Durum mesajı ──
  statusRow: {
    marginTop: -Spacing.sm,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  statusBarAccent: {
    width: 2,
    height: '100%',
    borderRadius: 1,
    minHeight: 16,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    flex: 1,
    lineHeight: 18,
  },

  // ── Butonlar ──
  buttonGroup: {
    gap: Spacing.md,
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanAlpha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  primaryBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    letterSpacing: 3,
    color: Colors.cyan,
  },
  primaryBtnTextDisabled: {
    color: Colors.text3,
  },
  secondaryBtn: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: Colors.text2,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.lg,
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