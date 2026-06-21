/**
 * screens/StartScreen.tsx
 * Başlangıç ekranı.
 *
 * Değişiklik:
 *   "Cihaz Ara" butonu sadece WiFi yapılandırması tamamlandıktan sonra aktif.
 *   Yani önce "Kurulum Başlat" ile ESP32'ye WiFi bilgileri girilmeli.
 *   Yapılandırma tamamlanmamışsa "Cihaz Ara" butonu devre dışı + açıklama gösterilir.
 *
 *   Yapılandırma kontrolü: AsyncStorage'da 'torva_setup_done' anahtarı var mı?
 *   SetupScreen tamamlanınca bu anahtar kaydedilir.
 *
 * ScanScreen geçişinde:
 *   Kullanıcıya "ESP32 ağından kendi WiFi ağına geç" talimatı gösterilir.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  AppState,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

export const SETUP_DONE_KEY = 'torva_setup_done';

type Props = {
  onSetup: () => void;
  onScan:  () => void;
  onBack?: () => void;
};

export default function StartScreen({ onSetup, onScan, onBack }: Props) {
  const { t } = useLanguage();
  const [setupDone, setSetupDone] = useState(false);
  const [loading, setLoading]     = useState(true);

  const checkSetupDone = async () => {
    const val = await AsyncStorage.getItem(SETUP_DONE_KEY);
    setSetupDone(val === 'true');
    setLoading(false);
  };

  useEffect(() => {
    // İlk yüklemede oku
    checkSetupDone();

    // Uygulama ön plana her geldiğinde yeniden kontrol et
    // (DeviceListScreen'den döndükten sonra güncel değeri yakalar)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkSetupDone();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.root}>

      {/* Scanline doku */}
      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerBrand}>TORVA · LAB</Text>
        <Text style={styles.headerMeta}>v2.0</Text>
      </View>
      <View style={styles.headerDivider} />

      <View style={styles.content}>

        {/* Başlık */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>{t('start.eyebrow')}</Text>
          <Text style={styles.titleMain}>{t('start.titleMain')}</Text>
          <Text style={styles.titleDesc}>
            {t('start.titleDesc')}
          </Text>
        </View>

        {/* Butonlar */}
        <View style={styles.buttons}>

          {/* ── Kurulum Başlat ── */}
          <TouchableOpacity
            onPress={onSetup}
            activeOpacity={0.8}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnLabel}>{t('start.primaryLabel')}</Text>
            <Text style={styles.primaryBtnText}>{t('start.primaryButton')}</Text>
            <Text style={styles.primaryBtnDesc}>
              {t('start.primaryDesc')}
            </Text>
          </TouchableOpacity>

          {/* ── Cihaz Ara ── */}
          <TouchableOpacity
            onPress={setupDone ? onScan : undefined}
            activeOpacity={setupDone ? 0.8 : 1}
            style={[styles.secondaryBtn, !setupDone && styles.secondaryBtnDisabled]}
          >
            <View style={styles.secondaryBtnTop}>
              <View>
                <Text style={styles.secondaryBtnLabel}>{t('start.secondaryLabel')}</Text>
                <Text style={[
                  styles.secondaryBtnText,
                  !setupDone && { color: Colors.text3 },
                ]}>
                  {t('start.secondaryButton')}
                </Text>
              </View>
              {!setupDone && (
                <View style={styles.lockBadge}>
                  <Text style={styles.lockBadgeText}>🔒</Text>
                </View>
              )}
            </View>
            {!setupDone ? (
              <Text style={styles.secondaryBtnDisabledDesc}>
                {t('start.secondaryDisabledDesc')}{' '}
                <Text style={{ color: Colors.cyan }}>{t('start.secondaryDisabledHighlight')}</Text>
              </Text>
            ) : (
              <Text style={styles.secondaryBtnDesc}>
                {t('start.secondaryDesc')}
              </Text>
            )}
          </TouchableOpacity>

        </View>

        {/* Bilgi notu */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{t('start.infoTitle')}</Text>
          <View style={styles.infoStep}>
            <Text style={styles.infoNum}>01</Text>
            <Text style={styles.infoText}>
              {t('start.infoStep1')}
            </Text>
          </View>
          <View style={styles.infoStep}>
            <Text style={styles.infoNum}>02</Text>
            <Text style={styles.infoText}>
              {t('start.infoStep2')}
            </Text>
          </View>
          <View style={styles.infoStep}>
            <Text style={styles.infoNum}>03</Text>
            <Text style={styles.infoText}>
              {t('start.infoStep3')}
            </Text>
          </View>
        </View>

      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>{t('start.footerBrand')}</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scanlines: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-around', opacity: 0.025 },
  scanline: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: Colors.cyan },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg + 16,
  },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  headerMeta:  { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text2 },

  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'center',
  },

  // Başlık
  titleBlock: { gap: Spacing.sm },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: {
    fontFamily: Fonts.sans,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1,
    color: Colors.text,
    fontWeight: '300',
  },
  titleDesc: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.text2, lineHeight: 22, marginTop: Spacing.xs },

  // Butonlar
  buttons: { gap: Spacing.md },

  primaryBtn: {
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.md,
    backgroundColor: Colors.cyanAlpha,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  primaryBtnLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.cyan2 },
  primaryBtnText: { fontFamily: Fonts.mono, fontSize: 18, letterSpacing: 2, color: Colors.cyan },
  primaryBtnDesc: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text3, lineHeight: 18, marginTop: 2 },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  secondaryBtnDisabled: {
    opacity: 0.6,
    borderColor: Colors.border3,
  },
  secondaryBtnTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  secondaryBtnLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  secondaryBtnText: { fontFamily: Fonts.mono, fontSize: 18, letterSpacing: 2, color: Colors.text2 },
  secondaryBtnDesc: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text3, lineHeight: 18, marginTop: 2 },
  secondaryBtnDisabledDesc: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text3, lineHeight: 18, marginTop: 2 },
  lockBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  lockBadgeText: { fontSize: 14 },

  // Bilgi notu
  infoBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  infoStep: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  infoNum: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan, minWidth: 20, marginTop: 2 },
  infoText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, flex: 1, lineHeight: 20 },
  infoHighlight: { fontFamily: Fonts.mono, color: Colors.cyan, fontSize: 12 },

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
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});