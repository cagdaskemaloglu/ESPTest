/**
 * screens/ControlScreen.tsx
 * ESP32 WS2812B şerit LED kontrol ekranı.
 *
 * Bağlantı durumu:
 *   useConnectionStatus hook'u 5 saniyede bir /whoami ping atar.
 *   Header'da durum noktası: gri=kontrol ediliyor, yeşil=online, kırmızı=offline
 *   Offline iken toggle/slider/color değişikliklerinde hata banner'ı gösterilir.
 */

import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import ColorPicker from '../components/ColorPicker';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { saveBrightness, saveColor } from '../services/deviceStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  device:           Device;
  onOpenList:       () => void;
  onAddDevice:      () => void;
  onOpenAutomation: () => void;
};

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export default function ControlScreen({ device, onOpenList, onAddDevice, onOpenAutomation }: Props) {
  const [isOn, setIsOn]             = useState(false);
  const [brightness, setBrightness] = useState(Math.round((device.brightness ?? 255) / 255 * 100));
  const [color, setColor]           = useState({ r: device.color?.r ?? 255, g: device.color?.g ?? 255, b: device.color?.b ?? 255 });
  const [pickerOpen, setPickerOpen] = useState(false);
  // Hata banner mesajı — offline iken işlem yapılmaya çalışılınca gösterilir
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim        = useRef(new Animated.Value(0)).current;
  const pulse       = useRef(new Animated.Value(1)).current;
  const pulseRef    = useRef<Animated.CompositeAnimation | null>(null);

  // Bağlantı durumu hook'u — 5sn'de bir ping
  const { status: connStatus, latency } = useConnectionStatus(device.ip);

  // Hata mesajını 3 saniye sonra otomatik gizle
  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  useEffect(() => {
    setIsOn(false);
    setPickerOpen(false);
    setBrightness(Math.round((device.brightness ?? 255) / 255 * 100));
    setColor({ r: device.color?.r ?? 255, g: device.color?.g ?? 255, b: device.color?.b ?? 255 });
    anim.setValue(0);
    pulse.setValue(1);
    pulseRef.current?.stop();
    syncState();
  }, [device.id]);

  const syncState = async () => {
    try {
      const res  = await fetch(`http://${device.ip}/led/state`);
      const data = await res.json();
      if (data.on !== undefined)         setIsOn(data.on);
      if (data.r  !== undefined)         setColor({ r: data.r, g: data.g, b: data.b });
      if (data.brightness !== undefined) setBrightness(Math.round(data.brightness / 255 * 100));
    } catch {}
  };

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOn ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (isOn) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0.97, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    }
    return () => { pulseRef.current?.stop(); };
  }, [isOn]);

  const togglePicker = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setPickerOpen((p) => !p);
  };

  const toggle = async () => {
    if (connStatus === 'offline') { showError('Cihaza ulaşılamıyor'); return; }
    const path = isOn ? '/led/off' : '/led/on';
    try {
      await fetch(`http://${device.ip}${path}`);
      setIsOn(!isOn);
    } catch { showError('Bağlantı hatası'); }
  };

  const handleSliderChange = (value: number) => {
    const pct = Math.round(value);
    setBrightness(pct);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (connStatus === 'offline') return;
      try { await fetch(`http://${device.ip}/led/brightness?value=${Math.round(pct / 100 * 255)}`); }
      catch {}
    }, 300);
  };

  const handleSliderComplete = async (value: number) => {
    const pct = Math.round(value);
    const esp = Math.round(pct / 100 * 255);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (connStatus !== 'offline') {
      try { await fetch(`http://${device.ip}/led/brightness?value=${esp}`); }
      catch {}
    }
    await saveBrightness(device.id, esp);
  };

  const handleColorChange = async (r: number, g: number, b: number) => {
    setColor({ r, g, b });
    try { await fetch(`http://${device.ip}/led/color?r=${r}&g=${g}&b=${b}`); }
    catch {}
    await saveColor(device.id, { r, g, b });
  };

  // ── Bağlantı durum noktası rengi ──────────────────────────────────────────
  const connDotColor =
    connStatus === 'online'   ? Colors.green :
    connStatus === 'offline'  ? Colors.red   :
    Colors.text3; // checking

  // ── Interpolasyonlar ──────────────────────────────────────────────────────
  const colorCss      = `rgb(${color.r},${color.g},${color.b})`;
  const colorHex      = rgbToHex(color.r, color.g, color.b);
  const glowOpacity   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const bgColor       = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg, '#060a0f'] });
  const borderColor   = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.border2] });
  const progressWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const ringBg        = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg3, 'rgba(0,212,255,0.04)'] });
  const bulbBtnBg     = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg4, 'rgba(0,212,255,0.06)'] });
  const toggleBg      = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.bg3, 'rgba(0,212,255,0.08)'] });
  const shadowOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const shadowRadius  = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 36] });
  const labelOffOp    = anim.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const labelOnOp     = anim.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const sliderOp      = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>

      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({ length: 18 }).map((_, i) => <View key={i} style={styles.scanline} />)}
      </View>

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenList} style={styles.deviceNameBtn}>
          <Text style={styles.deviceNameLabel}>AKTİF CİHAZ</Text>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name} ›</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {/* Bağlantı durum noktası — online/offline/checking */}
          <View style={[styles.statusDot, { backgroundColor: connDotColor }]} />
          {/* Gecikme (ms) — sadece online iken göster */}
          {connStatus === 'online' && latency !== null && (
            <Text style={styles.latencyText}>{latency}ms</Text>
          )}
          {connStatus === 'offline' && (
            <Text style={styles.offlineText}>ÇEVRIMDIŞI</Text>
          )}
          <TouchableOpacity onPress={onOpenAutomation} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⏱</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAddDevice} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.ipRow}>
        <Text style={styles.ipLabel}>BAĞLANTI //</Text>
        <Text style={styles.ipValue}>{device.ip}</Text>
      </View>

      {/* ── Hata banner'ı ── */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠ {errorMsg}</Text>
        </View>
      )}

      {/* ── ScrollView ───────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Lamba ──────────────────────────────────────────────── */}
        <View style={styles.lampSection}>
          <Animated.View pointerEvents="none" style={[styles.glowPool, { opacity: glowOpacity, shadowColor: colorCss }]} />
          <Animated.View style={[styles.ringOuter, { borderColor, transform: [{ scale: pulse }] }]}>
            <Animated.View style={[styles.ringMiddle, { borderColor, backgroundColor: ringBg }]}>
              <TouchableOpacity onPress={toggle} activeOpacity={0.75}>
                <Animated.View style={[styles.bulbButton, { borderColor, backgroundColor: bulbBtnBg, shadowColor: colorCss, shadowOpacity, shadowRadius }]}>
                  <View style={styles.bulbIconWrapper}>
                    <Animated.View style={[styles.bulbGlass, { backgroundColor: isOn ? colorCss : Colors.bg3, borderColor: isOn ? colorCss : Colors.border2 }]}>
                      <Animated.View style={[styles.bulbCore, { opacity: glowOpacity }]} />
                    </Animated.View>
                    <Animated.View style={[styles.bulbBase, { backgroundColor: isOn ? colorCss : Colors.border }]} />
                    <Animated.View style={[styles.bulbNeck, { backgroundColor: isOn ? Colors.border2 : Colors.border }]} />
                  </View>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                    <Animated.View key={angle} pointerEvents="none" style={[styles.ray, { opacity: glowOpacity, backgroundColor: colorCss, shadowColor: colorCss, transform: [{ rotate: `${angle}deg` }, { translateY: -44 }] }]} />
                  ))}
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
          <View style={styles.stateRow}>
            <Animated.Text style={[styles.stateOff, { opacity: labelOffOp }]}>○  KAPALI</Animated.Text>
            <Animated.Text style={[styles.stateOn, { opacity: labelOnOp, color: colorCss }]}>●  AÇIK</Animated.Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: colorCss, shadowColor: colorCss }]} />
          </View>
        </View>

        {/* Toggle */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
          <Animated.View style={[styles.toggleBtn, { borderColor, backgroundColor: toggleBg }]}>
            <Animated.Text style={[styles.toggleTextOff, { opacity: labelOffOp }]}>[ YAK ]</Animated.Text>
            <Animated.Text style={[styles.toggleTextOn, { opacity: labelOnOp, color: colorCss }]}>[ SÖNDÜR ]</Animated.Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Brightness */}
        <Animated.View style={[styles.sliderSection, { opacity: sliderOp }]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>PARLAKLIK</Text>
            <Text style={[styles.sliderValue, isOn && { color: colorCss }]}>{brightness}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0} maximumValue={100} step={1}
            value={brightness}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor={isOn ? colorCss : Colors.border2}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={isOn ? colorCss : Colors.text2}
          />
          <View style={styles.sliderTicks}>
            <Text style={styles.sliderTick}>0</Text>
            <Text style={styles.sliderTick}>50</Text>
            <Text style={styles.sliderTick}>100</Text>
          </View>
        </Animated.View>

        {/* Renk accordion */}
        <View style={styles.colorAccordion}>
          <TouchableOpacity onPress={togglePicker} activeOpacity={0.8} style={styles.colorBtn}>
            <View style={styles.colorBtnLeft}>
              <Text style={styles.colorBtnLabel}>RENK</Text>
              {!isOn && <Text style={styles.colorBtnNote}>açılınca uygulanacak</Text>}
            </View>
            <View style={styles.colorBtnPreview}>
              <View style={[styles.colorDot, { backgroundColor: colorCss, shadowColor: colorCss }]} />
              <Text style={styles.colorHex}>{colorHex}</Text>
            </View>
            <Text style={[styles.colorChevron, pickerOpen && styles.colorChevronOpen]}>›</Text>
          </TouchableOpacity>

          {pickerOpen && (
            <View style={styles.colorPanel}>
              <View style={styles.colorPanelDivider} />
              <ColorPicker
                initialR={color.r} initialG={color.g} initialB={color.b}
                onChange={handleColorChange}
              />
            </View>
          )}
        </View>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56 },
  scanlines: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-around', opacity: 0.025 },
  scanline: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: Colors.cyan },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.lg, paddingHorizontal: Spacing.xl },
  deviceNameBtn: { gap: 2, flex: 1 },
  deviceNameLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  deviceName: { fontFamily: Fonts.sans, fontSize: 16, color: Colors.text, fontWeight: '400' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  latencyText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.green },
  offlineText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.red },
  headerBtn: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.cyan, lineHeight: 18 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md, marginHorizontal: Spacing.xl },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, paddingHorizontal: Spacing.xl },
  ipLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.text3 },
  ipValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1.5, color: Colors.cyan },

  // Hata banner
  errorBanner: { marginHorizontal: Spacing.xl, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.redAlpha, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm },
  errorBannerText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.xl, paddingTop: Spacing.lg },
  lampSection: { alignItems: 'center', gap: Spacing.lg },
  glowPool: { position: 'absolute', bottom: -10, alignSelf: 'center', width: 240, height: 60, borderRadius: 120, backgroundColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 40, elevation: 0 },
  ringOuter: { width: 200, height: 200, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ringMiddle: { width: 164, height: 164, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bulbButton: { width: 120, height: 120, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  bulbIconWrapper: { alignItems: 'center' },
  bulbGlass: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bulbCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffffff', shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  bulbBase: { marginTop: 3, width: 26, height: 7, borderRadius: 2 },
  bulbNeck: { marginTop: 2, width: 16, height: 4, borderRadius: 2 },
  ray: { position: 'absolute', width: 1, height: 16, borderRadius: 1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  stateRow: { height: 24, alignItems: 'center', justifyContent: 'center' },
  stateOff: { position: 'absolute', fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 4, color: Colors.text3 },
  stateOn:  { position: 'absolute', fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 4 },
  progressTrack: { width: 100, height: 1, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  toggleBtn: { width: '100%', height: 50, borderWidth: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  toggleTextOff: { position: 'absolute', fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 3, color: Colors.text2 },
  toggleTextOn:  { position: 'absolute', fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 3 },
  sliderSection: { gap: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  sliderValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  slider: { width: '100%', height: 28, marginVertical: 2 },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderTick: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  colorAccordion: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  colorBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  colorBtnLeft: { flex: 1, gap: 2 },
  colorBtnLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  colorBtnNote: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.amber },
  colorBtnPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 3 },
  colorHex: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  colorChevron: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.text2, lineHeight: 22 },
  colorChevronOpen: { transform: [{ rotate: '90deg' }] },
  colorPanel: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  colorPanelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.lg },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});