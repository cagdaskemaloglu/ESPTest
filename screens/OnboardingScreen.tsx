/**
 * screens/OnboardingScreen.tsx
 * İlk kullanım rehberi — sadece kayıtlı cihaz yokken gösterilir.
 *
 * 4 slayt:
 *   1. Karşılama
 *   2. ESP32 hazırlığı
 *   3. İlk kurulum adımları
 *   4. Hazır — başlayalım
 *
 * Geçiş: yatay swipe veya "İleri" butonu
 * Son slayt: "Başlayalım" → onDone() çağrılır → StartScreen
 */

import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = { onDone: () => void };

type Slide = {
  id:       string;
  eyebrow:  string;
  title:    string;
  desc:     string;
  icon:     string;
  steps?:   { num: string; text: string; highlight?: string }[];
  note?:    string;
};

const SLIDES: Slide[] = [
  {
    id:      'welcome',
    eyebrow: '// HOŞ GELDİN',
    title:   'Akıllı Işık\nKontrolü',
    icon:    '💡',
    desc:
      'Torva Smart Light ile ESP32 tabanlı LED şeritlerini ve ' +
      'ampullerini telefonundan yönet. Renk, parlaklık, zamanlayıcı ' +
      've efektler tek uygulamada.',
  },
  {
    id:      'hardware',
    eyebrow: '// DONANIM',
    title:   'ESP32\'ni\nHazırla',
    icon:    '🔌',
    desc:    'Başlamadan önce ESP32 cihazının hazır olduğundan emin ol.',
    steps: [
      {
        num:  '01',
        text: 'ESP32\'yi güç kaynağına bağla',
      },
      {
        num:       '02',
        text:      'Eğer daha önce WiFi kurulmadıysa ',
        highlight: 'ESP32-Setup',
      },
      {
        num:  '03',
        text: 'adlı WiFi ağı görünür — bu normal, kurulum adımında bu ağa bağlanacaksın',
      },
    ],
    note: 'Daha önce kurulum yaptıysan ESP32 doğrudan ev WiFi\'ına bağlanır.',
  },
  {
    id:      'setup',
    eyebrow: '// KURULUM',
    title:   'İki Yol\nVar',
    icon:    '🗺️',
    desc:    'Cihazına göre doğru yolu seç:',
    steps: [
      {
        num:       '→',
        text:      'İlk kez kuruyorsan: ',
        highlight: 'Kurulum Başlat',
      },
      {
        num:  '',
        text: 'ESP32\'yi ev WiFi\'ına tanıtmak için gerekli. Bir kez yapılır.',
      },
      {
        num:       '→',
        text:      'Daha önce kurulduysa: ',
        highlight: 'Cihaz Ara',
      },
      {
        num:  '',
        text: 'Uygulama ağı otomatik tarar ve cihazı bulur.',
      },
    ],
    note: 'Emin değilsen "Cihaz Ara" ile başla — cihaz bulunamazsa kuruluma geç.',
  },
  {
    id:      'ready',
    eyebrow: '// HAZIR',
    title:   'Her Şey\nHazır!',
    icon:    '🚀',
    desc:    'Artık ışıklarını kontrol etmeye başlayabilirsin.',
    steps: [
      { num: '🎨', text: 'Renk ve parlaklık kontrolü' },
      { num: '⏱',  text: 'Zamanlayıcı ve otomasyon kuralları' },
      { num: '✨', text: 'Efekt ve sahne presetleri' },
      { num: '📱', text: 'Birden fazla cihaz yönetimi' },
    ],
  },
];

