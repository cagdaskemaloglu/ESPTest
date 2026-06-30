/**
 * screens/ControlScreen.tsx
 */

import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
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
    View
} from 'react-native';
import ColorPicker from '../components/ColorPicker';
import Model3DViewer from '../components/Model3DViewer';
import PinScreen from '../components/PinScreen';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { createAPI } from '../services/apiService';
import {
    AutomationRule,
    FadeState,
    addCountdownRule, addDailyRule,
    cancelFade,
    deleteRule, getESP32Time,
    getFadeState,
    listRules, ruleDescription,
    startFade,
    toggleRule,
} from '../services/automationService';
import { saveBrightness, saveColor, saveDeviceMeta, savePin, updateDeviceIp } from '../services/deviceStorage';
import { requestNotificationPermission } from '../services/notificationService';
import {
    DEFAULT_IDS,
    EffectType,
    Preset,
    deletePreset,
    getEffectMeta, getPresetDisplayName,
    getPresets
} from '../services/presetStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Channel, Device, channelHasCapability } from '../types/Device';

const SLIDE_BTN_W = 36;
const SLIDE_GAP   = Spacing.sm;
const SCREEN_W    = Dimensions.get('window').width;
const CARD_W      = SCREEN_W - Spacing.xl * 2 - (SLIDE_BTN_W + SLIDE_GAP) * 2;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  device:         Device;
  devices:        Device[];
  onOpenList:     () => void;
  onAddDevice:    () => void;
  onDeviceChange: (device: Device) => void;
  onOpenGroups:   () => void;
  onOpenStats:    () => void;
  syncKey:        number; // her artışta syncAllChannels tetiklenir
};

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function speedLabel(speed: number, t: (key: TranslationKey) => string): string {
  if (speed < 80)  return t('control.speedVerySlow');
  if (speed < 130) return t('control.speedSlow');
  if (speed < 180) return 'Normal';
  if (speed < 220) return t('control.speedFast');
  return t('control.speedVeryFast');
}

type LocalRule = AutomationRule & { notificationId?: string; triggered?: boolean };

type ChannelState = {
  isOn:        boolean;
  brightness:  number;
  color:       { r: number; g: number; b: number };
  activeEffect: string | null;
};

