/**
 * components/SplashAnimation.tsx
 * Uygulama açılışında gösterilen animasyonlu splash ekranı.
 *
 * Expo'nun built-in splash screen'i (app.json'daki static görsel)
 * hemen kapanır. Bu bileşen onun yerine animated splash gösterir.
 *
 * Kullanım — App.tsx'te:
 *   import * as ExpoSplash from 'expo-splash-screen';
 *   ExpoSplash.preventAutoHideAsync(); // index.js veya _layout.tsx'te
 *
 *   <SplashAnimation onFinish={() => ExpoSplash.hideAsync()} />
 *
 * Animasyon sırası:
 *   0.0s → Glow halkalar genişler
 *   0.3s → Ampul outline çizilir
 *   0.8s → Ampul tabanı belirir
 *   0.9s → WiFi dot
 *   1.0s → WiFi arc 1
 *   1.2s → WiFi arc 2
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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors, Fonts } from '../theme/colors';

const { width: W, height: H } = Dimensions.get('window');

type Props = { onFinish: () => void };

export default function SplashAnimation({ onFinish }: Props) {
  // Ana animasyon değerleri
  const iconScale    = useRef(new Animated.Value(0.5)).current;
  const iconOpacity  = useRef(new Animated.Value(0)).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const textY        = useRef(new Animated.Value(20)).current;
  const loaderWidth  = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Glow halkaları
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  // WiFi elemanları
  const wifiDot  = useRef(new Animated.Value(0)).current;
  const wifiArc1 = useRef(new Animated.Value(0)).current;
  const wifiArc2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow halkaları
    const ringAnim = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, {
          toValue: 1, duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    // Ana sekans
    Animated.parallel([
      // Halkalar
      ringAnim(ring1, 0),
      ringAnim(ring2, 200),
      ringAnim(ring3, 400),

      // İkon belirme
      Animated.sequence([
        Animated.delay(100),
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
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Loader
      Animated.sequence([
        Animated.delay(1300),
        Animated.timing(loaderOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.timing(loaderWidth, {
          toValue: 1, duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // width için false
        }),
      ]),
    ]).start();

    // 3 saniye sonra fade out
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const loaderWidthPx = loaderWidth.interpolate({
    inputRange: [0, 1], outputRange: [0, 80],
  });

  const ringScale = (val: Animated.Value, maxScale: number) =>
    val.interpolate({ inputRange: [0, 1], outputRange: [0.5, maxScale] });
  const ringOpacity = (val: Animated.Value) =>
    val.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.5, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>

      {/* Scanline doku */}
      <View style={styles.scanlines} pointerEvents="none" />

      <View style={styles.container}>

        {/* İkon alanı */}
        <View style={styles.iconWrap}>

          {/* Glow halkalar */}
          {[{ val: ring1, size: 140 }, { val: ring2, size: 170 }, { val: ring3, size: 200 }].map(
            ({ val, size }, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  { width: size, height: size, borderRadius: size / 2 },
                  {
                    opacity: ringOpacity(val),
                    transform: [{ scale: ringScale(val, 1) }],
                  },
                ]}
              />
            )
          )}

          {/* İkon */}
          <Animated.View style={[styles.svgWrap, {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }]}>
            <Svg width={80} height={80} viewBox="0 0 32 32">
              {/* Ampul */}
              <Path
                d="M16 4 C11 4, 8 8, 8 12 C8 15, 10 17, 11.5 19 C12.5 20.5, 13 21.5, 13 23 L19 23 C19 21.5, 19.5 20.5, 20.5 19 C22 17, 24 15, 24 12 C24 8, 21 4, 16 4 Z"
                fill="none" stroke="white" strokeWidth={2}
              />
              <Rect x={13} y={23} width={6} height={3} fill="white" />

              {/* WiFi — opacity animasyonlu */}
              <AnimatedCircle cx={16} cy={16} r={1.5} fill="#00d4ff" opacity={wifiDot} />
              <AnimatedPath
                d="M13.5 14.5 A4 4 0 0 1 18.5 14.5"
                fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeLinecap="round"
                opacity={wifiArc1}
              />
              <AnimatedPath
                d="M12 13 A6 6 0 0 1 20 13"
                fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeLinecap="round"
                opacity={wifiArc2}
              />
            </Svg>
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

// Animated SVG elemanları için wrapper
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath   = Animated.createAnimatedComponent(Path);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.025,
  },
  container: {
    alignItems: 'center',
    gap: 32,
  },

  // İkon
  iconWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.cyan,
  },
  svgWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Metin
  textWrap: { alignItems: 'center', gap: 8 },
  appName: {
    fontFamily: Fonts.mono,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 12,
    color: '#e8e0d0',
    textIndent: 12,
  } as any,
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
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  loaderText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
});
