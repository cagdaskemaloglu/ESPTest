/**
 * screens/ControlScreen.tsx
 *
 * channels.length === 1 → tek kanallı UI (mevcut görünüm)
 * channels.length > 1   → her kanal için ayrı bölüm
 *
 * Her kanal bağımsız: toggle, brightness, renk, sahneler, otomasyon
 * API isteklerinde ?channel=N parametresi gönderilir
 */

import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
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
import { createAPI } from '../services/apiService';
import {
  AutomationRule, addCountdownRule, addDailyRule,
  deleteRule, getESP32Time, listRules, ruleDescription, toggleRule,
} from '../services/automationService';
import { saveBrightness, saveColor, saveDeviceMeta, savePin } from '../services/deviceStorage';
import { requestNotificationPermission } from '../services/notificationService';
import {
  DEFAULT_IDS, EFFECT_META, EffectType,
  Preset,
  deletePreset, getPresets
} from '../services/presetStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Channel, Device, channelHasCapability } from '../types/Device';

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  device:      Device;
  onOpenList:  () => void;
  onAddDevice: () => void;
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

// ── Kanal durumu ──────────────────────────────────────────────────────────────
type ChannelState = {
  isOn:        boolean;
  brightness:  number; // 0-100
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
            <TextInput value={inputVal} onChangeText={(t) => setInputVal(t.replace(/\D/g,''))}
              onBlur={() => { const p=parseInt(inputVal,10); if(!isNaN(p)) onChange(clamp(p)); setEditing(false); }}
              onSubmitEditing={() => { const p=parseInt(inputVal,10); if(!isNaN(p)) onChange(clamp(p)); setEditing(false); }}
              keyboardType="number-pad" maxLength={2} autoFocus selectTextOnFocus style={np.displayInput} />
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

// ── Tek kanal kontrol bileşeni ─────────────────────────────────────────────────
function ChannelControl({
  channel, device, api, state, onStateChange, presets, onPresetsReload,
}: {
  channel:        Channel;
  device:         Device;
  api:            ReturnType<typeof createAPI>;
  state:          ChannelState;
  onStateChange:  (s: Partial<ChannelState>) => void;
  presets:        Preset[];
  onPresetsReload: () => void;
}) {
  const ch = channel.id;
  const hasColor   = channelHasCapability(channel, 'color');
  const hasBright  = channelHasCapability(channel, 'brightness');
  const hasEffects = channelHasCapability(channel, 'effects');

  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [presetsOpen,  setPresetsOpen]  = useState(false);
  const [autoOpen,     setAutoOpen]     = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  // Sahneler
  const [applyingId,      setApplyingId]      = useState<string | null>(null);
  const [activePresetId,  setActivePresetId]  = useState<string | null>(null);
  const [expandedEffectId,setExpandedEffectId]= useState<string | null>(null);
  const [editSpeed, setEditSpeed] = useState(128);
  const [editR, setEditR] = useState(0);
  const [editG, setEditG] = useState(150);
  const [editB, setEditB] = useState(255);

  // Otomasyon
  const [rules,       setRules]       = useState<LocalRule[]>([]);
  const [rulesLoading,setRulesLoading]= useState(false);
  const [esp32Time,   setEsp32Time]   = useState<string | null>(null);
  const [formMode,    setFormMode]    = useState<'none'|'daily'|'countdown'>('none');
  const [savingRule,  setSavingRule]  = useState(false);
  const [dailyHour,   setDailyHour]   = useState(22);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [dailyAction, setDailyAction] = useState<0|1>(0);
  const [cdHour,   setCdHour]   = useState(0);
  const [cdMinute, setCdMinute] = useState(30);
  const [cdAction, setCdAction] = useState<0|1>(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const errorTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);

  const colorCss      = hasColor ? `rgb(${state.color.r},${state.color.g},${state.color.b})` : Colors.cyan;
  const progressPct   = state.isOn ? '100%' : '0%';

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  // Otomasyon yükle
  useEffect(() => {
    if (autoOpen) {
      setRulesLoading(true);
      Promise.all([listRules(device.ip), getESP32Time(device.ip)]).then(([ruleList, time]) => {
        // Bu kanalın kurallarını filtrele
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

  // LED kontrol
  const toggle = async () => {
    const res = await api.get(state.isOn ? '/led/off' : '/led/on', undefined, ch);
    if (res.ok) { onStateChange({ isOn: !state.isOn, activeEffect: state.isOn ? null : state.activeEffect }); }
    else if (res.error?.type !== 'unauthorized') showError('Bağlantı hatası');
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

  // Sahneler
  const handleApplyPreset = async (preset: Preset, overrides?: Partial<Preset>) => {
    const merged = { ...preset, ...overrides };
    setApplyingId(preset.id);
    try {
      // applyPreset ip'e gönderir — channel ekle
      const baseUrl = `http://${device.ip}`;
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
    } catch { showError('Preset uygulanamadı'); }
    setApplyingId(null);
  };

  const handleDeletePreset = (preset: Preset) => {
    if (DEFAULT_IDS.has(preset.id)) return;
    Alert.alert('Preseti Sil', `"${preset.name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { await deletePreset(preset.id); onPresetsReload(); if (activePresetId===preset.id) setActivePresetId(null); }},
    ]);
  };

  // Otomasyon
  const handleAddDaily = async () => {
    setSavingRule(true);
    const result = await addDailyRule(device.ip, { hour: dailyHour, minute: dailyMinute, action: dailyAction, deviceName: `${device.name} - ${channel.name}` });
    setSavingRule(false);
    if (result) {
      setRules((prev) => [...prev, { id: result.id, active: true, type: 0, hour: dailyHour, minute: dailyMinute, action: dailyAction, triggerAt: 0, triggered: false, channel: ch, notificationId: result.notificationId }]);
      setFormMode('none');
    } else showError('Kural eklenemedi');
  };

  const handleAddCountdown = async () => {
    const total = cdHour*3600+cdMinute*60;
    if (total===0) { showError('En az 1 dakika gir'); return; }
    setSavingRule(true);
    const result = await addCountdownRule(device.ip, { countdown: total, action: cdAction, deviceName: `${device.name} - ${channel.name}` });
    setSavingRule(false);
    if (result) {
      const triggerAt = Math.floor(Date.now()/1000)+total;
      setRules((prev) => [...prev, { id: result.id, active: true, type: 1, hour: 0, minute: 0, action: cdAction, triggerAt, triggered: false, channel: ch, notificationId: result.notificationId }]);
      setFormMode('none');
    } else showError('Kural eklenemedi');
  };

  const handleDeleteRule = (rule: LocalRule) => {
    Alert.alert('Kuralı Sil', `"${ruleDescription(rule)}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { await deleteRule(device.ip, rule.id, rule.notificationId); setRules((prev) => prev.filter((r) => r.id!==rule.id)); }},
    ]);
  };

  const handleToggleRule = async (rule: LocalRule) => {
    const result = await toggleRule(device.ip, rule.id);
    if (result!==null) setRules((prev) => prev.map((r) => r.id===rule.id ? { ...r, active: result.active } : r));
  };

  const staticPresets = presets.filter((p) => p.type === 'static');
  const effectPresets = presets.filter((p) => p.type === 'effect');

  return (
    <View style={cs.channelWrap}>
      {/* Hata banner */}
      {errorMsg && <View style={cs.errorBanner}><Text style={cs.errorBannerText}>⚠ {errorMsg}</Text></View>}

      {/* Progress bar */}
      <View style={cs.progressTrack}>
        <View style={[cs.progressFill, {
          width: progressPct,
          backgroundColor: state.activeEffect ? Colors.purple : colorCss,
        }]} />
      </View>

      {/* Parlaklık */}
      {hasBright && (
        <Animated.View style={[cs.sliderSection, { opacity: state.isOn ? 1 : 0.4 }]}>
          <View style={cs.sliderHeader}>
            <Text style={cs.sliderLabel}>PARLAKLIK</Text>
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

      {/* Renk accordion */}
      {hasColor && (
        <View style={cs.accordion}>
          <TouchableOpacity onPress={() => toggleAccordion(setPickerOpen)} activeOpacity={0.8} style={cs.accordionHeader}>
            <View style={cs.accordionLeft}>
              <Text style={cs.accordionLabel}>RENK</Text>
              {!state.isOn && <Text style={cs.accordionNote}>açılınca uygulanacak</Text>}
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

      {/* Sahneler accordion */}
      {hasEffects && (
        <View style={cs.accordion}>
          <TouchableOpacity onPress={() => { toggleAccordion(setPresetsOpen); }} activeOpacity={0.8} style={cs.accordionHeader}>
            <View style={cs.accordionLeft}>
              <Text style={cs.accordionLabel}>SAHNELER</Text>
              {state.activeEffect && <Text style={cs.accordionNote}>{state.activeEffect.toUpperCase()} aktif</Text>}
            </View>
            {state.activeEffect && <View style={cs.fxBadge}><Text style={cs.fxBadgeText}>FX</Text></View>}
            <Text style={[cs.chevron, presetsOpen && cs.chevronOpen]}>›</Text>
          </TouchableOpacity>
          {presetsOpen && (
            <View style={cs.accordionPanel}>
              <View style={cs.accordionDivider} />
              <Text style={cs.presetSectionLabel}>STATİK</Text>
              <View style={cs.presetGrid}>
                {staticPresets.map((preset) => {
                  const isActive=activePresetId===preset.id;
                  const rgb=`rgb(${preset.r},${preset.g},${preset.b})`;
                  return (
                    <TouchableOpacity key={preset.id} onPress={() => handleApplyPreset(preset)}
                      onLongPress={() => handleDeletePreset(preset)} activeOpacity={0.75}
                      style={[cs.presetCard, isActive && cs.presetCardActive]}>
                      <Text style={cs.presetIcon}>{preset.icon}</Text>
                      <Text style={[cs.presetName, isActive && { color: Colors.cyan }]}>{preset.name}</Text>
                      <View style={[cs.presetSwatch, { backgroundColor: rgb }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[cs.presetSectionLabel, { marginTop: Spacing.md }]}>EFEKTLER</Text>
              <View style={cs.effectList}>
                {effectPresets.map((preset) => {
                  const isActive=activePresetId===preset.id;
                  const isExpanded=expandedEffectId===preset.id;
                  const meta=EFFECT_META[preset.effect as EffectType];
                  return (
                    <View key={preset.id} style={[cs.effectCard, isActive && cs.presetCardActive]}>
                      <TouchableOpacity onPress={() => handleApplyPreset(preset)} activeOpacity={0.75} style={cs.effectCardRow}>
                        <Text style={cs.presetIcon}>{preset.icon}</Text>
                        <View style={{ flex:1 }}>
                          <Text style={[cs.presetName, isActive && { color: Colors.cyan }]}>{preset.name}</Text>
                          <Text style={cs.effectDesc}>{meta?.desc ?? preset.effect}</Text>
                        </View>
                        <Text style={cs.effectSpeed}>{speedLabel(preset.effectSpeed ?? 128)}</Text>
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
                          <View style={cs.panelRow}><Text style={cs.panelLabel}>HIZ</Text><Text style={[cs.panelVal,{color:Colors.cyan}]}>{speedLabel(editSpeed)}</Text></View>
                          <Slider style={cs.panelSlider} minimumValue={0} maximumValue={255} step={1} value={editSpeed} onValueChange={(v)=>setEditSpeed(Math.round(v))} minimumTrackTintColor={Colors.cyan} maximumTrackTintColor={Colors.border} thumbTintColor={Colors.cyan} />
                          {meta?.hasColor && (
                            <>
                              <View style={cs.panelRow}><Text style={cs.panelLabel}>RENK</Text><View style={[cs.panelColorDot,{backgroundColor:`rgb(${editR},${editG},${editB})`}]} /></View>
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
                            <Text style={cs.applyBtnText}>[ UYGULA ]</Text>
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

      {/* Otomasyon accordion */}
      <View style={cs.accordion}>
        <TouchableOpacity onPress={() => toggleAccordion(setAutoOpen)} activeOpacity={0.8} style={cs.accordionHeader}>
          <View style={cs.accordionLeft}>
            <Text style={cs.accordionLabel}>OTOMASYON</Text>
            {rules.filter(r=>!(r.type===1&&!r.active)).length>0 && <Text style={cs.accordionNote}>{rules.filter(r=>!(r.type===1&&!r.active)).length} kural</Text>}
          </View>
          {esp32Time && <Text style={cs.esp32Time}>{esp32Time}</Text>}
          <Text style={[cs.chevron, autoOpen && cs.chevronOpen]}>›</Text>
        </TouchableOpacity>
        {autoOpen && (
          <View style={cs.accordionPanel}>
            <View style={cs.accordionDivider} />
            {rulesLoading ? (
              <Text style={cs.automationEmpty}>Yükleniyor...</Text>
            ) : rules.filter(r=>!(r.type===1&&!r.active)).length===0 && formMode==='none' ? (
              <Text style={cs.automationEmpty}>Henüz kural yok.</Text>
            ) : (
              rules.filter(r=>!(r.type===1&&!r.active)).map((rule) => (
                <View key={rule.id} style={cs.ruleRow}>
                  <View style={[cs.ruleDot,{backgroundColor:rule.active?Colors.cyan:Colors.text3}]} />
                  <View style={{flex:1}}>
                    <Text style={[cs.ruleDesc,!rule.active&&{color:Colors.text3}]}>{ruleDescription(rule)}</Text>
                    <View style={{flexDirection:'row',gap:Spacing.sm,marginTop:2}}>
                      <View style={cs.ruleTag}><Text style={cs.ruleTagText}>{rule.type===0?'GÜNLİK':'TEK'}</Text></View>
                      <View style={[cs.ruleTag,{backgroundColor:rule.action===1?Colors.cyanAlpha:Colors.redAlpha}]}>
                        <Text style={[cs.ruleTagText,{color:rule.action===1?Colors.cyan:Colors.red}]}>{rule.action===1?'AÇ':'KAPAT'}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={()=>handleToggleRule(rule)} style={cs.ruleBtn}>
                    <Text style={[cs.ruleBtnText,{color:rule.active?Colors.cyan:Colors.text3}]}>{rule.active?'AKT':'PAS'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>handleDeleteRule(rule)} style={cs.ruleBtn}>
                    <Text style={[cs.ruleBtnText,{color:Colors.red}]}>SİL</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {formMode==='none' && (
              <View style={cs.addRuleRow}>
                <TouchableOpacity onPress={()=>setFormMode('daily')} activeOpacity={0.75} style={cs.addRuleBtn}><Text style={cs.addRuleBtnText}>+ Günlük</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>setFormMode('countdown')} activeOpacity={0.75} style={cs.addRuleBtn}><Text style={cs.addRuleBtnText}>+ Geri Sayım</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Otomasyon Modal */}
      <Modal visible={formMode!=='none'} transparent animationType="slide" onRequestClose={()=>setFormMode('none')}>
        <View style={cs.modalOverlay}>
          <TouchableOpacity style={cs.modalBackdrop} onPress={()=>setFormMode('none')} activeOpacity={1} />
          <View style={cs.modalCard}>
            <Text style={cs.ruleFormTitle}>{formMode==='daily'?'// GÜNLİK ZAMANLAYICI':'// GERİ SAYIM'}</Text>
            <View style={cs.timePickerRow}>
              <NumberPicker label="SAAT" value={formMode==='daily'?dailyHour:cdHour} min={0} max={23} onChange={formMode==='daily'?setDailyHour:setCdHour} />
              <Text style={cs.timeSep}>:</Text>
              <NumberPicker label="DAKİKA" value={formMode==='daily'?dailyMinute:cdMinute} min={0} max={59} onChange={formMode==='daily'?setDailyMinute:setCdMinute} />
            </View>
            <View style={cs.actionRow}>
              <TouchableOpacity onPress={()=>formMode==='daily'?setDailyAction(1):setCdAction(1)} activeOpacity={0.75}
                style={[cs.actionChoice,(formMode==='daily'?dailyAction:cdAction)===1&&cs.actionChoiceOn]}>
                <Text style={[cs.actionChoiceText,(formMode==='daily'?dailyAction:cdAction)===1&&{color:Colors.cyan}]}>AÇ</Text>
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
                <Text style={cs.saveRuleBtnText}>{savingRule?'KAYDEDİLİYOR...':'[ KAYDET ]'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setFormMode('none')} style={cs.cancelRuleBtn}>
                <Text style={cs.cancelRuleBtnText}>İPTAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Ana ControlScreen ─────────────────────────────────────────────────────────
export default function ControlScreen({ device, onOpenList, onAddDevice }: Props) {
  const [currentPin, setCurrentPin]   = useState(device.pin ?? '');
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [pinScreenMode, setPinScreenMode] = useState<'enter'|'setup'>('enter');
  const [pinError, setPinError]           = useState<string | null>(null);
  const [pinLoading, setPinLoading]       = useState(false);
  const [presets, setPresets]             = useState<Preset[]>([]);

  // Her kanal için bağımsız state
  const safeChannels = device.channels ?? [{ id: 0, name: 'Şerit', capabilities: device.capabilities ?? ['on_off','brightness','color','effects'], leds: device.leds }];

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

  const { status: connStatus, latency } = useConnectionStatus(device.ip);
  const prevStatus = useRef<string>('checking');
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prevStatus.current !== 'online' && connStatus === 'online') syncAllChannels();
    prevStatus.current = connStatus;
  }, [connStatus]);

  useEffect(() => {
    loadPresets();
    requestNotificationPermission();
    syncAllChannels();
  }, [device.id]);

  // Arkaplan hafif renk değişimi
  useEffect(() => {
    const anyOn = channelStates.some((s) => s.isOn);
    Animated.timing(bgAnim, { toValue: anyOn?1:0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [channelStates]);

  const syncAllChannels = async () => {
    // /whoami — parts ve partMaterials güncel mi kontrol et
    try {
      const whoamiRes = await fetch(`http://${device.ip}/whoami`);
      if (whoamiRes.ok) {
        const data = await whoamiRes.json();
        const parts: string[]    = Array.isArray(data.parts) ? data.parts : device.parts ?? [];
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

        // AsyncStorage'ı güncelle
        await saveDeviceMeta(device.id, parts, partMaterials, data.channels);

        // Eğer parts değiştiyse log
        const oldParts = (device.parts ?? []).join(',');
        const newParts = parts.join(',');
        if (oldParts !== newParts) {
          console.log(`📦 Parts güncellendi: ${oldParts} → ${newParts}`);
        }
      }
    } catch (e) {
      console.log('whoami sync atlandı:', e);
    }

    // LED state sync
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
            activeEffect: data.effect === 'off' ? null : data.effect,
          };
          return next;
        });
      }
    }
  };

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
    } else if (res.error?.type === 'unauthorized') { setPinError('PIN hatalı.'); }
    else { setPinError('Bağlantı hatası.'); }
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenList} style={styles.deviceNameBtn}>
          <Text style={styles.deviceNameLabel}>AKTİF CİHAZ</Text>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name} ›</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={[styles.connDot,{backgroundColor:connDotColor}]} />
          {connStatus==='online'&&latency!==null&&<Text style={styles.latencyText}>{latency}ms</Text>}
          {connStatus==='offline'&&<Text style={styles.offlineText}>OFFLINE</Text>}
          {currentPin!==''&&<Text style={styles.pinIcon}>🔒</Text>}
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
        <Text style={[styles.ipValue,{color:device.type==='ws2812b'?Colors.purple:device.type==='single_led'?Colors.amber:Colors.text3}]}>
          {device.type==='ws2812b'?`${safeChannels.length} KANAL`:device.type==='single_led'?'TEK LED':device.type==='relay'?'RÖLE':'?'}
        </Text>
      </View>

      {/* Kanal listesi */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {}} scrollEventThrottle={16}
      >
        {/* ── Model Kartı — tüm cihaz için tek model ── */}
        <View style={styles.modelCard}>

          {/* 3D Model — tıklanabilir, döndürülebilir */}
          <TouchableOpacity
            onPress={() => {
              // Tek kanallı: direkt toggle
              // Çok kanallı: tüm kanalları toggle
              if (!isMultiChannel) {
                const anyOn = channelStates.some((s) => s.isOn);
                safeChannels.forEach((_, i) => {
                  const api_i = createAPI(device.ip, currentPin, () => {
                    setPinScreenMode('enter'); setShowPinScreen(true);
                  });
                  api_i.get(anyOn ? '/led/off' : '/led/on', undefined, i);
                  updateChannelState(i, { isOn: !anyOn });
                });
              }
            }}
            activeOpacity={0.9}
            style={styles.modelViewerWrap}
          >
            <Model3DViewer
              parts={device.parts ?? []}
              partMaterials={device.partMaterials ?? {}}
              isOn={channelStates.some((s) => s.isOn)}
              lightColor={
                channelStates.find((s) => s.isOn)?.color ?? { r: 255, g: 255, b: 255 }
              }
              width={SCREEN_W - Spacing.xl * 2}
              height={Math.round((SCREEN_W - Spacing.xl * 2) * 1.1)}
            />

            {/* Sağ üst — durum badge */}
            <View style={styles.modelStatusBadge} pointerEvents="none">
              <View style={[styles.modelStatusDot, {
                backgroundColor: channelStates.some((s) => s.isOn)
                  ? `rgb(${(channelStates.find((s)=>s.isOn)?.color.r??255)},${(channelStates.find((s)=>s.isOn)?.color.g??255)},${(channelStates.find((s)=>s.isOn)?.color.b??255)})`
                  : Colors.border2,
              }]} />
              <Text style={[styles.modelStatusText, {
                color: channelStates.some((s) => s.isOn) ? Colors.cyan : Colors.text3,
              }]}>
                {channelStates.some((s) => s.isOn) ? 'AÇIK' : 'KAPALI'}
              </Text>
            </View>

            {/* Alt ipucu */}
            <View style={styles.modelHint} pointerEvents="none">
              <Text style={styles.modelHintText}>
                {isMultiChannel ? 'sürükle · döndür' : 'bas · aç/kapat  ·  sürükle · döndür'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* ── Kanal butonları — ince çizgi ile ayrılmış ── */}
          <View style={styles.modelDivider} />

          <View style={[
            styles.channelButtonsRow,
            isMultiChannel && styles.channelButtonsRowMulti,
          ]}>
            {safeChannels.map((channel, index) => {
              const s        = channelStates[index];
              const colorRgb = `rgb(${s.color.r},${s.color.g},${s.color.b})`;
              const isOn     = s.isOn;

              return (
                <TouchableOpacity
                  key={channel.id}
                  onPress={async () => {
                    const res = await api.get(isOn ? '/led/off' : '/led/on', undefined, index);
                    if (res.ok) updateChannelState(index, { isOn: !isOn, activeEffect: isOn ? null : s.activeEffect });
                  }}
                  activeOpacity={0.75}
                  style={[
                    styles.channelPowerBtn,
                    isMultiChannel && styles.channelPowerBtnMulti,
                    isOn && { borderColor: colorRgb },
                  ]}
                >
                  {/* Power ikonı */}
                  <View style={[styles.powerIcon, isOn && {
                    borderColor: colorRgb,
                    shadowColor: colorRgb,
                    shadowOpacity: 0.8,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                  }]}>
                    <View style={[styles.powerDot, {
                      backgroundColor: isOn ? colorRgb : Colors.border2,
                      shadowColor: isOn ? colorRgb : 'transparent',
                      shadowOpacity: isOn ? 1 : 0,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 0 },
                    }]} />
                  </View>

                  {/* Kanal adı + durum */}
                  <View style={styles.powerBtnText}>
                    {isMultiChannel && (
                      <Text style={[styles.powerBtnChannel, isOn && { color: colorRgb }]}>
                        {channel.name.toUpperCase()}
                      </Text>
                    )}
                    <Text style={[styles.powerBtnState, isOn && { color: colorRgb }]}>
                      {isOn
                        ? s.activeEffect ? s.activeEffect.toUpperCase() : 'AÇIK'
                        : 'KAPALI'}
                    </Text>
                  </View>

                  {/* Sağda renk dot */}
                  {isOn && (
                    <View style={[styles.powerBtnColorDot, {
                      backgroundColor: colorRgb,
                      shadowColor: colorRgb,
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 0 },
                    }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Kanal kontrolleri (parlaklık, renk, sahneler, otomasyon) ── */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
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

  // ── Model kartı ──────────────────────────────────────────────────────────
  modelCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  modelViewerWrap: {
    position: 'relative',
  },
  modelStatusBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(7,11,20,0.75)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  modelStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  modelStatusText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
  },
  modelHint: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modelHintText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: Colors.border2,
  },
  modelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Kanal butonları ───────────────────────────────────────────────────────
  channelButtonsRow: {
    flexDirection: 'row',
  },
  channelButtonsRowMulti: {
    // Çok kanallı: her buton eşit genişlik
  },
  channelPowerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  channelPowerBtnMulti: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  // Power icon — halka + merkez dot
  powerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  powerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  powerBtnText: {
    flex: 1,
    gap: 2,
  },
  powerBtnChannel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 3,
    color: Colors.text3,
  },
  powerBtnState: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.text2,
  },
  powerBtnColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});

// ── ChannelControl styles ─────────────────────────────────────────────────────
const cs = StyleSheet.create({
  channelWrap: { gap: Spacing.md, marginBottom: Spacing.md },
  errorBanner: { marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.redAlpha, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm },
  errorBannerText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.red },
  // Model 3D
  modelWrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  modelStateRow: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(7,11,20,0.7)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modelStateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    elevation: 2,
  },
  modelStateText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
  },
  modelTapHint: {
    position: 'absolute',
    bottom: Spacing.sm,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modelTapHintText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: Colors.border2,
  },
  // Progress bar
  progressTrack: { height: 1, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  // Slider
  sliderSection: { gap: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  sliderValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  slider: { width: '100%', height: 28, marginVertical: 2 },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderTick: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  // Accordion
  accordion: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  accordionLeft: { flex: 1, gap: 2 },
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
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: Colors.bg2, borderTopWidth: 1, borderTopColor: Colors.border, borderTopLeftRadius: Radius.md*2, borderTopRightRadius: Radius.md*2, padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xl+20 },
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
});