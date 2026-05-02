/**
 * screens/SetupScreen.tsx
 * ESP32'ye WiFi bilgilerini gönderen kurulum ekranı.
 *
 * KeyboardAvoidingView + ScrollView ile her iki input da
 * klavye açılınca görünür kalır, arkada kalmaz.
 * 
 * 
 */

import { useState } from 'react';
import {
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

type Props = {
  onDone: () => void;
};

export default function SetupScreen({ onDone }: Props) {
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
    phase === 'error'      ? Colors.red   :
    phase === 'done'       ? Colors.green :
    phase === 'connecting' ? Colors.cyan  :
    Colors.text2;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
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
                Colors.text3,
            }]} />
            <Text style={styles.headerMeta}>SETUP</Text>
          </View>
        </View>
        <View style={styles.headerDivider} />

        {/* ScrollView: klavye açılınca şifre inputu görünür kalır */}
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

          {/* Adım kartları */}
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

          {/* Form */}
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
              disabled={loading || !ssid}
              activeOpacity={0.75}
              style={[styles.primaryBtn, (loading || !ssid) && styles.primaryBtnDisabled]}
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

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer — KAV dışında, klavyeden etkilenmez */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>192.168.4.1</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>ESP32 Access Point</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  kavWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    gap: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },

  // ── Başlık ──────────────────────────────────────────────────────
  titleBlock: { gap: Spacing.xs },
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

  // ── Adım kartı ──────────────────────────────────────────────────
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

  // ── Form ─────────────────────────────────────────────────────────
  formSection: { gap: Spacing.lg },
  fieldGroup:  { gap: Spacing.sm },
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

  // ── Durum mesajı ─────────────────────────────────────────────────
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
    minHeight: 16,
    borderRadius: 1,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    flex: 1,
    lineHeight: 18,
  },

  // ── Butonlar ─────────────────────────────────────────────────────
  buttonGroup: { gap: Spacing.md },
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
  primaryBtnTextDisabled: { color: Colors.text3 },
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

  // ── Footer ──────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
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