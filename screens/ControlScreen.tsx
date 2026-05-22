/**
 * screens/ControlScreen.tsx
 * ESP32 kontrol ekranı.
 *
 * Accordion bölümleri:
 *   - Parlaklık slider (brightness)
 *   - Renk picker (color)
 *   - Sahneler/Presetler (effects)
 *   - Otomasyon (her cihaz tipi)
 *
 * Her bölüm capabilities'e göre gösterilir.
 */

import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import ColorPicker from '../components/ColorPicker';
import PinScreen from '../components/PinScreen';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { createAPI } from '../services/apiService';
import {
  AutomationRule,
  addCountdownRule,
  addDailyRule,
  deleteRule,
  getESP32Time,
  listRules,
  ruleDescription,
  toggleRule,
} from '../services/automationService';
import { saveBrightness, saveColor, savePin } from '../services/deviceStorage';
import { requestNotificationPermission } from '../services/notificationService';
import {
  DEFAULT_IDS,
  EFFECT_META,
  EffectType,
  Preset,
  applyPreset,
  deletePreset,
  getPresets
} from '../services/presetStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device, hasCapability } from '../types/Device';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  device:        Device;
  onOpenList:    () => void;
  onAddDevice:   () => void;
};

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function speedLabel(speed: number): string {
  if (speed < 80)  return 'Çok Yavaş';
  if (speed < 130) return 'Yavaş';
  if (speed < 180) return 'Normal';
  if (speed < 220) return 'Hızlı';
  return 'Çok Hızlı';
}

type LocalRule = AutomationRule & { notificationId?: string };

