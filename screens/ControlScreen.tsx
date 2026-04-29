/**
 * screens/ControlScreen.tsx
 * Seçili ESP32 cihazını kontrol eden ana ekran.
 *
 * Header'da:
 *   - Sol: cihaz adına basınca DeviceListScreen açılır
 *   - Sağ: "+" butonu ile ScanScreen'e gidip yeni cihaz eklenir
 *
 * Tüm animasyonlar useNativeDriver:false — layout prop karışıklığını önler.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = {
  device:       Device;          // Aktif cihaz
  onOpenList:   () => void;      // Cihaz adına basınca → DeviceListScreen
  onAddDevice:  () => void;      // "+" butonuna basınca → ScanScreen
};

export default function ControlScreen({ device, onOpenList, onAddDevice }: Props) {
  const [isOn, setIsOn] = useState(false);

  // Tek animasyon value — tümü useNativeDriver:false
  const anim     = useRef(new Animated.Value(0)).current;
  const pulse    = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Cihaz değişince ışığı kapat ve animasyonu sıfırla
  useEffect(() => {
    setIsOn(false);
    anim.setValue(0);
    pulse.setValue(1);
    pulseRef.current?.stop();
  }, [device.id]);

  useEffect(() => {
    // Işık geçiş animasyonu
    Animated.timing(anim, {
      toValue: isOn ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Işık açıkken nefes alma animasyonu
    if (isOn) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            toValue: 0.97,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulse, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }

    return () => { pulseRef.current?.stop(); };
  }, [isOn]);

  // ESP32'ye istek gönder
  const toggle = async () => {
    const path = isOn ? '/led/off' : '/led/on';
    try {
      await fetch(`http://${device.ip}${path}`);
      setIsOn(!isOn);
    } catch {
      console.log('Bağlantı hatası:', device.ip);
    }
  };

  // ── Interpolasyonlar ─────────────────────────────────────────────
  const glowOpacity   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const bgColor       = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg, '#060a0f'] });
  const borderColor   = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.cyan2] });
  const bulbBg        = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg3, Colors.cyan] });
  const bulbBorder    = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border2, Colors.cyan] });
  const progressWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const ringBg        = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg3, 'rgba(0,212,255,0.04)'] });
  const bulbBtnBg     = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg4, 'rgba(0,212,255,0.10)'] });
  const toggleBg      = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg3, 'rgba(0,212,255,0.08)'] });
  const dotColor      = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.text3, Colors.cyan] });
  const baseColor     = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.cyan2] });
  const neckColor     = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.border2] });
  const shadowOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const shadowRadius  = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });

  const labelOffOpacity = anim.interpolate({
    inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const labelOnOpacity = anim.interpolate({
    inputRange: [0.6, 1], outputRange: [0, 1], extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>

      {/* Dekoratif arka plan scanline'ları */}
      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>

        {/* Sol: cihaz adı — basınca cihaz listesi açılır */}
        <TouchableOpacity onPress={onOpenList} style={styles.deviceNameBtn}>
          <Text style={styles.deviceNameLabel}>AKTİF CİHAZ</Text>
          <Text style={styles.deviceName} numberOfLines={1}>
            {device.name} ›
          </Text>
        </TouchableOpacity>

        {/* Sağ: durum noktası + yeni cihaz ekle */}
        <View style={styles.headerRight}>
          <Animated.View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          {/* "+" butonu — ScanScreen'e gider */}
          <TouchableOpacity onPress={onAddDevice} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

      </View>

      <View style={styles.headerDivider} />

      {/* IP satırı */}
      <View style={styles.ipRow}>
        <Text style={styles.ipLabel}>BAĞLANTI //</Text>
        <Text style={styles.ipValue}>{device.ip}</Text>
      </View>

      {/* ── Lamba alanı ──────────────────────────────────────── */}
      <View style={styles.lampSection}>

        {/* Zemine yansıyan glow */}
        <Animated.View style={[styles.glowPool, { opacity: glowOpacity }]} pointerEvents="none" />

        {/* Dış halka — pulse scale */}
        <Animated.View style={[styles.ringOuter, {
          borderColor,
          transform: [{ scale: pulse }],
        }]}>

          {/* Orta halka */}
          <Animated.View style={[styles.ringMiddle, {
            borderColor,
            backgroundColor: ringBg,
          }]}>

            {/* Ampul dokunmatik butonu */}
            <TouchableOpacity onPress={toggle} activeOpacity={0.75}>
              <Animated.View style={[styles.bulbButton, {
                borderColor,
                backgroundColor: bulbBtnBg,
                shadowOpacity,
                shadowRadius,
              }]}>

                {/* Ampul ikonu */}
                <View style={styles.bulbIconWrapper}>
                  <Animated.View style={[styles.bulbGlass, {
                    backgroundColor: bulbBg,
                    borderColor: bulbBorder,
                  }]}>
                    <Animated.View style={[styles.bulbCore, { opacity: glowOpacity }]} />
                  </Animated.View>
                  <Animated.View style={[styles.bulbBase, { backgroundColor: baseColor }]} />
                  <Animated.View style={[styles.bulbNeck, { backgroundColor: neckColor }]} />
                </View>

                {/* Işık ışınları — açıkken görünür */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <Animated.View
                    key={angle}
                    pointerEvents="none"
                    style={[styles.ray, {
                      opacity: glowOpacity,
                      transform: [{ rotate: `${angle}deg` }, { translateY: -44 }],
                    }]}
                  />
                ))}

              </Animated.View>
            </TouchableOpacity>

          </Animated.View>
        </Animated.View>

        {/* Durum metni */}
        <View style={styles.stateRow}>
          <Animated.Text style={[styles.stateOff, { opacity: labelOffOpacity }]}>
            ○  KAPALI
          </Animated.Text>
          <Animated.Text style={[styles.stateOn, { opacity: labelOnOpacity }]}>
            ●  AÇIK
          </Animated.Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

      </View>

      {/* ── Toggle butonu ─────────────────────────────────────── */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.toggleWrapper}>
        <Animated.View style={[styles.toggleBtn, {
          borderColor,
          backgroundColor: toggleBg,
        }]}>
          <Animated.Text style={[styles.toggleTextOff, { opacity: labelOffOpacity }]}>
            [ YAK ]
          </Animated.Text>
          <Animated.Text style={[styles.toggleTextOn, { opacity: labelOnOpacity }]}>
            [ SÖNDÜR ]
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>

      {/* ── Footer ───────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: Spacing.xl,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-around',
    opacity: 0.025,
  },
  scanline: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.cyan,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
  },
  deviceNameBtn: {
    gap: 2,
    flex: 1,
  },
  deviceNameLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
  deviceName: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.cyan,
    lineHeight: 20,
  },
  headerDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },
  ipRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  ipLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.text3,
  },
  ipValue: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.cyan,
  },

  // ── Lamba ───────────────────────────────────────────────────────
  lampSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    width: '100%',
  },
  glowPool: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 220,
    height: 50,
    borderRadius: 110,
    backgroundColor: 'transparent',
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 0,
  },
  ringOuter: {
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMiddle: {
    width: 180,
    height: 180,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulbButton: {
    width: 130,
    height: 130,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  bulbIconWrapper: { alignItems: 'center' },
  bulbGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulbCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e0f8ff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  bulbBase: {
    marginTop: 3,
    width: 26,
    height: 7,
    borderRadius: 2,
  },
  bulbNeck: {
    marginTop: 2,
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  ray: {
    position: 'absolute',
    width: 1,
    height: 16,
    backgroundColor: Colors.cyan,
    borderRadius: 1,
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  stateRow: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateOff: {
    position: 'absolute',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.text3,
  },
  stateOn: {
    position: 'absolute',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 2,
  },
  progressTrack: {
    width: 100,
    height: 1,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Toggle butonu ────────────────────────────────────────────────
  toggleWrapper: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  toggleBtn: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggleTextOff: {
    position: 'absolute',
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 3,
    color: Colors.text2,
  },
  toggleTextOn: {
    position: 'absolute',
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 3,
    color: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Footer ──────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.md,
    width: '100%',
    justifyContent: 'center',
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