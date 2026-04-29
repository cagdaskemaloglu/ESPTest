/**
 * StartScreen.tsx
 * Uygulamanın ilk karşılama ekranı.
 * Kullanıcıya iki seçenek sunar:
 *   - Kurulum: ESP32'yi WiFi'a tanıtmak için SetupScreen'e geçiş
 *   - Cihaz Ara: Ağ taraması için ScanScreen'e geçiş
 */

import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

type Props = {
  onSetup: () => void; // "Kurulum Başlat" butonuna basılınca
  onScan:  () => void; // "Cihaz Ara" butonuna basılınca
};

export default function StartScreen({ onSetup, onScan }: Props) {
  return (
    <SafeAreaView style={styles.root}>

      {/* ── Header: marka adı + versiyon ── */}
      <View style={styles.header}>
        <Text style={styles.headerBrand}>TORVA · LAB</Text>
        <View style={styles.headerRight}>
          {/* Bu ekranda aktif işlem olmadığı için nokta her zaman gri */}
          <View style={styles.statusDot} />
          <Text style={styles.headerMeta}>v2.0</Text>
        </View>
      </View>
      <View style={styles.headerDivider} />

      {/* ── Ana gövde: başlık + butonlar ── */}
      <View style={styles.body}>

        {/* Başlık bloğu */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>// SMART LIGHT</Text>
          <Text style={styles.titleMain}>Akıllı{'\n'}Aydınlatma</Text>
          <Text style={styles.titleDesc}>
            ESP32 tabanlı IoT ışık kontrol sistemi
          </Text>
        </View>

        {/* Bölüm ayracı */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>BAŞLAT</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Buton grubu */}
        <View style={styles.buttonGroup}>

          {/* İkincil eylem: kurulum — daha az sıklıkla kullanılır */}
          <TouchableOpacity
            onPress={onSetup}
            activeOpacity={0.75}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnLabel}>KURULUM</Text>
            <Text style={styles.secondaryBtnText}>[ WiFi Yapılandır ]</Text>
          </TouchableOpacity>

          {/* Birincil eylem: cihaz ara — asıl kullanım akışı */}
          <TouchableOpacity
            onPress={onScan}
            activeOpacity={0.75}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnLabel}>KEŞİF</Text>
            <Text style={styles.primaryBtnText}>[ Cihaz Ara ]</Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* ── Footer: konum + sistem bilgisi ── */}
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

  // ── Header ──────────────────────────────────────────────────────
  header: {
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
    backgroundColor: Colors.text3,
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

  // ── Gövde ───────────────────────────────────────────────────────
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xl,
  },

  titleBlock: {
    gap: Spacing.sm,
  },
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

  // Ayraç
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: {
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

  // Butonlar
  buttonGroup: {
    gap: Spacing.md,
  },
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
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  secondaryBtnLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
  secondaryBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    letterSpacing: 2,
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