export default function OnboardingScreen({ onDone }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim   = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const goToSlide = (index: number) => {
    if (index < 0 || index >= SLIDES.length) return;

    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });

    // Nokta animasyonu
    Animated.parallel([
      Animated.spring(dotAnim[currentIndex], { toValue: 0, useNativeDriver: false }),
      Animated.spring(dotAnim[index],        { toValue: 1, useNativeDriver: false }),
    ]).start();

    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      onDone();
    }
  };

  const handleScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== currentIndex) {
      Animated.parallel([
        Animated.spring(dotAnim[currentIndex], { toValue: 0, useNativeDriver: false }),
        Animated.spring(dotAnim[index],        { toValue: 1, useNativeDriver: false }),
      ]).start();
      setCurrentIndex(index);
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>

      {/* Atla butonu — son slayt hariç */}
      <View style={styles.topBar}>
        {!isLast ? (
          <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
            <Text style={styles.skipText}>ATLA</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipBtn} />
        )}
        <Text style={styles.topBrand}>TORVA · LAB</Text>
        <View style={styles.skipBtn} />
      </View>

      {/* Slayt scroll alanı */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.slideScroll}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>

            {/* İkon */}
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>{slide.icon}</Text>
              {/* İkon arkasında glow efekti */}
              <View style={styles.iconGlow} />
            </View>

            {/* Başlık */}
            <View style={styles.titleBlock}>
              <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
              <Text style={styles.title}>{slide.title}</Text>
            </View>

            {/* Açıklama */}
            <Text style={styles.desc}>{slide.desc}</Text>

            {/* Adımlar (varsa) */}
            {slide.steps && (
              <View style={styles.steps}>
                {slide.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    {step.num !== '' && (
                      <Text style={styles.stepNum}>{step.num}</Text>
                    )}
                    <Text style={[styles.stepText, step.num === '' && styles.stepTextIndent]}>
                      {step.text}
                      {step.highlight && (
                        <Text style={styles.stepHighlight}>{step.highlight}</Text>
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Not (varsa) */}
            {slide.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>💡 {slide.note}</Text>
              </View>
            )}

          </View>
        ))}
      </ScrollView>

      {/* Alt bar: nokta göstergesi + buton */}
      <View style={styles.bottomBar}>

        {/* Nokta göstergesi */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const width = dotAnim[i].interpolate({
              inputRange:  [0, 1],
              outputRange: [6, 24],
            });
            const opacity = dotAnim[i].interpolate({
              inputRange:  [0, 1],
              outputRange: [0.3, 1],
            });
            return (
              <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
                <Animated.View style={[styles.dot, { width, opacity }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* İleri / Başlayalım butonu */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={[styles.nextBtn, isLast && styles.nextBtnLast]}
        >
          <Text style={[styles.nextBtnText, isLast && styles.nextBtnTextLast]}>
            {isLast ? '[ BAŞLAYALIM ]' : '[ İLERİ ]'}
          </Text>
        </TouchableOpacity>

        {/* Geri butonu */}
        {currentIndex > 0 && (
          <TouchableOpacity
            onPress={() => goToSlide(currentIndex - 1)}
            activeOpacity={0.75}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Geri</Text>
          </TouchableOpacity>
        )}

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Üst bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  topBrand: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.text2,
  },
  skipBtn: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  skipText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text3,
  },

  // Slayt
  slideScroll: { flex: 1 },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'center',
  },

  // İkon
  iconWrapper: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  icon: {
    fontSize: 72,
    textAlign: 'center',
    zIndex: 1,
  },
  iconGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.cyan,
    opacity: 0.06,
  },

  // Başlık
  titleBlock: { gap: Spacing.xs },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.cyan,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: Colors.text,
    fontWeight: '300',
  },

  // Açıklama
  desc: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text2,
    lineHeight: 24,
  },

  // Adımlar
  steps: {
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    padding: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepNum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.cyan,
    minWidth: 24,
    marginTop: 2,
  },
  stepText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.text2,
    flex: 1,
    lineHeight: 22,
  },
  stepTextIndent: {
    marginLeft: 24 + Spacing.md,
    flex: undefined,
    color: Colors.text3,
    fontSize: 13,
  },
  stepHighlight: {
    fontFamily: Fonts.mono,
    color: Colors.cyan,
    fontSize: 13,
  },

  // Not kutusu
  noteBox: {
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg4,
    padding: Spacing.md,
  },
  noteText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text3,
    lineHeight: 20,
  },

  // Alt bar
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },

  // Nokta göstergesi
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cyan,
  },

  // Butonlar
  nextBtn: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnLast: {
    borderColor: Colors.cyan2,
    backgroundColor: Colors.cyanAlpha,
  },
  nextBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 3,
    color: Colors.text2,
  },
  nextBtnTextLast: {
    color: Colors.cyan,
  },
  backBtn: {
    paddingVertical: Spacing.sm,
  },
  backBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.text3,
  },
});
