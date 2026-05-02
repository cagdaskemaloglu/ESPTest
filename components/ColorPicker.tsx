/**
 * components/ColorPicker.tsx
 * Tema uyumlu HSB renk seçici — accordion versiyonu.
 *
 * Tasarım prensipleri:
 *   - Track gösterge View'ı Slider ile tam aynı yükseklikte, padding yok
 *   - Slider track transparent, thumb renkli — track görsel olarak arkada
 *   - Slider ve track View aynı container içinde, overlay ile hizalanmış
 */

import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

// ── HSB ↔ RGB dönüşüm ────────────────────────────────────────────────────────
function hsbToRgb(h: number, s: number, b: number) {
  const c = b * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = b - c;
  let r = 0, g = 0, bl = 0;
  if      (h < 60)  { r = c; g = x; bl = 0; }
  else if (h < 120) { r = x; g = c; bl = 0; }
  else if (h < 180) { r = 0; g = c; bl = x; }
  else if (h < 240) { r = 0; g = x; bl = c; }
  else if (h < 300) { r = x; g = 0; bl = c; }
  else              { r = c; g = 0; bl = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((bl + m) * 255),
  };
}

function rgbToHsb(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if      (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else                 h = (rn - gn) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, bv: max };
}

// ── Hızlı palette ────────────────────────────────────────────────────────────
const PALETTE = [
  { label: 'BEYAZ',   hex: '#ffffff', r: 255, g: 255, b: 255 },
  { label: 'SICAK',   hex: '#ffaa44', r: 255, g: 170, b: 68  },
  { label: 'KIRMIZI', hex: '#ff2244', r: 255, g: 34,  b: 68  },
  { label: 'YEŞİL',   hex: '#22ff88', r: 34,  g: 255, b: 136 },
  { label: 'MAVİ',    hex: '#0099ff', r: 0,   g: 153, b: 255 },
  { label: 'MOR',     hex: '#aa44ff', r: 170, g: 68,  b: 255 },
];

// ── Tek slider satırı bileşeni ────────────────────────────────────────────────
// Track görsel olarak Slider'ın tam arkasında, aynı yükseklikte
type TrackSliderProps = {
  label:        string;
  value:        number;
  min:          number;
  max:          number;
  step?:        number;
  displayVal:   string;
  thumbColor:   string;
  trackLeft:    string; // Track sol rengi
  trackRight:   string; // Track sağ rengi
  onValueChange: (v: number) => void;
};