// ── NumberPicker ──────────────────────────────────────────────────────────────
function NumberPicker({ label, value, min, max, onChange, onFocus }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; onFocus?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const startRepeat = (delta: number) => {
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => onChange(clamp(value + delta)), 100);
    }, 400);
  };
  const stopRepeat = () => {
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleDisplayPress = () => {
    setInputVal(String(value));
    setEditing(true);
    onFocus?.();
  };

  const handleInputChange = (text: string) => {
    // Sadece rakam
    setInputVal(text.replace(/\D/g, ''));
  };

  const handleInputSubmit = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  return (
    <View style={np.wrapper}>
      <Text style={np.label}>{label}</Text>
      <View style={np.row}>
        <TouchableOpacity
          onPress={() => onChange(clamp(value - 1))}
          onLongPress={() => startRepeat(-1)}
          onPressOut={stopRepeat}
          activeOpacity={0.7}
          style={np.btn}
        >
          <Text style={np.btnText}>−</Text>
        </TouchableOpacity>

        {/* Sayıya basınca TextInput açılır */}
        <TouchableOpacity onPress={handleDisplayPress} activeOpacity={0.8} style={np.display}>
          {editing ? (
            <TextInput
              value={inputVal}
              onChangeText={handleInputChange}
              onBlur={handleInputSubmit}
              onSubmitEditing={handleInputSubmit}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus
              selectTextOnFocus
              style={np.displayInput}
            />
          ) : (
            <Text style={np.displayText}>{String(value).padStart(2, '0')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onChange(clamp(value + 1))}
          onLongPress={() => startRepeat(1)}
          onPressOut={stopRepeat}
          activeOpacity={0.7}
          style={np.btn}
        >
          <Text style={np.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const np = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.sm },
  label:   { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: { width: 40, height: 40, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: Fonts.mono, fontSize: 20, color: Colors.cyan, lineHeight: 24 },
  display: { width: 64, height: 48, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  displayText: { fontFamily: Fonts.mono, fontSize: 24, color: Colors.cyan, letterSpacing: 2 },
  displayInput: { fontFamily: Fonts.mono, fontSize: 24, color: Colors.cyan, letterSpacing: 2, textAlign: 'center', width: '100%', padding: 0 },
});

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function ControlScreen({ device, onOpenList, onAddDevice }: Props) {
  const [isOn, setIsOn]             = useState(false);
  const [brightness, setBrightness] = useState(Math.round((device.brightness ?? 255) / 255 * 100));
  const [color, setColor]           = useState({ r: device.color?.r ?? 255, g: device.color?.g ?? 255, b: device.color?.b ?? 255 });
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  // Accordion açık/kapalı state'leri
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [presetsOpen, setPresetsOpen]     = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);

  // PIN ekranı
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [pinScreenMode, setPinScreenMode] = useState<'enter' | 'setup'>('enter');
  const [pinError, setPinError]           = useState<string | null>(null);
  const [pinLoading, setPinLoading]       = useState(false);
  const [currentPin, setCurrentPin]       = useState(device.pin ?? '');

  // Hata banner
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasBrightness = hasCapability(device, 'brightness');
  const hasColor      = hasCapability(device, 'color');
  const hasEffects    = hasCapability(device, 'effects');

  // ── Presets state ──────────────────────────────────────────────────────────
  const [presets, setPresets]       = useState<Preset[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [expandedEffectId, setExpandedEffectId] = useState<string | null>(null);
  const [editSpeed, setEditSpeed]   = useState(128);
  const [editR, setEditR]           = useState(0);
  const [editG, setEditG]           = useState(150);
  const [editB, setEditB]           = useState(255);

  // ── Automation state ───────────────────────────────────────────────────────
  const [rules, setRules]           = useState<LocalRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [esp32Time, setEsp32Time]   = useState<string | null>(null);
  const [formMode, setFormMode]     = useState<'none' | 'daily' | 'countdown'>('none');
  const [savingRule, setSavingRule] = useState(false);
  const [dailyHour,   setDailyHour]   = useState(22);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [dailyAction, setDailyAction] = useState<0 | 1>(0);
  const [cdHour,   setCdHour]         = useState(0);
  const [cdMinute, setCdMinute]       = useState(30);
  const [cdAction, setCdAction]       = useState<0 | 1>(0);

  const scrollRef      = useRef<ScrollView>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeight = useRef(0);
  const scrollY        = useRef(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardHeight.current = e.endCoordinates.height;
        // Klavye açılınca mevcut scroll pozisyonuna klavye yüksekliğini ekle
        scrollRef.current?.scrollTo({
          y: scrollY.current + keyboardHeight.current,
          animated: true,
        });
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { keyboardHeight.current = 0; }
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };
  const errorTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim        = useRef(new Animated.Value(0)).current;
  const pulse       = useRef(new Animated.Value(1)).current;
  const pulseRef    = useRef<Animated.CompositeAnimation | null>(null);
  const prevStatus  = useRef<string>('checking');
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const api = createAPI(device.ip, currentPin, () => {
    setPinError(null); setPinScreenMode('enter'); setShowPinScreen(true);
  });

  const { status: connStatus, latency } = useConnectionStatus(device.ip);

  useEffect(() => {
    if (prevStatus.current !== 'online' && connStatus === 'online') syncState();
    prevStatus.current = connStatus;
  }, [connStatus]);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  useEffect(() => {
    setIsOn(false); setPickerOpen(false); setPresetsOpen(false); setAutomationOpen(false);
    setActiveEffect(null); setCurrentPin(device.pin ?? '');
    setBrightness(Math.round((device.brightness ?? 255) / 255 * 100));
    setColor({ r: device.color?.r ?? 255, g: device.color?.g ?? 255, b: device.color?.b ?? 255 });
    anim.setValue(0); pulse.setValue(1); pulseRef.current?.stop();
    syncState();
    loadPresets();
    requestNotificationPermission();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [device.id]);

  const syncState = async () => {
    const res = await api.get('/led/state');
    if (!res.ok) return;
    const data = res.data;
    if (data.on         !== undefined) setIsOn(data.on);
    if (data.r          !== undefined) setColor({ r: data.r, g: data.g, b: data.b });
    if (data.brightness !== undefined) setBrightness(Math.round(data.brightness / 255 * 100));
    if (data.effect     !== undefined) setActiveEffect(data.effect === 'off' ? null : data.effect);
  };

  // ── Presets ────────────────────────────────────────────────────────────────
  const loadPresets = useCallback(async () => {
    setPresets(await getPresets());
  }, []);

  const handleApplyPreset = async (preset: Preset, overrides?: Partial<Preset>) => {
    const merged = { ...preset, ...overrides };
    setApplyingId(preset.id);
    try {
      await applyPreset(device.ip, merged);
      setActivePresetId(preset.id);
      if (merged.type === 'effect') setActiveEffect(merged.effect ?? null);
      else { setActiveEffect(null); setIsOn(true); }
    } catch { showError('Preset uygulanamadı'); }
    setApplyingId(null);
  };

  const handleDeletePreset = (preset: Preset) => {
    if (DEFAULT_IDS.has(preset.id)) return;
    Alert.alert('Preseti Sil', `"${preset.name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await deletePreset(preset.id); await loadPresets();
        if (activePresetId === preset.id) setActivePresetId(null);
      }},
    ]);
  };

  // ── Automation ─────────────────────────────────────────────────────────────
  const loadAutomation = useCallback(async () => {
    setRulesLoading(true);
    const [ruleList, time] = await Promise.all([listRules(device.ip), getESP32Time(device.ip)]);
    setRules(ruleList.map((r) => ({ ...r, notificationId: undefined })));
    if (time) setEsp32Time(`${String(time.hour).padStart(2,'0')}:${String(time.minute).padStart(2,'0')}`);
    setRulesLoading(false);
  }, [device.ip]);

  useEffect(() => {
    if (automationOpen) {
      loadAutomation();
      timerRef.current = setInterval(() => setRules((p) => [...p]), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [automationOpen]);

  const handleAddDaily = async () => {
    setSavingRule(true);
    const result = await addDailyRule(device.ip, { hour: dailyHour, minute: dailyMinute, action: dailyAction, deviceName: device.name });
    setSavingRule(false);
    if (result) {
      setRules((prev) => [...prev, { id: result.id, active: true, type: 0, hour: dailyHour, minute: dailyMinute, action: dailyAction, triggerAt: 0, triggered: false, notificationId: result.notificationId }]);
      setFormMode('none');
    } else { showError('Kural eklenemedi'); }
  };

  const handleAddCountdown = async () => {
    const total = cdHour * 3600 + cdMinute * 60;
    if (total === 0) { showError('En az 1 dakika gir'); return; }
    setSavingRule(true);
    const result = await addCountdownRule(device.ip, { countdown: total, action: cdAction, deviceName: device.name });
    setSavingRule(false);
    if (result) {
      const triggerAt = Math.floor(Date.now() / 1000) + total;
      setRules((prev) => [...prev, { id: result.id, active: true, type: 1, hour: 0, minute: 0, action: cdAction, triggerAt, triggered: false, notificationId: result.notificationId }]);
      setFormMode('none');
    } else { showError('Kural eklenemedi'); }
  };

  const handleDeleteRule = (rule: LocalRule) => {
    Alert.alert('Kuralı Sil', `"${ruleDescription(rule)}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await deleteRule(device.ip, rule.id, rule.notificationId);
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
      }},
    ]);
  };

  const handleToggleRule = async (rule: LocalRule) => {
    const result = await toggleRule(device.ip, rule.id);
    if (result !== null) setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: result.active } : r));
  };

  // ── LED kontrol ────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(anim, { toValue: isOn ? 1 : 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (isOn) {
      pulseRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.97, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]));
      pulseRef.current.start();
    } else { pulseRef.current?.stop(); Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: false }).start(); }
    return () => { pulseRef.current?.stop(); };
  }, [isOn]);

  const toggleAccordion = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setter((p) => !p);
  };

  const toggle = async () => {
    if (connStatus === 'offline') { showError('Cihaza ulaşılamıyor'); return; }
    const res = await api.get(isOn ? '/led/off' : '/led/on');
    if (res.ok) { setIsOn(!isOn); if (isOn) setActiveEffect(null); }
    else if (res.error?.type !== 'unauthorized') showError('Bağlantı hatası');
  };

  const handleSliderChange = (value: number) => {
    const pct = Math.round(value); setBrightness(pct);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (connStatus === 'offline') return;
      await api.get('/led/brightness', { value: String(Math.round(pct / 100 * 255)) });
    }, 300);
  };

  const handleSliderComplete = async (value: number) => {
    const pct = Math.round(value); const esp = Math.round(pct / 100 * 255);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await api.get('/led/brightness', { value: String(esp) });
    await saveBrightness(device.id, esp);
  };

  const handleColorChange = async (r: number, g: number, b: number) => {
    setColor({ r, g, b });
    await api.get('/led/color', { r: String(r), g: String(g), b: String(b) });
    await saveColor(device.id, { r, g, b });
  };

  // PIN
  const handlePinSubmit = async (enteredPin: string) => {
    setPinLoading(true); setPinError(null);
    const testApi = createAPI(device.ip, enteredPin);
    const res = await testApi.get('/led/state');
    if (res.ok) {
      setCurrentPin(enteredPin); await savePin(device.id, enteredPin);
      setShowPinScreen(false); setPinError(null);
    } else if (res.error?.type === 'unauthorized') { setPinError('PIN hatalı.'); }
    else { setPinError('Bağlantı hatası.'); }
    setPinLoading(false);
  };

  // ── Interpolasyonlar ───────────────────────────────────────────────────────
  const colorCss      = hasColor ? `rgb(${color.r},${color.g},${color.b})` : Colors.cyan;
  const colorHex      = hasColor ? rgbToHex(color.r, color.g, color.b) : null;
  const glowOpacity   = anim.interpolate({ inputRange: [0,1], outputRange: [0,1] });
  const bgColor       = anim.interpolate({ inputRange: [0,1], outputRange: [Colors.bg,'#060a0f'] });
  const borderColor   = anim.interpolate({ inputRange: [0,1], outputRange: [Colors.border,Colors.border2] });
  const progressWidth = anim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] });
  const ringBg        = anim.interpolate({ inputRange: [0,1], outputRange: [Colors.bg3,'rgba(0,212,255,0.04)'] });
  const bulbBtnBg     = anim.interpolate({ inputRange: [0,1], outputRange: [Colors.bg4,'rgba(0,212,255,0.06)'] });
  const toggleBg      = anim.interpolate({ inputRange: [0,1], outputRange: [Colors.bg3,'rgba(0,212,255,0.08)'] });
  const shadowOpacity = anim.interpolate({ inputRange: [0,1], outputRange: [0,0.8] });
  const shadowRadius  = anim.interpolate({ inputRange: [0,1], outputRange: [0,36] });
  const labelOffOp    = anim.interpolate({ inputRange: [0,0.4], outputRange: [1,0], extrapolate: 'clamp' });
  const labelOnOp     = anim.interpolate({ inputRange: [0.6,1], outputRange: [0,1], extrapolate: 'clamp' });
  const sliderOp      = anim.interpolate({ inputRange: [0,1], outputRange: [0.4,1] });

  const connDotColor = connStatus==='online' ? Colors.green : connStatus==='offline' ? Colors.red : Colors.text3;

  const staticPresets = presets.filter((p) => p.type === 'static');
  const effectPresets = presets.filter((p) => p.type === 'effect');

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>
      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({ length: 18 }).map((_, i) => <View key={i} style={styles.scanline} />)}
      </View>

      {/* PIN Ekranı */}
      {showPinScreen && (
        <PinScreen deviceName={device.name} mode={pinScreenMode} onSubmit={handlePinSubmit}
          onCancel={() => { setShowPinScreen(false); setPinError(null); if (!currentPin) onOpenList(); }}
          error={pinError} isLoading={pinLoading} />
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenList} style={styles.deviceNameBtn}>
          <Text style={styles.deviceNameLabel}>AKTİF CİHAZ</Text>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name} ›</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={[styles.connDot, { backgroundColor: connDotColor }]} />
          {connStatus==='online' && latency!==null && <Text style={styles.latencyText}>{latency}ms</Text>}
          {connStatus==='offline' && <Text style={styles.offlineText}>OFFLINE</Text>}
          {activeEffect && <View style={styles.effectBadge}><Text style={styles.effectBadgeText}>FX</Text></View>}
          {currentPin !== '' && <Text style={styles.pinIcon}>🔒</Text>}
          <TouchableOpacity onPress={onAddDevice} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerDivider} />
      <View style={styles.ipRow}>
        <Text style={styles.ipLabel}>BAĞLANTI //</Text>
        <Text style={styles.ipValue}>{device.ip}</Text>
        <Text style={styles.ipLabel}> · </Text>
        <Text style={[styles.ipValue, { color: device.type==='ws2812b' ? Colors.purple : device.type==='single_led' ? Colors.amber : Colors.text3 }]}>
          {device.type==='ws2812b' ? 'RGB ŞERİT' : device.type==='single_led' ? 'TEK LED' : device.type==='relay' ? 'RÖLE' : '?'}
        </Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠ {errorMsg}</Text></View>
      )}

      {/* ── ScrollView ── */}
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>

        {/* Lamba */}
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
                  {hasColor && [0,45,90,135,180,225,270,315].map((angle) => (
                    <Animated.View key={angle} pointerEvents="none" style={[styles.ray, { opacity: glowOpacity, backgroundColor: colorCss, shadowColor: colorCss, transform: [{ rotate: `${angle}deg` }, { translateY: -44 }] }]} />
                  ))}
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
          <View style={styles.stateRow}>
            <Animated.Text style={[styles.stateOff, { opacity: labelOffOp }]}>○  KAPALI</Animated.Text>
            <Animated.Text style={[styles.stateOn,  { opacity: labelOnOp, color: colorCss }]}>
              {activeEffect ? `● ${activeEffect.toUpperCase()}` : '●  AÇIK'}
            </Animated.Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: activeEffect ? Colors.purple : colorCss, shadowColor: colorCss }]} />
          </View>
        </View>

        {/* Toggle */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
          <Animated.View style={[styles.toggleBtn, { borderColor, backgroundColor: toggleBg }]}>
            <Animated.Text style={[styles.toggleTextOff, { opacity: labelOffOp }]}>[ YAK ]</Animated.Text>
            <Animated.Text style={[styles.toggleTextOn,  { opacity: labelOnOp, color: colorCss }]}>[ SÖNDÜR ]</Animated.Text>
          </Animated.View>
        </TouchableOpacity>

        {/* ── Parlaklık ── */}
        {hasBrightness && (
          <Animated.View style={[styles.sliderSection, { opacity: sliderOp }]}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>PARLAKLIK</Text>
              <Text style={[styles.sliderValue, isOn && { color: colorCss }]}>{brightness}%</Text>
            </View>
            <Slider style={styles.slider} minimumValue={0} maximumValue={100} step={1} value={brightness}
              onValueChange={handleSliderChange} onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor={isOn ? colorCss : Colors.border2}
              maximumTrackTintColor={Colors.border} thumbTintColor={isOn ? colorCss : Colors.text2} />
            <View style={styles.sliderTicks}>
              <Text style={styles.sliderTick}>0</Text>
              <Text style={styles.sliderTick}>50</Text>
              <Text style={styles.sliderTick}>100</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Renk Accordion ── */}
        {hasColor && (
          <View style={styles.accordion}>
            <TouchableOpacity onPress={() => toggleAccordion(setPickerOpen)} activeOpacity={0.8} style={styles.accordionHeader}>
              <View style={styles.accordionHeaderLeft}>
                <Text style={styles.accordionLabel}>RENK</Text>
                {!isOn && <Text style={styles.accordionNote}>açılınca uygulanacak</Text>}
              </View>
              <View style={styles.colorPreview}>
                <View style={[styles.colorDot, { backgroundColor: colorCss, shadowColor: colorCss }]} />
                <Text style={styles.colorHex}>{colorHex}</Text>
              </View>
              <Text style={[styles.chevron, pickerOpen && styles.chevronOpen]}>›</Text>
            </TouchableOpacity>
            {pickerOpen && (
              <View style={styles.accordionPanel}>
                <View style={styles.accordionDivider} />
                <ColorPicker initialR={color.r} initialG={color.g} initialB={color.b} onChange={handleColorChange} />
              </View>
            )}
          </View>
        )}

        {/* ── Sahneler Accordion ── */}
        {hasEffects && (
          <View style={styles.accordion}>
            <TouchableOpacity onPress={() => { toggleAccordion(setPresetsOpen); if (!presetsOpen) loadPresets(); }} activeOpacity={0.8} style={styles.accordionHeader}>
              <View style={styles.accordionHeaderLeft}>
                <Text style={styles.accordionLabel}>SAHNELER</Text>
                {activePresetId && <Text style={styles.accordionNote}>aktif preset var</Text>}
              </View>
              {activeEffect && <View style={styles.fxBadge}><Text style={styles.fxBadgeText}>FX</Text></View>}
              <Text style={[styles.chevron, presetsOpen && styles.chevronOpen]}>›</Text>
            </TouchableOpacity>

            {presetsOpen && (
              <View style={styles.accordionPanel}>
                <View style={styles.accordionDivider} />

                {/* Statik presetler */}
                <Text style={styles.presetSectionLabel}>STATİK</Text>
                <View style={styles.presetGrid}>
                  {staticPresets.map((preset) => {
                    const isActive   = activePresetId === preset.id;
                    const isApplying = applyingId === preset.id;
                    const rgb = `rgb(${preset.r},${preset.g},${preset.b})`;
                    return (
                      <TouchableOpacity key={preset.id} onPress={() => handleApplyPreset(preset)}
                        onLongPress={() => handleDeletePreset(preset)} activeOpacity={0.75}
                        style={[styles.presetCard, isActive && styles.presetCardActive, isApplying && { opacity: 0.6 }]}>
                        <Text style={styles.presetIcon}>{preset.icon}</Text>
                        <Text style={[styles.presetName, isActive && { color: Colors.cyan }]}>{preset.name}</Text>
                        <View style={[styles.presetSwatch, { backgroundColor: rgb, shadowColor: rgb, shadowOpacity: isActive ? 0.8 : 0.3 }]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Efekt presetleri */}
                <Text style={[styles.presetSectionLabel, { marginTop: Spacing.md }]}>EFEKTLER</Text>
                <View style={styles.effectList}>
                  {effectPresets.map((preset) => {
                    const isActive   = activePresetId === preset.id;
                    const isExpanded = expandedEffectId === preset.id;
                    const meta = EFFECT_META[preset.effect as EffectType];
                    return (
                      <View key={preset.id} style={[styles.effectCard, isActive && styles.presetCardActive]}>
                        <TouchableOpacity onPress={() => handleApplyPreset(preset)} activeOpacity={0.75} style={styles.effectCardRow}>
                          <Text style={styles.presetIcon}>{preset.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetName, isActive && { color: Colors.cyan }]}>{preset.name}</Text>
                            <Text style={styles.effectDesc}>{meta?.desc ?? preset.effect}</Text>
                          </View>
                          <Text style={styles.effectSpeed}>{speedLabel(preset.effectSpeed ?? 128)}</Text>
                          <TouchableOpacity onPress={() => {
                            setExpandedEffectId(isExpanded ? null : preset.id);
                            setEditSpeed(preset.effectSpeed ?? 128);
                            setEditR(preset.effectR ?? 0); setEditG(preset.effectG ?? 150); setEditB(preset.effectB ?? 255);
                          }} style={styles.expandBtn}>
                            <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.effectPanel}>
                            <View style={styles.accordionDivider} />
                            <View style={styles.panelRow}><Text style={styles.panelLabel}>HIZ</Text><Text style={[styles.panelVal, { color: Colors.cyan }]}>{speedLabel(editSpeed)}</Text></View>
                            <Slider style={styles.panelSlider} minimumValue={0} maximumValue={255} step={1} value={editSpeed}
                              onValueChange={(v) => setEditSpeed(Math.round(v))}
                              minimumTrackTintColor={Colors.cyan} maximumTrackTintColor={Colors.border} thumbTintColor={Colors.cyan} />
                            {meta?.hasColor && (
                              <>
                                <View style={styles.panelRow}>
                                  <Text style={styles.panelLabel}>RENK</Text>
                                  <View style={[styles.panelColorDot, { backgroundColor: `rgb(${editR},${editG},${editB})` }]} />
                                </View>
                                {[['R', editR, setEditR, `rgb(${editR},0,0)`], ['G', editG, setEditG, `rgb(0,${editG},0)`], ['B', editB, setEditB, `rgb(0,0,${editB})`]].map(([label, val, setter, color]) => (
                                  <View key={label as string} style={styles.rgbRow}>
                                    <Text style={styles.rgbLabel}>{label as string}</Text>
                                    <Slider style={styles.rgbSlider} minimumValue={0} maximumValue={255} step={1} value={val as number}
                                      onValueChange={(v) => (setter as any)(Math.round(v))}
                                      minimumTrackTintColor={color as string} maximumTrackTintColor={Colors.border} thumbTintColor={color as string} />
                                    <Text style={styles.rgbVal}>{val as number}</Text>
                                  </View>
                                ))}
                              </>
                            )}
                            <TouchableOpacity onPress={() => handleApplyPreset(preset, { effectSpeed: editSpeed, effectR: editR, effectG: editG, effectB: editB })}
                              activeOpacity={0.75} style={styles.applyBtn}>
                              <Text style={styles.applyBtnText}>[ UYGULA ]</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Otomasyon Accordion ── */}
        <View style={styles.accordion}>
          <TouchableOpacity onPress={() => toggleAccordion(setAutomationOpen)} activeOpacity={0.8} style={styles.accordionHeader}>
            <View style={styles.accordionHeaderLeft}>
              <Text style={styles.accordionLabel}>OTOMASYON</Text>
              {rules.length > 0 && <Text style={styles.accordionNote}>{rules.length} kural aktif</Text>}
            </View>
            {esp32Time && <Text style={styles.esp32Time}>{esp32Time}</Text>}
            <Text style={[styles.chevron, automationOpen && styles.chevronOpen]}>›</Text>
          </TouchableOpacity>

          {automationOpen && (
            <View style={styles.accordionPanel}>
              <View style={styles.accordionDivider} />

              {/* Kural listesi — tamamlanan tek seferlik kurallar gösterilmez */}
              {rulesLoading ? (
                <Text style={styles.automationEmpty}>Yükleniyor...</Text>
              ) : rules.filter(r => !(r.type === 1 && !r.active)).length === 0 && formMode === 'none' ? (
                <Text style={styles.automationEmpty}>Henüz kural yok.</Text>
              ) : (
                rules
                  .filter(r => !(r.type === 1 && !r.active)) // Tamamlanan tek seferlik kuralları gizle
                  .map((rule) => (
                  <View key={rule.id} style={styles.ruleRow}>
                    <View style={[styles.ruleDot, { backgroundColor: rule.active ? Colors.cyan : Colors.text3 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ruleDesc, !rule.active && { color: Colors.text3 }]}>{ruleDescription(rule)}</Text>
                      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2 }}>
                        <View style={styles.ruleTag}><Text style={styles.ruleTagText}>{rule.type===0?'GÜNLİK':'TEK'}</Text></View>
                        <View style={[styles.ruleTag, { backgroundColor: rule.action===1 ? Colors.cyanAlpha : Colors.redAlpha }]}>
                          <Text style={[styles.ruleTagText, { color: rule.action===1 ? Colors.cyan : Colors.red }]}>{rule.action===1?'AÇ':'KAPAT'}</Text>
                        </View>
                        {rule.notificationId && <Text style={{ fontSize: 10 }}>🔔</Text>}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleToggleRule(rule)} style={styles.ruleBtn}>
                      <Text style={[styles.ruleBtnText, { color: rule.active ? Colors.cyan : Colors.text3 }]}>{rule.active?'AKT':'PAS'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRule(rule)} style={styles.ruleBtn}>
                      <Text style={[styles.ruleBtnText, { color: Colors.red }]}>SİL</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Kural ekleme butonları */}
              {formMode === 'none' && (
                <View style={styles.addRuleRow}>
                  <TouchableOpacity onPress={() => setFormMode('daily')} activeOpacity={0.75} style={styles.addRuleBtn}>
                    <Text style={styles.addRuleBtnText}>+ Günlük</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFormMode('countdown')} activeOpacity={0.75} style={styles.addRuleBtn}>
                    <Text style={styles.addRuleBtnText}>+ Geri Sayım</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          )}

        {/* ── Otomasyon form Modal ── */}
        <Modal
          visible={formMode !== 'none'}
          transparent
          animationType="slide"
          onRequestClose={() => setFormMode('none')}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity style={styles.modalBackdrop} onPress={() => setFormMode('none')} activeOpacity={1} />

            <View style={styles.modalCard}>
              <Text style={styles.ruleFormTitle}>
                {formMode === 'daily' ? '// GÜNLİK ZAMANLAYICI' : '// GERİ SAYIM'}
              </Text>

              <View style={styles.timePickerRow}>
                <NumberPicker
                  label="SAAT"
                  value={formMode === 'daily' ? dailyHour : cdHour}
                  min={0} max={23}
                  onChange={formMode === 'daily' ? setDailyHour : setCdHour}
                />
                <Text style={styles.timeSep}>:</Text>
                <NumberPicker
                  label="DAKİKA"
                  value={formMode === 'daily' ? dailyMinute : cdMinute}
                  min={0} max={59}
                  onChange={formMode === 'daily' ? setDailyMinute : setCdMinute}
                />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => formMode === 'daily' ? setDailyAction(1) : setCdAction(1)}
                  activeOpacity={0.75}
                  style={[styles.actionChoice,
                    (formMode === 'daily' ? dailyAction : cdAction) === 1 && styles.actionChoiceOn]}
                >
                  <Text style={[styles.actionChoiceText,
                    (formMode === 'daily' ? dailyAction : cdAction) === 1 && { color: Colors.cyan }]}>AÇ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => formMode === 'daily' ? setDailyAction(0) : setCdAction(0)}
                  activeOpacity={0.75}
                  style={[styles.actionChoice,
                    (formMode === 'daily' ? dailyAction : cdAction) === 0 && styles.actionChoiceOff]}
                >
                  <Text style={[styles.actionChoiceText,
                    (formMode === 'daily' ? dailyAction : cdAction) === 0 && { color: Colors.red }]}>KAPAT</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.ruleFormButtons}>
                <TouchableOpacity
                  onPress={formMode === 'daily' ? handleAddDaily : handleAddCountdown}
                  disabled={savingRule || (formMode === 'countdown' && cdHour === 0 && cdMinute === 0)}
                  activeOpacity={0.75}
                  style={[styles.saveRuleBtn,
                    (savingRule || (formMode === 'countdown' && cdHour === 0 && cdMinute === 0)) && { opacity: 0.5 }]}
                >
                  <Text style={styles.saveRuleBtnText}>
                    {savingRule ? 'KAYDEDİLİYOR...' : '[ KAYDET ]'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFormMode('none')} style={styles.cancelRuleBtn}>
                  <Text style={styles.cancelRuleBtnText}>İPTAL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        </View>

        {/* SingleLED notu */}
        {!hasColor && !hasEffects && (
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteTitle}>TEK KANAL LED</Text>
            <Text style={styles.infoNoteText}>Renk ve efekt kontrolü bu cihaz tipi için desteklenmiyor.</Text>
          </View>
        )}

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
  connDot: { width: 6, height: 6, borderRadius: 999 },
  latencyText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.green },
  offlineText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.red },
  effectBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.purple, backgroundColor: Colors.purpleAlpha },
  effectBadgeText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.purple },
  pinIcon: { fontSize: 12 },
  headerBtn: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.cyan, lineHeight: 18 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md, marginHorizontal: Spacing.xl },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, paddingHorizontal: Spacing.xl, flexWrap: 'wrap' },
  ipLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.text3 },
  ipValue: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.cyan },
  errorBanner: { marginHorizontal: Spacing.xl, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.redAlpha, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm },
  errorBannerText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md, paddingTop: Spacing.lg },
  // Lamba
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
  // Slider
  sliderSection: { gap: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  sliderValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  slider: { width: '100%', height: 28, marginVertical: 2 },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderTick: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  // Accordion ortak
  accordion: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  accordionHeaderLeft: { flex: 1, gap: 2 },
  accordionLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  accordionNote: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.amber },
  chevron: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.text2, lineHeight: 22 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  accordionPanel: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  accordionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.lg },
  // Renk
  colorPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 3 },
  colorHex: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  // Sahneler
  fxBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.purple, backgroundColor: Colors.purpleAlpha },
  fxBadgeText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.purple },
  presetSectionLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3, marginBottom: Spacing.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg4, padding: Spacing.sm },
  presetCardActive: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  presetIcon: { fontSize: 18 },
  presetName: { flex: 1, fontFamily: Fonts.sans, fontSize: 12, color: Colors.text },
  presetSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  // Efektler
  effectList: { gap: Spacing.sm },
  effectCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg4, overflow: 'hidden' },
  effectCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  effectDesc: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3, marginTop: 2 },
  effectSpeed: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  expandBtn: { padding: 4 },
  effectPanel: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  panelLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  panelVal: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2 },
  panelSlider: { width: '100%', height: 28, marginBottom: Spacing.sm },
  panelColorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2 },
  rgbRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  rgbLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3, width: 16 },
  rgbSlider: { flex: 1, height: 28 },
  rgbVal: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text2, width: 28, textAlign: 'right' },
  applyBtn: { height: 40, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  applyBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },
  // Otomasyon
  esp32Time: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  automationEmpty: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text3, textAlign: 'center', paddingVertical: Spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border3 },
  ruleDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  ruleDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text, lineHeight: 18 },
  ruleTag: { paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: Radius.sm, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  ruleTagText: { fontFamily: Fonts.mono, fontSize: 7, letterSpacing: 2, color: Colors.text3 },
  ruleBtn: { paddingVertical: 2, paddingHorizontal: 2 },
  ruleBtnText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2 },
  addRuleRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  addRuleBtn: { flex: 1, height: 38, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  addRuleBtnText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  ruleForm: { marginTop: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg2, padding: Spacing.md },
  ruleFormTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.cyan },
  timePickerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.md },
  timeSep: { fontFamily: Fonts.mono, fontSize: 28, color: Colors.text2, marginBottom: 4, lineHeight: 48 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionChoice: { flex: 1, height: 40, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  actionChoiceOn:  { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  actionChoiceOff: { borderColor: Colors.red,   backgroundColor: Colors.redAlpha },
  actionChoiceText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  ruleFormButtons: { flexDirection: 'row', gap: Spacing.sm },
  saveRuleBtn: { flex: 1, height: 42, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  saveRuleBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },
  cancelRuleBtn: { height: 42, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  cancelRuleBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.text2 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: {
    backgroundColor: Colors.bg2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderTopLeftRadius: Radius.md * 2,
    borderTopRightRadius: Radius.md * 2,
    padding: Spacing.xl,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
  },
  infoNote: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.lg, gap: Spacing.sm },
  infoNoteTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.amber },
  infoNoteText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});