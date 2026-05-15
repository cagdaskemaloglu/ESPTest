/**
 * components/SplashAnimation.tsx
 * Animasyonlu splash — react-native-svg gerektirmez.
 * Saf React Native Animated + View ile yapılmıştır.
 *
 * Animasyon sırası:
 *   0.0s → Arka plan + glow halkaları
 *   0.3s → Ampul ikonu belirir (scale + opacity)
 *   0.9s → WiFi sinyalleri sırayla belirir
 *   0.6s → "TORVA" metni yükselir
 *   1.4s → Loading çubuğu
 *   3.0s → Fade out → onFinish()
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Fonts } from '../theme/colors';

const { width: W, height: H } = Dimensions.get('window');

type Props = { onFinish: () => void };

export default function SplashAnimation({ onFinish }: Props) {
  const iconScale     = useRef(new Animated.Value(0.5)).current;
  const iconOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textY         = useRef(new Animated.Value(20)).current;
  const loaderWidth   = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const ring1Opacity  = useRef(new Animated.Value(0)).current;
  const ring1Scale    = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity  = useRef(new Animated.Value(0)).current;
  const ring2Scale    = useRef(new Animated.Value(0.5)).current;
  const ring3Opacity  = useRef(new Animated.Value(0)).current;
  const ring3Scale    = useRef(new Animated.Value(0.5)).current;
  const wifiDot       = useRef(new Animated.Value(0)).current;
  const wifiArc1      = useRef(new Animated.Value(0)).current;
  const wifiArc2      = useRef(new Animated.Value(0)).current;
  const glowOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ringAnim = (
      opacity: Animated.Value,
      scale:   Animated.Value,
      delay:   number
    ) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.5, duration: 800,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1, duration: 1200,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]);

    Animated.parallel([
      // Glow halkalar
      ringAnim(ring1Opacity, ring1Scale, 0),
      ringAnim(ring2Opacity, ring2Scale, 200),
      ringAnim(ring3Opacity, ring3Scale, 400),

      // Arka plan glow
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(glowOpacity, {
          toValue: 1, duration: 800, useNativeDriver: true,
        }),
      ]),

      // İkon belirme
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 1, duration: 600, useNativeDriver: true,
          }),
        ]),
      ]),

      // WiFi elemanları sıralı
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(wifiDot,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(wifiArc1, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(wifiArc2, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),

      // Metin
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1, duration: 600, useNativeDriver: true,
          }),
          Animated.timing(textY, {
            toValue: 0, duration: 600,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]),

      // Loader
      Animated.sequence([
        Animated.delay(1300),
        Animated.timing(loaderOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Loader çubuğu ayrı — useNativeDriver: false
    setTimeout(() => {
      Animated.timing(loaderWidth, {
        toValue: 1, duration: 1500,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    }, 1300);

    // 3.2 saniye sonra fade out
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 400,
        easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => onFinish());
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  const loaderWidthPx = loaderWidth.interpolate({
    inputRange: [0, 1], outputRange: [0, 80],
  });

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>

      {/* Scanline doku */}
      <View style={styles.scanlines} pointerEvents="none" />

      {/* Arka plan glow — ikon rengiyle */}
      <Animated.View style={[styles.bgGlow, { opacity: glowOpacity }]} />

      <View style={styles.container}>

        {/* İkon alanı */}
        <View style={styles.iconWrap}>

          {/* Glow halkalar */}
          <Animated.View style={[styles.ring, styles.ring1, {
            opacity: ring1Opacity,
            transform: [{ scale: ring1Scale }],
          }]} />
          <Animated.View style={[styles.ring, styles.ring2, {
            opacity: ring2Opacity,
            transform: [{ scale: ring2Scale }],
          }]} />
          <Animated.View style={[styles.ring, styles.ring3, {
            opacity: ring3Opacity,
            transform: [{ scale: ring3Scale }],
          }]} />

          {/* İkon — View tabanlı ampul */}
          <Animated.View style={[styles.iconContainer, {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }]}>
            {/* Ampul gövdesi */}
            <View style={styles.bulbBody}>
              {/* İç glow */}
              <View style={styles.bulbGlow} />
              {/* WiFi sinyalleri */}
              <Animated.View style={[styles.wifiDot, { opacity: wifiDot }]} />
              <Animated.View style={[styles.wifiArc, styles.wifiArc1, { opacity: wifiArc1 }]} />
              <Animated.View style={[styles.wifiArc, styles.wifiArc2, { opacity: wifiArc2 }]} />
            </View>
            {/* Ampul tabanı */}
            <View style={styles.bulbBase} />
            <View style={styles.bulbNeck} />
          </Animated.View>
        </View>

        {/* Metin */}
        <Animated.View style={[styles.textWrap, {
          opacity: textOpacity,
          transform: [{ translateY: textY }],
        }]}>
          <Text style={styles.appName}>TORVA</Text>
          <Text style={styles.tagline}>SMART LIGHT CONTROL</Text>
        </Animated.View>

        {/* Loader */}
        <Animated.View style={[styles.loaderWrap, { opacity: loaderOpacity }]}>
          <View style={styles.loaderTrack}>
            <Animated.View style={[styles.loaderFill, { width: loaderWidthPx }]} />
          </View>
          <Text style={styles.loaderText}>BAŞLATILIYOR</Text>
        </Animated.View>

      </View>
    </Animated.View>
  );
}

const ICON_SIZE = 100;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    width: W,
    height: H,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.025,
    //backgroundImage: undefined, // RN'de bu çalışmaz, dekoratif
  },
  // Logo rengiyle (cyan) arka plan glow
  bgGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.cyan,
    opacity: 0.04,
    alignSelf: 'center',
    top: H / 2 - 200,
  },
  container: {
    alignItems: 'center',
    gap: 32,
  },

  // İkon alanı
  iconWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Glow halkalar
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.cyan,
    borderRadius: 999,
  },
  ring1: { width: 140, height: 140 },
  ring2: { width: 170, height: 170 },
  ring3: { width: 200, height: 200 },

  // Ampul ikonu
  iconContainer: {
    alignItems: 'center',
    position: 'absolute',
  },
  bulbBody: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 2.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bulbGlow: {
    position: 'absolute',
    width: ICON_SIZE * 0.6,
    height: ICON_SIZE * 0.6,
    borderRadius: ICON_SIZE * 0.3,
    backgroundColor: Colors.cyan,
    opacity: 0.1,
  },
  // WiFi dot
  wifiDot: {
    position: 'absolute',
    bottom: ICON_SIZE * 0.28,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cyan,
  },
  // WiFi yay
  wifiArc: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: Colors.cyan,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderRadius: 999,
  },
  wifiArc1: {
    bottom: ICON_SIZE * 0.32,
    width: 24,
    height: 24,
  },
  wifiArc2: {
    bottom: ICON_SIZE * 0.3,
    width: 40,
    height: 40,
  },
  bulbBase: {
    marginTop: 2,
    width: 36,
    height: 10,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  bulbNeck: {
    marginTop: 2,
    width: 22,
    height: 6,
    backgroundColor: 'white',
    borderRadius: 2,
  },

  // Metin
  textWrap: { alignItems: 'center', gap: 8 },
  appName: {
    fontFamily: Fonts.mono,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 12,
    color: '#e8e0d0',
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 4,
    color: Colors.text3,
  },

  // Loader
  loaderWrap: { alignItems: 'center', gap: 8 },
  loaderTrack: {
    width: 80,
    height: 1,
    backgroundColor: Colors.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    backgroundColor: Colors.cyan,
    borderRadius: 1,
  },
  loaderText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
});