function TrackSlider({
  label, value, min, max, step = 1,
  displayVal, thumbColor,
  trackLeft, trackRight,
  onValueChange,
}: TrackSliderProps) {
  return (
    <View style={ts.wrapper}>
      {/* Üst satır: etiket + değer */}
      <View style={ts.labelRow}>
        <Text style={ts.label}>{label}</Text>
        <Text style={ts.val}>{displayVal}</Text>
      </View>

      {/* Slider konteyner — track ve slider üst üste */}
      <View style={ts.trackContainer}>
        {/* Renk geçişli track — pointer events yok, sadece görsel */}
        <View style={ts.trackOuter} pointerEvents="none">
          <View style={[ts.trackHalf, { backgroundColor: trackLeft  }]} />
          <View style={[ts.trackHalf, { backgroundColor: trackRight }]} />
        </View>

        {/* Gerçek slider — track transparent, sadece thumb dokunabilir */}
        <Slider
          style={ts.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor={thumbColor}
        />
      </View>
    </View>
  );
}

// TrackSlider stilleri
const SLIDER_HEIGHT = 28; // Slider yüksekliği
const TRACK_HEIGHT  = 6;  // Track kalınlığı
const TRACK_VPAD    = (SLIDER_HEIGHT - TRACK_HEIGHT) / 2; // Dikey ortalama

const ts = StyleSheet.create({
  wrapper: { gap: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  val:   { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.text2 },
  trackContainer: {
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
  },
  trackOuter: {
    position: 'absolute',
    left: 10,   // iOS/Android slider thumb genişliğinin yarısı kadar içeri gir
    right: 10,
    top: TRACK_VPAD,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  trackHalf: { flex: 1 },
  slider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SLIDER_HEIGHT,
  },
});

// ── Ana bileşen ──────────────────────────────────────────────────────────────
type Props = {
  initialR?: number;
  initialG?: number;
  initialB?: number;
  onChange:  (r: number, g: number, b: number) => void;
  style?:    ViewStyle;
};

export default function ColorPicker({
  initialR = 255,
  initialG = 255,
  initialB = 255,
  onChange,
  style,
}: Props) {
  const init = rgbToHsb(initialR, initialG, initialB);

  const [hue, setHue] = useState(init.h);
  const [sat, setSat] = useState(Math.round(init.s  * 100));
  const [bri, setBri] = useState(Math.round(init.bv * 100));
  const [preview, setPreview] = useState({ r: initialR, g: initialG, b: initialB });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rgb = hsbToRgb(hue, sat / 100, bri / 100);
    setPreview(rgb);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(rgb.r, rgb.g, rgb.b), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [hue, sat, bri]);

  const applyPalette = (r: number, g: number, b: number) => {
    const hsb = rgbToHsb(r, g, b);
    setHue(hsb.h);
    setSat(Math.round(hsb.s  * 100));
    setBri(Math.round(hsb.bv * 100));
  };

  const previewCss  = `rgb(${preview.r},${preview.g},${preview.b})`;
  const fullSatRgb  = hsbToRgb(hue, 1, bri / 100);
  const fullSatCss  = `rgb(${fullSatRgb.r},${fullSatRgb.g},${fullSatRgb.b})`;
  const fullBriRgb  = hsbToRgb(hue, sat / 100, 1);
  const fullBriCss  = `rgb(${fullBriRgb.r},${fullBriRgb.g},${fullBriRgb.b})`;

  return (
    <View style={[styles.root, style]}>

      {/* ── Önizleme + RGB değerleri ── */}
      <View style={styles.previewRow}>
        <View style={[styles.previewBox, {
          backgroundColor: previewCss,
          shadowColor: previewCss,
        }]} />
        <View style={styles.previewInfo}>
          <Text style={styles.infoLabel}>RGB</Text>
          <Text style={styles.infoValue}>{preview.r} · {preview.g} · {preview.b}</Text>
          <Text style={styles.infoLabel}>TON</Text>
          <Text style={styles.infoValue}>{hue}°</Text>
        </View>
      </View>

      {/* ── Sliderlar ── */}
      <TrackSlider
        label="TON" displayVal={`${hue}°`}
        value={hue} min={0} max={360}
        thumbColor={previewCss}
        // Gökkuşağı: kırmızı → sarı → yeşil → cyan → mavi → magenta → kırmızı
        // İki yarıyla tam spektrum simüle edilemez; yerine nötr track kullanıyoruz
        // Thumb rengi anlık tonu gösteriyor — kullanıcıya yeterli geri bildirim
        trackLeft={Colors.border2}
        trackRight={Colors.border}
        onValueChange={(v) => setHue(Math.round(v))}
      />

      <TrackSlider
        label="DOYGUNLUK" displayVal={`${sat}%`}
        value={sat} min={0} max={100}
        thumbColor={previewCss}
        trackLeft="#ffffff"
        trackRight={fullSatCss}
        onValueChange={(v) => setSat(Math.round(v))}
      />

      <TrackSlider
        label="YOĞUNLUK" displayVal={`${bri}%`}
        value={bri} min={0} max={100}
        thumbColor={previewCss}
        trackLeft="#000000"
        trackRight={fullBriCss}
        onValueChange={(v) => setBri(Math.round(v))}
      />

      {/* ── Hızlı palette ── */}
      <View style={styles.palette}>
        {PALETTE.map((c) => {
          const isSelected = preview.r === c.r && preview.g === c.g && preview.b === c.b;
          return (
            <TouchableOpacity
              key={c.label}
              onPress={() => applyPalette(c.r, c.g, c.b)}
              activeOpacity={0.75}
              style={styles.paletteBtn}
            >
              <View style={[styles.paletteDot, {
                backgroundColor: c.hex,
                borderColor: isSelected ? Colors.cyan : Colors.border2,
                borderWidth: isSelected ? 2 : 1,
                transform: [{ scale: isSelected ? 1.15 : 1 }],
              }]} />
              <Text style={[styles.paletteLabel, isSelected && { color: Colors.cyan }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.lg },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  previewBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  previewInfo: { flex: 1, gap: 2 },
  infoLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  infoValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1.5, color: Colors.text, marginBottom: Spacing.xs },

  palette: { flexDirection: 'row', justifyContent: 'space-between' },
  paletteBtn: { alignItems: 'center', gap: Spacing.xs },
  paletteDot: { width: 30, height: 30, borderRadius: 15 },
  paletteLabel: { fontFamily: Fonts.mono, fontSize: 7, letterSpacing: 1, color: Colors.text3, textAlign: 'center', width: 44 },
});