// ── NumberPicker ──────────────────────────────────────────────────────────────
function NumberPicker({ label, value, min, max, onChange, onFocus }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onFocus?: () => void;
}) {
  const [editing, setEditing]   = useState(false);
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
  return (
    <View style={np.wrapper}>
      <Text style={np.label}>{label}</Text>
      <View style={np.row}>
        <TouchableOpacity onPress={() => onChange(clamp(value-1))} onLongPress={() => startRepeat(-1)} onPressOut={stopRepeat} activeOpacity={0.7} style={np.btn}>
          <Text style={np.btnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setInputVal(String(value)); setEditing(true); onFocus?.(); }} activeOpacity={0.8} style={np.display}>
          {editing ? (
            <TextInput
              value={inputVal}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '');
                setInputVal(clean);
                const p = parseInt(clean, 10);
                if (!isNaN(p)) onChange(clamp(p));
              }}
              onBlur={() => { const p = parseInt(inputVal, 10); if (!isNaN(p)) onChange(clamp(p)); setEditing(false); }}
              onSubmitEditing={() => { const p = parseInt(inputVal, 10); if (!isNaN(p)) onChange(clamp(p)); setEditing(false); }}
              keyboardType="number-pad" maxLength={2} autoFocus selectTextOnFocus style={np.displayInput}
            />
          ) : (
            <Text style={np.displayText}>{String(value).padStart(2,'0')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChange(clamp(value+1))} onLongPress={() => startRepeat(1)} onPressOut={stopRepeat} activeOpacity={0.7} style={np.btn}>
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

// ── ChannelControl ────────────────────────────────────────────────────────────
function ChannelControl({
  channel, device, api, state, onStateChange, presets, onPresetsReload, pin, connStatus,
}: {
  channel:         Channel;
  device:          Device;
  api:             ReturnType<typeof createAPI>;
  state:           ChannelState;
  onStateChange:   (s: Partial<ChannelState>) => void;
  presets:         Preset[];
  onPresetsReload: () => void;
  pin:             string;
  connStatus:      'online' | 'offline' | 'checking';
}) {
  const { t } = useLanguage();
  const ch = channel.id;
  const hasColor   = channelHasCapability(channel, 'color');
  const hasBright  = channelHasCapability(channel, 'brightness');
  const hasEffects = channelHasCapability(channel, 'effects');

  const [pickerOpen,      setPickerOpen]      = useState(false);
  const [presetsOpen,     setPresetsOpen]      = useState(false);
  const [autoOpen,        setAutoOpen]         = useState(false);
  const [errorMsg,        setErrorMsg]         = useState<string | null>(null);
  const [applyingId,      setApplyingId]       = useState<string | null>(null);
  // activePresetId — local state, sadece bu session için
  const [activePresetId,  setActivePresetId]   = useState<string | null>(null);
  const [expandedEffectId,setExpandedEffectId] = useState<string | null>(null);
  const [editSpeed, setEditSpeed] = useState(128);
  const [editR, setEditR] = useState(0);
  const [editG, setEditG] = useState(150);
  const [editB, setEditB] = useState(255);

  const [rules,       setRules]       = useState<LocalRule[]>([]);
  const [rulesLoading,setRulesLoading]= useState(false);
  const [esp32Time,   setEsp32Time]   = useState<string | null>(null);
  const [formMode,    setFormMode]    = useState<'none'|'daily'|'countdown'|'sleep'>('none');
  const [savingRule,  setSavingRule]  = useState(false);
  const [dailyHour,   setDailyHour]   = useState(22);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [dailyAction, setDailyAction] = useState<0|1>(0);
  const [cdHour,      setCdHour]      = useState(0);
  const [cdMinute,    setCdMinute]    = useState(30);
  const [cdAction,    setCdAction]    = useState<0|1>(0);
  // Uyku modu
  const [sleepMinutes,  setSleepMinutes]  = useState(30);
  const [fadeState,     setFadeState]     = useState<FadeState | null>(null);
  const [startingFade,  setStartingFade]  = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const errorTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);

  const colorCss    = hasColor ? `rgb(${state.color.r},${state.color.g},${state.color.b})` : Colors.cyan;
  const progressPct = state.isOn ? '100%' : '0%';

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  // Cihaz değişince tüm geçici state'leri sıfırla
  useEffect(() => {
    setActivePresetId(null);
    setFadeState(null);
    setFormMode('none');
    setEditSpeed(128);
    setEditR(0); setEditG(150); setEditB(255);
    setSleepMinutes(30);
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
  }, [device.id]);

  // Fade aktifken periyodik durum sorgusu
  useEffect(() => {
    if (fadeState?.active) {
      fadeTimerRef.current = setInterval(async () => {
        const s = await getFadeState(device.ip, pin);
        if (s) {
          setFadeState(s);
          if (!s.active) {
            clearInterval(fadeTimerRef.current!);
            onStateChange({ isOn: false, activeEffect: null });
          }
        }
      }, 2000);
    } else {
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    }
    return () => { if (fadeTimerRef.current) clearInterval(fadeTimerRef.current); };
  }, [fadeState?.active]);

  useEffect(() => {
    if (autoOpen) {
      setRulesLoading(true);
      Promise.all([
        listRules(device.ip, pin, ch),
        getESP32Time(device.ip, pin),
      ]).then(([ruleList, time]) => {
        const filtered = (ruleList as any[]).filter((r: any) => (r.channel ?? 0) === ch);
        setRules(filtered.map((r) => ({ ...r, notificationId: undefined })));
        if (time) setEsp32Time(`${String(time.hour).padStart(2,'0')}:${String(time.minute).padStart(2,'0')}`);
        setRulesLoading(false);
      });
      timerRef.current = setInterval(() => setRules((p) => [...p]), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoOpen]);

  const toggleAccordion = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setter((p) => !p);
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  // Offline kontrolü — bağlı değilse işlem yapma
  // Toggle off → activePresetId ve activeEffect temizle
  // Toggle on  → efektsiz başla (activePresetId temizle)
  const toggle = async () => {
    if (connStatus !== 'online') { showError(t('control.errorOffline')); return; }
    const res = await api.get(state.isOn ? '/led/off' : '/led/on', undefined, ch);
    if (res.ok) {
      setActivePresetId(null);
      onStateChange({ isOn: !state.isOn, activeEffect: null });
    } else if (res.error?.type !== 'unauthorized') showError(t('control.errorConnection'));
  };

  const handleSliderChange = (value: number) => {
    const pct = Math.round(value);
    onStateChange({ brightness: pct });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await api.get('/led/brightness', { value: String(Math.round(pct/100*255)) }, ch);
    }, 300);
  };

  const handleSliderComplete = async (value: number) => {
    const pct = Math.round(value); const esp = Math.round(pct/100*255);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await api.get('/led/brightness', { value: String(esp) }, ch);
    await saveBrightness(device.id, esp);
  };

  const handleColorChange = async (r: number, g: number, b: number) => {
    onStateChange({ color: { r, g, b } });
    await api.get('/led/color', { r: String(r), g: String(g), b: String(b) }, ch);
    await saveColor(device.id, { r, g, b });
  };

  const handleApplyPreset = async (preset: Preset, overrides?: Partial<Preset>) => {
    const merged = { ...preset, ...overrides };
    setApplyingId(preset.id);
    try {
      if (merged.type === 'static') {
        await api.get('/led/color', { r: String(merged.r), g: String(merged.g), b: String(merged.b) }, ch);
        await api.get('/led/brightness', { value: String(merged.brightness ?? 255) }, ch);
        await api.get('/led/on', undefined, ch);
        onStateChange({ isOn: true, color: { r: merged.r!, g: merged.g!, b: merged.b! }, activeEffect: null });
      } else {
        let params: Record<string, string> = { type: merged.effect! };
        if (merged.effectR !== undefined) { params.r = String(merged.effectR); params.g = String(merged.effectG); params.b = String(merged.effectB); }
        if (merged.effectSpeed !== undefined) params.speed = String(merged.effectSpeed);
        await api.get('/effect', params, ch);
        onStateChange({ isOn: true, activeEffect: merged.effect ?? null });
      }
      setActivePresetId(preset.id);
    } catch { showError(t('control.errorPresetFailed')); }
    setApplyingId(null);
  };

  const handleDeletePreset = (preset: Preset) => {
    if (DEFAULT_IDS.has(preset.id)) return;
    Alert.alert(t('control.deletePresetTitle'), `"${getPresetDisplayName(preset, t)}"${t('control.deleteRuleConfirm')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await deletePreset(preset.id);
        onPresetsReload();
        if (activePresetId === preset.id) setActivePresetId(null);
      }},
    ]);
  };

  const handleStartFade = async () => {
    if (sleepMinutes <= 0) { showError(t('control.errorMinSleep')); return; }
    setStartingFade(true);
    const ok = await startFade(device.ip, pin, sleepMinutes * 60);
    setStartingFade(false);
    if (ok) {
      setFadeState({ active: true, remaining: sleepMinutes * 60, progress: 0 });
      setFormMode('none');
    } else {
      showError(t('control.errorSleepFailed'));
    }
  };

  const handleCancelFade = async () => {
    await cancelFade(device.ip, pin);
    setFadeState(null);
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
  };

  const handleAddDaily = async () => {
    setSavingRule(true);
    const result = await addDailyRule(device.ip, { hour: dailyHour, minute: dailyMinute, action: dailyAction, deviceName: `${device.name} - ${channel.name}`, pin, channel: ch });
    setSavingRule(false);
    if (result) {
      setRules((prev) => [...prev, { id: result.id, active: true, type: 0, hour: dailyHour, minute: dailyMinute, action: dailyAction, triggerAt: 0, triggered: false, channel: ch, notificationId: result.notificationId }]);
      setFormMode('none');
    } else showError(t('control.errorRuleFailed'));
  };

  const handleAddCountdown = async () => {
    const total = cdHour*3600+cdMinute*60;
    if (total===0) { showError(t('control.errorMinRule')); return; }
    setSavingRule(true);
    const result = await addCountdownRule(device.ip, { countdown: total, action: cdAction, deviceName: `${device.name} - ${channel.name}`, pin, channel: ch });
    setSavingRule(false);
    if (result) {
      const triggerAt = Math.floor(Date.now()/1000)+total;
      setRules((prev) => [...prev, { id: result.id, active: true, type: 1, hour: 0, minute: 0, action: cdAction, triggerAt, triggered: false, channel: ch, notificationId: result.notificationId }]);
      setFormMode('none');
    } else showError(t('control.errorRuleFailed'));
  };

  const handleDeleteRule = (rule: LocalRule) => {
    Alert.alert(t('control.deleteRuleTitle'), `"${ruleDescription(rule)}"${t('control.deleteRuleConfirm')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await deleteRule(device.ip, rule.id, pin, rule.notificationId);
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
      }},
    ]);
  };

  const handleToggleRule = async (rule: LocalRule) => {
    const result = await toggleRule(device.ip, rule.id, pin);
    if (result !== null) setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: result.active } : r));
  };

  const staticPresets = presets.filter((p) => p.type === 'static');
  const effectPresets = presets.filter((p) => p.type === 'effect');

  // Sahneler rozetini göster: ışık açık VE aktif preset var VE efekt var
  const showFxBadge = state.isOn && activePresetId !== null && state.activeEffect !== null;
  const activePreset = presets.find(p => p.id === activePresetId) ?? null;
  const activePrestName = activePreset ? getPresetDisplayName(activePreset, t) : null;

  return (
    <View style={cs.channelWrap}>
      {errorMsg && <View style={cs.errorBanner}><Text style={cs.errorBannerText}>⚠ {errorMsg}</Text></View>}

      <View style={cs.progressTrack}>
        <View style={[cs.progressFill, {
          width: progressPct,
          backgroundColor: showFxBadge ? Colors.purple : colorCss,
        }]} />
      </View>

      {hasBright && (
        <Animated.View style={[cs.sliderSection, { opacity: state.isOn ? 1 : 0.4 }]}>
          <View style={cs.sliderHeader}>
            <Text style={cs.sliderLabel}>{t('control.brightness')}</Text>
            <Text style={[cs.sliderValue, state.isOn && { color: colorCss }]}>{state.brightness}%</Text>
          </View>
          <Slider style={cs.slider} minimumValue={0} maximumValue={100} step={1} value={state.brightness}
            onValueChange={handleSliderChange} onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor={state.isOn?colorCss:Colors.border2}
            maximumTrackTintColor={Colors.border} thumbTintColor={state.isOn?colorCss:Colors.text2} />
          <View style={cs.sliderTicks}>
            <Text style={cs.sliderTick}>0</Text>
            <Text style={cs.sliderTick}>50</Text>
            <Text style={cs.sliderTick}>100</Text>
          </View>
        </Animated.View>
      )}

      {hasColor && (
        <View style={cs.accordion}>
          <TouchableOpacity onPress={() => toggleAccordion(setPickerOpen)} activeOpacity={0.8} style={cs.accordionHeader}>
            <View style={cs.accordionLeft}>
              <Text style={cs.accordionLabel}>{t('control.color')}</Text>
              {!state.isOn && <Text style={cs.accordionNote}>{t('control.willApplyOnTurnOn')}</Text>}
            </View>
            <View style={cs.colorPreview}>
              <View style={[cs.colorDot, { backgroundColor: colorCss, shadowColor: colorCss }]} />
              <Text style={cs.colorHex}>{rgbToHex(state.color.r, state.color.g, state.color.b)}</Text>
            </View>
            <Text style={[cs.chevron, pickerOpen && cs.chevronOpen]}>›</Text>
          </TouchableOpacity>
          {pickerOpen && (
            <View style={cs.accordionPanel}>
              <View style={cs.accordionDivider} />
              <ColorPicker initialR={state.color.r} initialG={state.color.g} initialB={state.color.b} onChange={handleColorChange} />
            </View>
          )}
        </View>
      )}

      {hasEffects && (
        <View style={cs.accordion}>
          <TouchableOpacity onPress={() => { toggleAccordion(setPresetsOpen); }} activeOpacity={0.8} style={cs.accordionHeader}>
            <View style={cs.accordionLeft}>
              <Text style={cs.accordionLabel}>{t('control.scenes')}</Text>
              {showFxBadge && activePrestName && (
                <Text style={cs.accordionNote}>{activePrestName} {t('control.activeStatusLabel')}</Text>
              )}
            </View>
            {showFxBadge && <View style={cs.fxBadge}><Text style={cs.fxBadgeText}>FX</Text></View>}
            <Text style={[cs.chevron, presetsOpen && cs.chevronOpen]}>›</Text>
          </TouchableOpacity>
          {presetsOpen && (
            <View style={cs.accordionPanel}>
              <View style={cs.accordionDivider} />
              <Text style={cs.presetSectionLabel}>{t('control.staticLabel')}</Text>
              <View style={cs.presetGrid}>
                {staticPresets.map((preset) => {
                  const isActive=activePresetId===preset.id;
                  const rgb=`rgb(${preset.r},${preset.g},${preset.b})`;
                  return (
                    <TouchableOpacity key={preset.id} onPress={() => handleApplyPreset(preset)}
                      onLongPress={() => handleDeletePreset(preset)} activeOpacity={0.75}
                      style={[cs.presetCard, isActive && cs.presetCardActive]}>
                      <Text style={cs.presetIcon}>{preset.icon}</Text>
                      <Text style={[cs.presetName, isActive && { color: Colors.cyan }]}>{getPresetDisplayName(preset, t)}</Text>
                      <View style={[cs.presetSwatch, { backgroundColor: rgb }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[cs.presetSectionLabel, { marginTop: Spacing.md }]}>{t('control.effectsLabel')}</Text>
              <View style={cs.effectList}>
                {effectPresets.map((preset) => {
                  const isActive=activePresetId===preset.id;
                  const isExpanded=expandedEffectId===preset.id;
                  const meta=getEffectMeta(t)[preset.effect as EffectType];
                  return (
                    <View key={preset.id} style={[cs.effectCard, isActive && cs.presetCardActive]}>
                      <TouchableOpacity onPress={() => handleApplyPreset(preset)} activeOpacity={0.75} style={cs.effectCardRow}>
                        <Text style={cs.presetIcon}>{preset.icon}</Text>
                        <View style={{ flex:1 }}>
                          <Text style={[cs.presetName, isActive && { color: Colors.cyan }]}>{getPresetDisplayName(preset, t)}</Text>
                          <Text style={cs.effectDesc}>{meta?.desc ?? preset.effect}</Text>
                        </View>
                        <Text style={cs.effectSpeed}>{speedLabel(preset.effectSpeed ?? 128, t)}</Text>
                        <TouchableOpacity onPress={() => {
                          setExpandedEffectId(isExpanded?null:preset.id);
                          setEditSpeed(preset.effectSpeed??128); setEditR(preset.effectR??0); setEditG(preset.effectG??150); setEditB(preset.effectB??255);
                        }} style={cs.expandBtn}>
                          <Text style={[cs.chevron, isExpanded && cs.chevronOpen]}>›</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={cs.effectPanel}>
                          <View style={cs.accordionDivider} />
                          <View style={cs.panelRow}><Text style={cs.panelLabel}>{t('control.speedLabel')}</Text><Text style={[cs.panelVal,{color:Colors.cyan}]}>{speedLabel(editSpeed, t)}</Text></View>
                          <Slider style={cs.panelSlider} minimumValue={0} maximumValue={255} step={1} value={editSpeed} onValueChange={(v)=>setEditSpeed(Math.round(v))} minimumTrackTintColor={Colors.cyan} maximumTrackTintColor={Colors.border} thumbTintColor={Colors.cyan} />
                          {meta?.hasColor && (
                            <>
                              <View style={cs.panelRow}><Text style={cs.panelLabel}>{t('control.color')}</Text><View style={[cs.panelColorDot,{backgroundColor:`rgb(${editR},${editG},${editB})`}]} /></View>
                              {([['R',editR,setEditR,`rgb(${editR},0,0)`],['G',editG,setEditG,`rgb(0,${editG},0)`],['B',editB,setEditB,`rgb(0,0,${editB})`]] as any[]).map(([l,v,s,c])=>(
                                <View key={l} style={cs.rgbRow}>
                                  <Text style={cs.rgbLabel}>{l}</Text>
                                  <Slider style={cs.rgbSlider} minimumValue={0} maximumValue={255} step={1} value={v} onValueChange={(val)=>s(Math.round(val))} minimumTrackTintColor={c} maximumTrackTintColor={Colors.border} thumbTintColor={c} />
                                  <Text style={cs.rgbVal}>{v}</Text>
                                </View>
                              ))}
                            </>
                          )}
                          <TouchableOpacity onPress={() => handleApplyPreset(preset,{effectSpeed:editSpeed,effectR:editR,effectG:editG,effectB:editB})} activeOpacity={0.75} style={cs.applyBtn}>
                            <Text style={cs.applyBtnText}>{t('control.applyButton')}</Text>
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

      <View style={cs.accordion}>
        <TouchableOpacity onPress={() => toggleAccordion(setAutoOpen)} activeOpacity={0.8} style={cs.accordionHeader}>
          <View style={cs.accordionLeft}>
            <Text style={cs.accordionLabel}>{t('control.automation')}</Text>
            {rules.filter(r=>!(r.type===1&&!r.active)).length>0 && <Text style={cs.accordionNote}>{rules.filter(r=>!(r.type===1&&!r.active)).length} kural</Text>}
          </View>
          {esp32Time && <Text style={cs.esp32Time}>{esp32Time}</Text>}
          <Text style={[cs.chevron, autoOpen && cs.chevronOpen]}>›</Text>
        </TouchableOpacity>
        {autoOpen && (
          <View style={cs.accordionPanel}>
            <View style={cs.accordionDivider} />
            {rulesLoading ? (
              <Text style={cs.automationEmpty}>{t('control.loading')}</Text>
            ) : rules.filter(r=>!(r.type===1&&!r.active)).length===0 && formMode==='none' ? (
              <Text style={cs.automationEmpty}>{t('control.noRulesYet')}</Text>
            ) : (
              rules.filter(r=>!(r.type===1&&!r.active)).map((rule) => (
                <View key={rule.id} style={cs.ruleRow}>
                  <View style={[cs.ruleDot,{backgroundColor:rule.active?Colors.cyan:Colors.text3}]} />
                  <View style={{flex:1}}>
                    <Text style={[cs.ruleDesc,!rule.active&&{color:Colors.text3}]}>{ruleDescription(rule)}</Text>
                    <View style={{flexDirection:'row',gap:Spacing.sm,marginTop:2}}>
                      <View style={cs.ruleTag}><Text style={cs.ruleTagText}>{rule.type===0?t('control.ruleDaily'):t('control.ruleOnce')}</Text></View>
                      <View style={[cs.ruleTag,{backgroundColor:rule.action===1?Colors.cyanAlpha:Colors.redAlpha}]}>
                        <Text style={[cs.ruleTagText,{color:rule.action===1?Colors.cyan:Colors.red}]}>{rule.action===1?t('control.ruleOn'):t('control.ruleOff')}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={()=>handleToggleRule(rule)} style={cs.ruleBtn}>
                    <Text style={[cs.ruleBtnText,{color:rule.active?Colors.cyan:Colors.text3}]}>{rule.active?'AKT':'PAS'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>handleDeleteRule(rule)} style={cs.ruleBtn}>
                    <Text style={[cs.ruleBtnText,{color:Colors.red}]}>{t('control.deleteButton')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {formMode==='none' && (
              <View style={cs.addRuleRow}>
                <TouchableOpacity onPress={()=>setFormMode('daily')} activeOpacity={0.75} style={cs.addRuleBtn}><Text style={cs.addRuleBtnText}>{t('control.dailyRule')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>setFormMode('countdown')} activeOpacity={0.75} style={cs.addRuleBtn}><Text style={cs.addRuleBtnText}>{t('control.countdownRule')}</Text></TouchableOpacity>
              </View>
            )}

            {/* Uyku Modu butonu */}
            {formMode==='none' && (
              <View style={{ marginTop: Spacing.sm }}>
                {fadeState?.active ? (
                  /* Aktif fade göstergesi */
                  <View style={cs.fadeActiveCard}>
                    <View style={cs.fadeActiveHeader}>
                      <Text style={cs.fadeActiveTitle}>{t('control.fadeActiveTitle')}</Text>
                      <TouchableOpacity onPress={handleCancelFade} style={cs.fadeCancelBtn}>
                        <Text style={cs.fadeCancelText}>{t('control.fadeCancelButton')}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={cs.fadeProgressTrack}>
                      <View style={[cs.fadeProgressFill, { width: `${fadeState.progress ?? 0}%` }]} />
                    </View>
                    <Text style={cs.fadeRemaining}>
                      {fadeState.remaining !== undefined
                        ? `${Math.floor(fadeState.remaining / 60)} ${t('control.fadeTimeRemaining')} ${fadeState.remaining % 60} ${t('scan.secondsUnit')}`
                        : t('control.fadeCalculating')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setFormMode('sleep')}
                    activeOpacity={0.75}
                    style={[cs.addRuleBtn, { borderColor: Colors.purple }]}
                  >
                    <Text style={[cs.addRuleBtnText, { color: Colors.purple }]}>{t('control.sleepModeButton')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <Modal visible={formMode!=='none'} transparent animationType="slide" onRequestClose={()=>setFormMode('none')}>
        <KeyboardAvoidingView style={cs.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={cs.modalBackdrop} onPress={()=>setFormMode('none')} activeOpacity={1} />
          <View style={cs.modalCard}>
            {formMode === 'sleep' ? (
              <>
                <Text style={cs.ruleFormTitle}>// UYKU MODU</Text>
                <Text style={cs.sleepDesc}>
                  {t('control.sleepModeDesc')}
                </Text>
                <View style={cs.timePickerRow}>
                  <NumberPicker
                    label={t('control.minutesLabel')}
                    value={sleepMinutes}
                    min={1}
                    max={180}
                    onChange={setSleepMinutes}
                  />
                </View>
                <View style={cs.ruleFormButtons}>
                  <TouchableOpacity
                    onPress={handleStartFade}
                    disabled={startingFade}
                    activeOpacity={0.75}
                    style={[cs.saveRuleBtn, { borderColor: Colors.purple, backgroundColor: Colors.purpleAlpha }, startingFade && { opacity: 0.5 }]}
                  >
                    <Text style={[cs.saveRuleBtnText, { color: Colors.purple }]}>
                      {startingFade ? t('control.sleepStarting') : `🌙 ${t('control.sleepStart')}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>setFormMode('none')} style={cs.cancelRuleBtn}>
                    <Text style={cs.cancelRuleBtnText}>{t('control.sleepCancel')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={cs.ruleFormTitle}>{formMode==='daily'?t('control.dailyTimerTitle'):t('control.countdownTitle')}</Text>
                <View style={cs.timePickerRow}>
                  <NumberPicker label="SAAT" value={formMode==='daily'?dailyHour:cdHour} min={0} max={23} onChange={formMode==='daily'?setDailyHour:setCdHour} />
                  <Text style={cs.timeSep}>:</Text>
                  <NumberPicker label={t('control.minutesLabel')} value={formMode==='daily'?dailyMinute:cdMinute} min={0} max={59} onChange={formMode==='daily'?setDailyMinute:setCdMinute} />
                </View>
                <View style={cs.actionRow}>
                  <TouchableOpacity onPress={()=>formMode==='daily'?setDailyAction(1):setCdAction(1)} activeOpacity={0.75}
                    style={[cs.actionChoice,(formMode==='daily'?dailyAction:cdAction)===1&&cs.actionChoiceOn]}>
                    <Text style={[cs.actionChoiceText,(formMode==='daily'?dailyAction:cdAction)===1&&{color:Colors.cyan}]}>{t('control.turnOnLabel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>formMode==='daily'?setDailyAction(0):setCdAction(0)} activeOpacity={0.75}
                    style={[cs.actionChoice,(formMode==='daily'?dailyAction:cdAction)===0&&cs.actionChoiceOff]}>
                    <Text style={[cs.actionChoiceText,(formMode==='daily'?dailyAction:cdAction)===0&&{color:Colors.red}]}>KAPAT</Text>
                  </TouchableOpacity>
                </View>
                <View style={cs.ruleFormButtons}>
                  <TouchableOpacity onPress={formMode==='daily'?handleAddDaily:handleAddCountdown}
                    disabled={savingRule||(formMode==='countdown'&&cdHour===0&&cdMinute===0)} activeOpacity={0.75}
                    style={[cs.saveRuleBtn,(savingRule||(formMode==='countdown'&&cdHour===0&&cdMinute===0))&&{opacity:0.5}]}>
                    <Text style={cs.saveRuleBtnText}>{savingRule?t('control.savingButton'):t('control.saveButton')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>setFormMode('none')} style={cs.cancelRuleBtn}>
                    <Text style={cs.cancelRuleBtnText}>{t('control.sleepCancel')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Ana ControlScreen ─────────────────────────────────────────────────────────
export default function ControlScreen({ device, devices, onOpenList, onAddDevice, onDeviceChange, onOpenGroups, onOpenStats, syncKey }: Props) {
  const { t } = useLanguage();
  const [currentPin,     setCurrentPin]     = useState(device.pin ?? '');
  const [showPinScreen,  setShowPinScreen]  = useState(false);
  const [pinScreenMode,  setPinScreenMode]  = useState<'enter'|'setup'>('enter');
  const [pinError,       setPinError]       = useState<string | null>(null);
  const [pinLoading,     setPinLoading]     = useState(false);
  const [presets,        setPresets]        = useState<Preset[]>([]);

  const slideAnim    = useRef(new Animated.Value(0)).current;
  const [sliding,    setSliding]    = useState(false);

  const currentIndex  = devices.findIndex((d) => d.id === device.id);
  const prevIndex     = (currentIndex - 1 + devices.length) % devices.length;
  const nextIndex     = (currentIndex + 1) % devices.length;
  const isMultiDevice = devices.length > 1;

  const slideToDevice = (nextDevice: Device, direction: 'left' | 'right') => {
    if (sliding) return;
    setSliding(true);
    const outDir = direction === 'right' ? SCREEN_W : -SCREEN_W;
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: direction === 'right' ? -SCREEN_W : SCREEN_W,
      duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      onDeviceChange(nextDevice);
      slideAnim.setValue(outDir);
      Animated.timing(slideAnim, {
        toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start(() => setSliding(false));
    });
  };

  const safeChannels = device.channels ?? [{ id: 0, name: t('control.stripLabel'), capabilities: device.capabilities ?? ['on_off','brightness','color','effects'], leds: device.leds }];
  const [viewerWidth, setViewerWidth] = useState(CARD_W);
  const viewerHeight = Math.round(viewerWidth * 1.1);

  const [channelStates, setChannelStates] = useState<ChannelState[]>(
    safeChannels.map(() => ({
      isOn:         false,
      brightness:   Math.round((device.brightness ?? 255) / 255 * 100),
      color:        { r: device.color?.r ?? 255, g: device.color?.g ?? 255, b: device.color?.b ?? 255 },
      activeEffect: null,
    }))
  );

  const api = createAPI(device.ip, currentPin, () => {
    setPinError(null); setPinScreenMode('enter'); setShowPinScreen(true);
  });

  const handleIpChanged = useCallback(async (newIp: string) => {
    // ESP32 yeni IP aldı — cihazı güncelle ve yeniden bağlan
    await updateDeviceIp(device.id, newIp);
    onDeviceChange({ ...device, ip: newIp });
  }, [device, onDeviceChange]);

  const { status: connStatus, latency } = useConnectionStatus({
    ip:           device.ip,
    deviceSerial: device.serial,
    deviceParts:  device.parts ?? [],
    onIpChanged:  handleIpChanged,
  });
  const prevStatus = useRef<string>('checking');
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prevStatus.current !== 'online' && connStatus === 'online') syncAllChannels();
    prevStatus.current = connStatus;
  }, [connStatus]);

  useEffect(() => {
    setCurrentPin(device.pin ?? '');
    loadPresets();
    requestNotificationPermission();
    syncAllChannels();
  }, [device.id]);

  useEffect(() => {
    const anyOn = channelStates.some((s) => s.isOn);
    Animated.timing(bgAnim, { toValue: anyOn?1:0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [channelStates]);

  const syncAllChannels = async () => {
    try {
      const whoamiRes = await fetch(`http://${device.ip}/whoami`);
      if (whoamiRes.ok) {
        const data = await whoamiRes.json();
        const parts: string[] = Array.isArray(data.parts) ? data.parts : device.parts ?? [];
        const partColors:    Record<string, string> = data.partColors    ?? {};
        const partRoughness: Record<string, number> = data.partRoughness ?? {};
        const partMetalness: Record<string, number> = data.partMetalness ?? {};
        const partMaterials: Record<string, any> = {};
        parts.forEach((key: string) => {
          partMaterials[key] = {
            color:     partColors[key]    ?? '#2a2a2a',
            roughness: partRoughness[key] ?? 0.8,
            metalness: partMetalness[key] ?? 0.1,
          };
        });
        await saveDeviceMeta(device.id, parts, partMaterials, data.channels);
      }
    } catch {}

    for (let i = 0; i < safeChannels.length; i++) {
      const res = await api.get('/led/state', undefined, i);
      if (res.ok) {
        const data = res.data;
        setChannelStates((prev) => {
          const next = [...prev];
          next[i] = {
            isOn:         data.on ?? false,
            brightness:   Math.round((data.brightness ?? 255) / 255 * 100),
            color:        { r: data.r ?? 255, g: data.g ?? 255, b: data.b ?? 255 },
            activeEffect: data.effect === 'off' ? null : (data.effect ?? null),
          };
          return next;
        });
      }
    }
  };

  // syncKey her değişince (overlay ekranlardan geri dönünce) LED durumunu güncelle
  useEffect(() => {
    if (syncKey > 0) syncAllChannels();
  }, [syncKey]);

  const loadPresets = useCallback(async () => {
    setPresets(await getPresets());

  }, []);

  const updateChannelState = (index: number, state: Partial<ChannelState>) => {
    setChannelStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...state };
      return next;
    });
  };

  const handlePinSubmit = async (enteredPin: string) => {
    setPinLoading(true); setPinError(null);
    const testApi = createAPI(device.ip, enteredPin);
    const res = await testApi.get('/led/state', undefined, 0);
    if (res.ok) {
      setCurrentPin(enteredPin); await savePin(device.id, enteredPin);
      setShowPinScreen(false); setPinError(null);
    } else if (res.error?.type === 'unauthorized') { setPinError(t('control.pinErrorWrong')); }
    else { setPinError(t('control.pinErrorConnection')); }
    setPinLoading(false);
  };

  const bgColor = bgAnim.interpolate({ inputRange:[0,1], outputRange:[Colors.bg,'#060a0f'] });
  const connDotColor = connStatus==='online'?Colors.green:connStatus==='offline'?Colors.red:Colors.text3;
  const isMultiChannel = safeChannels.length > 1;

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>
      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({length:18}).map((_,i)=><View key={i} style={styles.scanline}/>)}
      </View>

      {showPinScreen && (
        <PinScreen deviceName={device.name} mode={pinScreenMode} onSubmit={handlePinSubmit}
          onCancel={()=>{setShowPinScreen(false);setPinError(null);if(!currentPin)onOpenList();}}
          error={pinError} isLoading={pinLoading} />
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenList} style={styles.deviceNameBtn}>
          <Text style={styles.deviceNameLabel}>{t('control.activeDevice')}</Text>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name} ›</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={[styles.connDot,{backgroundColor:connDotColor}]} />
          {connStatus==='online'&&latency!==null&&<Text style={styles.latencyText}>{latency}ms</Text>}
          {connStatus==='offline'&&<Text style={styles.offlineText}>OFFLINE</Text>}
          {currentPin!==''&&<Text style={styles.pinIcon}>🔒</Text>}
          <TouchableOpacity onPress={onOpenStats} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenGroups} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>🏠</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAddDevice} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerDivider} />
      <View style={styles.ipRow}>
        <Text style={styles.ipLabel}>{t('control.connection')}</Text>
        <Text style={styles.ipValue}>{device.ip}</Text>
        <Text style={styles.ipLabel}> · </Text>
        <Text style={[styles.ipValue,{color:device.type==='ws2812b'?Colors.purple:device.type==='single_led'?Colors.amber:Colors.text3}]}>
          {device.type==='ws2812b'?`${safeChannels.length} ${t('control.multiChannel')}`:device.type==='single_led'?t('control.singleLed'):device.type==='relay'?t('control.relay'):'?'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        {/* Model Kartı */}
        <View style={styles.modelCardOuter}>
          {isMultiDevice && (
            <TouchableOpacity onPress={() => slideToDevice(devices[prevIndex], 'left')} style={styles.slideBtn} activeOpacity={0.7}>
              <Text style={styles.slideBtnText}>‹</Text>
            </TouchableOpacity>
          )}

          <Animated.View style={[styles.modelCard, { transform: [{ translateX: slideAnim }] }]}>
            <TouchableOpacity
              onPress={() => {
                if (connStatus !== 'online') return;
                if (!isMultiChannel) {
                  const anyOn = channelStates.some((s) => s.isOn);
                  safeChannels.forEach((_, i) => {
                    const api_i = createAPI(device.ip, currentPin, () => { setPinScreenMode('enter'); setShowPinScreen(true); });
                    api_i.get(anyOn ? '/led/off' : '/led/on', undefined, i);
                    updateChannelState(i, { isOn: !anyOn, activeEffect: null });
                  });
                }
              }}
              activeOpacity={0.9}
              style={styles.modelViewerWrap}
              onLayout={(e) => setViewerWidth(e.nativeEvent.layout.width)}
            >
              <Model3DViewer
                parts={device.parts ?? []}
                partMaterials={device.partMaterials ?? {}}
                isOn={channelStates.some((s) => s.isOn)}
                lightColor={channelStates.find((s) => s.isOn)?.color ?? { r: 255, g: 255, b: 255 }}
                width={viewerWidth}
                height={viewerHeight}
              />
              <View style={styles.modelStatusBadge} pointerEvents="none">
                <View style={[styles.modelStatusDot, {
                  backgroundColor: channelStates.some((s) => s.isOn)
                    ? `rgb(${channelStates.find((s)=>s.isOn)?.color.r??255},${channelStates.find((s)=>s.isOn)?.color.g??255},${channelStates.find((s)=>s.isOn)?.color.b??255})`
                    : Colors.border2,
                }]} />
                <Text style={[styles.modelStatusText, { color: channelStates.some((s) => s.isOn) ? Colors.cyan : Colors.text3 }]}>
                  {channelStates.some((s) => s.isOn) ? t('control.modelOn') : t('control.modelOff')}
                </Text>
              </View>
              <View style={styles.modelHint} pointerEvents="none">
                <Text style={styles.modelHintText}>
                  {isMultiChannel ? t('control.dragRotateMulti') : t('control.dragRotateSingle')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.modelDivider} />

            <View style={[styles.channelButtonsRow, isMultiChannel && styles.channelButtonsRowMulti]}>
              {safeChannels.map((channel, index) => {
                const s        = channelStates[index];
                const colorRgb = `rgb(${s.color.r},${s.color.g},${s.color.b})`;
                const isOn     = s.isOn;
                return (
                  <TouchableOpacity
                    key={channel.id}
                    onPress={async () => {
                      if (connStatus !== 'online') return;
                      const res = await api.get(isOn ? '/led/off' : '/led/on', undefined, index);
                      if (res.ok) updateChannelState(index, { isOn: !isOn, activeEffect: null });
                    }}
                    activeOpacity={0.75}
                    style={[styles.channelPowerBtn, isMultiChannel && styles.channelPowerBtnMulti, isOn && { borderColor: colorRgb }]}
                  >
                    <View style={[styles.powerIcon, isOn && { borderColor: colorRgb, shadowColor: colorRgb, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
                      <View style={[styles.powerDot, { backgroundColor: isOn ? colorRgb : Colors.border2, shadowColor: isOn ? colorRgb : 'transparent', shadowOpacity: isOn ? 1 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }]} />
                    </View>
                    <View style={styles.powerBtnText}>
                      {isMultiChannel && <Text style={[styles.powerBtnChannel, isOn && { color: colorRgb }]}>{channel.name.toUpperCase()}</Text>}
                      <Text style={[styles.powerBtnState, isOn && { color: colorRgb }]}>
                        {isOn ? (s.activeEffect ? s.activeEffect.toUpperCase() : t('control.modelOn')) : t('control.modelOff')}
                      </Text>
                    </View>
                    {isOn && <View style={[styles.powerBtnColorDot, { backgroundColor: colorRgb, shadowColor: colorRgb, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {isMultiDevice && (
            <TouchableOpacity onPress={() => slideToDevice(devices[nextIndex], 'right')} style={styles.slideBtn} activeOpacity={0.7}>
              <Text style={styles.slideBtnText}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kanal kontrolleri */}
        {safeChannels.map((channel, index) => (
          <View key={channel.id}>
            {isMultiChannel && (
              <View style={styles.channelHeader}>
                <View style={styles.channelHeaderLine} />
                <Text style={styles.channelHeaderText}>{channel.name.toUpperCase()}</Text>
                <View style={styles.channelHeaderLine} />
              </View>
            )}
            <ChannelControl
              channel={channel}
              device={device}
              api={api}
              state={channelStates[index]}
              onStateChange={(s) => updateChannelState(index, s)}
              presets={presets}
              onPresetsReload={loadPresets}
              pin={currentPin}
              connStatus={connStatus}
            />
          </View>
        ))}
      </ScrollView>

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.lg, paddingHorizontal: Spacing.xl },
  deviceNameBtn: { gap: 2, flex: 1 },
  deviceNameLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  deviceName: { fontFamily: Fonts.sans, fontSize: 16, color: Colors.text, fontWeight: '400' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  connDot: { width: 6, height: 6, borderRadius: 999 },
  latencyText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.green },
  offlineText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.red },
  pinIcon: { fontSize: 12 },
  headerBtn: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center' },
  headerBtnActive: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  headerBtnText: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.cyan, lineHeight: 18 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md, marginHorizontal: Spacing.xl },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, paddingHorizontal: Spacing.xl, flexWrap: 'wrap' },
  ipLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.text3 },
  ipValue: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.cyan },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.lg },
  channelHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.lg },
  channelHeaderLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.cyan2 },
  channelHeaderText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 4, color: Colors.cyan },
  modelCardOuter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLIDE_GAP, marginBottom: Spacing.md },
  modelCard: { width: CARD_W, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  slideBtn: { width: SLIDE_BTN_W, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm, backgroundColor: Colors.bg3, flexShrink: 0 },
  slideBtnText: { fontFamily: Fonts.mono, fontSize: 22, color: Colors.cyan, lineHeight: 28 },
  modelViewerWrap: { position: 'relative' },
  modelStatusBadge: { position: 'absolute', top: Spacing.md, left: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(7,11,20,0.75)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  modelStatusDot: { width: 5, height: 5, borderRadius: 3 },
  modelStatusText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3 },
  modelHint: { position: 'absolute', bottom: Spacing.sm, left: 0, right: 0, alignItems: 'center' },
  modelHintText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.border2 },
  modelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  channelButtonsRow: { flexDirection: 'row' },
  channelButtonsRowMulti: {},
  channelPowerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  channelPowerBtnMulti: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: Colors.border },
  powerIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  powerDot: { width: 10, height: 10, borderRadius: 5 },
  powerBtnText: { flex: 1, gap: 2 },
  powerBtnChannel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  powerBtnState: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  powerBtnColorDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});

const cs = StyleSheet.create({
  channelWrap: { gap: Spacing.md, marginBottom: Spacing.md },
  errorBanner: { marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.redAlpha, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm },
  errorBannerText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },
  modelWrap: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  modelStateRow: { position: 'absolute', top: Spacing.md, left: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(7,11,20,0.7)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  modelStateDot: { width: 6, height: 6, borderRadius: 3, elevation: 2 },
  modelStateText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3 },
  modelTapHint: { position: 'absolute', bottom: Spacing.sm, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  modelTapHintText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.border2 },
  progressTrack: { height: 1, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  sliderSection: { gap: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  sliderValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  slider: { width: '100%', height: 28, marginVertical: 2 },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderTick: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  accordion: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  accordionLeft: { flex: 1, gap: 2 },
  accordionLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  accordionNote: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.amber },
  chevron: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.text2, lineHeight: 22 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  accordionPanel: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  accordionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.lg },
  colorPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 3 },
  colorHex: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  fxBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.purple, backgroundColor: Colors.purpleAlpha },
  fxBadgeText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.purple },
  presetSectionLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3, marginBottom: Spacing.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg4, padding: Spacing.sm },
  presetCardActive: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  presetIcon: { fontSize: 18 },
  presetName: { flex: 1, fontFamily: Fonts.sans, fontSize: 12, color: Colors.text },
  presetSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2 },
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: Colors.bg2, borderTopWidth: 1, borderTopColor: Colors.border, borderTopLeftRadius: Radius.md*2, borderTopRightRadius: Radius.md*2, padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xl+20 },
  ruleFormTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.cyan },
  timePickerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.md },
  timeSep: { fontFamily: Fonts.mono, fontSize: 28, color: Colors.text2, marginBottom: 4, lineHeight: 48 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionChoice: { flex: 1, height: 40, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  actionChoiceOn:  { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  actionChoiceOff: { borderColor: Colors.red, backgroundColor: Colors.redAlpha },
  actionChoiceText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  ruleFormButtons: { flexDirection: 'row', gap: Spacing.sm },
  saveRuleBtn: { flex: 1, height: 42, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  saveRuleBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },
  cancelRuleBtn: { height: 42, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  cancelRuleBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.text2 },
  // Uyku modu
  sleepDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, lineHeight: 20, textAlign: 'center' },
  fadeActiveCard: { borderWidth: 1, borderColor: Colors.purple, borderRadius: Radius.md, backgroundColor: Colors.purpleAlpha, padding: Spacing.md, gap: Spacing.sm },
  fadeActiveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fadeActiveTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.purple },
  fadeCancelBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm },
  fadeCancelText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.red },
  fadeProgressTrack: { height: 2, backgroundColor: Colors.border, borderRadius: 1, overflow: 'hidden' },
  fadeProgressFill: { height: '100%', backgroundColor: Colors.purple, borderRadius: 1 },
  fadeRemaining: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3, textAlign: 'center' },
});