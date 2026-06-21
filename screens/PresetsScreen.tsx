/**
 * screens/PresetsScreen.tsx
 * Sahne / preset yönetim ekranı.
 *
 * - Statik ve efekt presetleri ayrı bölümlerde
 * - Efekt presetleri için renk + hız ayarı inline açılır (accordion)
 * - Yeni statik preset: mevcut renk + parlaklıktan kaydet
 * - Kullanıcı presetleri uzun basınca silinir
 * - Aktif preset vurgulanır
 */

import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import {
  DEFAULT_IDS,
  EffectType,
  Preset,
  addPreset,
  applyPreset,
  deletePreset,
  getEffectMeta, getPresetDisplayName,
  getPresets,
} from '../services/presetStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = { device: Device; onBack: () => void };

// Hız değerini etiket'e çevir
function speedLabel(speed: number, t: (key: TranslationKey) => string): string {
  if (speed < 80)  return t('control.speedVerySlow');
  if (speed < 130) return t('control.speedSlow');
  if (speed < 180) return 'Normal';
  if (speed < 220) return t('control.speedFast');
  return t('control.speedVeryFast');
}

export default function PresetsScreen({ device, onBack }: Props) {
  const { t } = useLanguage();
  const [presets, setPresets]         = useState<Preset[]>([]);
  const [applying, setApplying]       = useState<string | null>(null);
  const [activeId, setActiveId]       = useState<string | null>(null);
  // Hangi efekt presetinin ayar paneli açık
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  // Efekt ayarları geçici state (kaydetmeden önce)
  const [editSpeed, setEditSpeed]     = useState(128);
  const [editR, setEditR]             = useState(0);
  const [editG, setEditG]             = useState(150);
  const [editB, setEditB]             = useState(255);

  // Yeni preset formu
  const [showForm, setShowForm]       = useState(false);
  const [newName, setNewName]         = useState('');
  const [newIcon, setNewIcon]         = useState('✨');

  const loadPresets = useCallback(async () => {
    setPresets(await getPresets());
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  // Preset uygula
  const handleApply = async (preset: Preset, overrides?: Partial<Preset>) => {
    const merged = { ...preset, ...overrides };
    setApplying(preset.id);
    try {
      await applyPreset(device.ip, merged);
      setActiveId(preset.id);
    } catch {
      Alert.alert('Hata', 'Preset uygulanamadı. Cihaz bağlantısını kontrol et.');
    }
    setApplying(null);
  };

  // Efekt panelini aç/kapat
  const toggleExpand = (preset: Preset) => {
    if (expandedId === preset.id) {
      setExpandedId(null);
    } else {
      setExpandedId(preset.id);
      setEditSpeed(preset.effectSpeed ?? 128);
      setEditR(preset.effectR ?? 0);
      setEditG(preset.effectG ?? 150);
      setEditB(preset.effectB ?? 255);
    }
  };

  // Kullanıcı preseti sil
  const handleDelete = (preset: Preset) => {
    Alert.alert(t('control.deletePresetTitle'), `"${getPresetDisplayName(preset, t)}"${t('control.deleteRuleConfirm')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await deletePreset(preset.id);
        await loadPresets();
        if (activeId === preset.id) setActiveId(null);
      }},
    ]);
  };

  // Yeni preset kaydet
  const handleSaveNew = async () => {
    if (!newName.trim()) return;
    await addPreset({
      id:         `u_${Date.now()}`,
      name:       newName.trim(),
      icon:       newIcon,
      type:       'static',
      r:          device.color?.r ?? 255,
      g:          device.color?.g ?? 255,
      b:          device.color?.b ?? 255,
      brightness: device.brightness ?? 255,
    });
    await loadPresets();
    setShowForm(false);
    setNewName('');
    setNewIcon('✨');
  };

  // Gruplar
  const staticPresets = presets.filter((p) => p.type === 'static');
  const effectPresets = presets.filter((p) => p.type === 'effect');
  const userPresets   = presets.filter((p) => p.type === 'static' && !DEFAULT_IDS.has(p.id));

  // ── Statik preset kartı ──────────────────────────────────────────────────
  const renderStatic = (preset: Preset) => {
    const isActive   = activeId  === preset.id;
    const isApplying = applying  === preset.id;
    const deletable  = !DEFAULT_IDS.has(preset.id);
    const rgb        = `rgb(${preset.r},${preset.g},${preset.b})`;

    return (
      <TouchableOpacity
        key={preset.id}
        onPress={() => handleApply(preset)}
        onLongPress={() => deletable && handleDelete(preset)}
        activeOpacity={0.75}
        style={[styles.staticCard, isActive && styles.cardActive]}
      >
        <Text style={styles.cardIcon}>{preset.icon}</Text>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, isActive && { color: Colors.cyan }]}>{getPresetDisplayName(preset, t)}</Text>
          <Text style={styles.cardDesc}>
            {Math.round((preset.brightness ?? 255) / 255 * 100)}% {t('presets.brightnessSuffix')}
          </Text>
        </View>
        <View style={[styles.colorSwatch, {
          backgroundColor: rgb,
          shadowColor: rgb,
          shadowOpacity: isActive ? 0.8 : 0.3,
          shadowRadius: isActive ? 8 : 3,
        }]} />
        {isApplying && <View style={styles.applyOverlay}><Text style={styles.applyDots}>···</Text></View>}
        {isActive   && <View style={styles.activeDot} />}
      </TouchableOpacity>
    );
  };

  // ── Efekt preset kartı — açılabilir panel ────────────────────────────────
  const renderEffect = (preset: Preset) => {
    const isActive   = activeId   === preset.id;
    const isApplying = applying   === preset.id;
    const isExpanded = expandedId === preset.id;
    const meta       = getEffectMeta(t)[preset.effect as EffectType];
    const editColor  = `rgb(${editR},${editG},${editB})`;

    return (
      <View key={preset.id} style={[styles.effectCard, isActive && styles.cardActive]}>

        {/* Kart başlığı */}
        <TouchableOpacity
          onPress={() => handleApply(preset)}
          onLongPress={() => toggleExpand(preset)}
          activeOpacity={0.75}
          style={styles.effectCardHeader}
        >
          <Text style={styles.cardIcon}>{preset.icon}</Text>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, isActive && { color: Colors.cyan }]}>{getPresetDisplayName(preset, t)}</Text>
            <Text style={styles.cardDesc}>{meta?.desc ?? preset.effect}</Text>
          </View>
          <View style={styles.effectRight}>
            {/* Hız göstergesi */}
            <Text style={styles.speedLabel}>{speedLabel(preset.effectSpeed ?? 128, t)}</Text>
            {/* Renk noktası (renk gerektiren efektler için) */}
            {meta?.hasColor && (
              <View style={[styles.effectColorDot, {
                backgroundColor: `rgb(${preset.effectR ?? 0},${preset.effectG ?? 150},${preset.effectB ?? 255})`,
              }]} />
            )}
            {/* Ayar oku */}
            <TouchableOpacity onPress={() => toggleExpand(preset)} style={styles.expandBtn}>
              <Text style={[styles.expandArrow, isExpanded && styles.expandArrowOpen]}>›</Text>
            </TouchableOpacity>
          </View>
          {isApplying && <View style={styles.applyOverlay}><Text style={styles.applyDots}>···</Text></View>}
          {isActive   && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* ── Açılır ayar paneli ── */}
        {isExpanded && (
          <View style={styles.effectPanel}>
            <View style={styles.effectPanelDivider} />

            {/* Hız slider */}
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>HIZ</Text>
              <Text style={[styles.panelVal, { color: Colors.cyan }]}>{speedLabel(editSpeed, t)}</Text>
            </View>
            <Slider
              style={styles.panelSlider}
              minimumValue={0} maximumValue={255} step={1}
              value={editSpeed}
              onValueChange={(v) => setEditSpeed(Math.round(v))}
              minimumTrackTintColor={Colors.cyan}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.cyan}
            />

            {/* Renk slider'ları — sadece renk gerektiren efektler için */}
            {meta?.hasColor && (
              <>
                <View style={styles.panelRow}>
                  <Text style={styles.panelLabel}>RENK</Text>
                  <View style={[styles.panelColorDot, { backgroundColor: editColor }]} />
                </View>

                {/* R */}
                <View style={styles.rgbRow}>
                  <Text style={styles.rgbLabel}>R</Text>
                  <Slider
                    style={styles.rgbSlider}
                    minimumValue={0} maximumValue={255} step={1}
                    value={editR}
                    onValueChange={(v) => setEditR(Math.round(v))}
                    minimumTrackTintColor={`rgb(${editR},0,0)`}
                    maximumTrackTintColor={Colors.border}
                    thumbTintColor={`rgb(${editR},0,0)`}
                  />
                  <Text style={styles.rgbVal}>{editR}</Text>
                </View>

                {/* G */}
                <View style={styles.rgbRow}>
                  <Text style={styles.rgbLabel}>G</Text>
                  <Slider
                    style={styles.rgbSlider}
                    minimumValue={0} maximumValue={255} step={1}
                    value={editG}
                    onValueChange={(v) => setEditG(Math.round(v))}
                    minimumTrackTintColor={`rgb(0,${editG},0)`}
                    maximumTrackTintColor={Colors.border}
                    thumbTintColor={`rgb(0,${editG},0)`}
                  />
                  <Text style={styles.rgbVal}>{editG}</Text>
                </View>

                {/* B */}
                <View style={styles.rgbRow}>
                  <Text style={styles.rgbLabel}>B</Text>
                  <Slider
                    style={styles.rgbSlider}
                    minimumValue={0} maximumValue={255} step={1}
                    value={editB}
                    onValueChange={(v) => setEditB(Math.round(v))}
                    minimumTrackTintColor={`rgb(0,0,${editB})`}
                    maximumTrackTintColor={Colors.border}
                    thumbTintColor={`rgb(0,0,${editB})`}
                  />
                  <Text style={styles.rgbVal}>{editB}</Text>
                </View>
              </>
            )}

            {/* Panel butonları */}
            <View style={styles.panelButtons}>
              {/* Uygula */}
              <TouchableOpacity
                onPress={() => handleApply(preset, {
                  effectSpeed: editSpeed,
                  effectR: editR, effectG: editG, effectB: editB,
                })}
                activeOpacity={0.75}
                style={styles.panelApplyBtn}
              >
                <Text style={styles.panelApplyText}>[ UYGULA ]</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={styles.headerBrand}>SAHNELER</Text>
        <TouchableOpacity onPress={() => setShowForm((p) => !p)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{showForm ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Başlık */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>// {device.name}</Text>
          <Text style={styles.titleMain}>Sahneler & Efektler</Text>
          <Text style={styles.titleDesc}>
            {t('presets.headerHint')}
          </Text>
        </View>

        {/* ── Yeni preset formu ── */}
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('presets.saveCurrentTitle')}</Text>
            <View style={styles.formPreview}>
              <View style={[styles.formPreviewDot, {
                backgroundColor: `rgb(${device.color?.r ?? 255},${device.color?.g ?? 255},${device.color?.b ?? 255})`,
              }]} />
              <View>
                <Text style={styles.formPreviewLabel}>{t('presets.toSaveLabel')}</Text>
                <Text style={styles.formPreviewValue}>
                  RGB {device.color?.r ?? 255}·{device.color?.g ?? 255}·{device.color?.b ?? 255}
                  {' · '}{Math.round((device.brightness ?? 255) / 255 * 100)}%
                </Text>
              </View>
            </View>

            <Text style={styles.formLabel}>{t('presets.iconLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
              {['✨','🌟','💫','🎨','🎭','🌿','❄️','🌸','🔮','⚡','🎪','🌺'].map((e) => (
                <TouchableOpacity key={e} onPress={() => setNewIcon(e)}
                  style={[styles.iconBtn, newIcon === e && styles.iconBtnSelected]}>
                  <Text style={styles.iconBtnText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.formLabel}>SAHNE ADI</Text>
            <TextInput
              value={newName} onChangeText={setNewName}
              placeholder={t('presets.namePlaceholder')}
              placeholderTextColor={Colors.text3}
              returnKeyType="done" onSubmitEditing={handleSaveNew}
              style={styles.formInput}
            />
            <TouchableOpacity onPress={handleSaveNew} disabled={!newName.trim()}
              activeOpacity={0.75}
              style={[styles.saveBtn, !newName.trim() && styles.saveBtnDisabled]}>
              <Text style={[styles.saveBtnText, !newName.trim() && { color: Colors.text3 }]}>
                [ KAYDET ]
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Statik sahneler ── */}
        <View style={styles.section}>
          <View style={styles.divRow}>
            <View style={styles.divLine} />
            <Text style={styles.divLabel}>{t('presets.staticScenesLabel')}</Text>
            <View style={styles.divLine} />
          </View>
          <View style={styles.staticGrid}>
            {staticPresets.map(renderStatic)}
          </View>
          {userPresets.length > 0 && (
            <Text style={styles.hintText}>{t('presets.longPressHint')}</Text>
          )}
        </View>

        {/* ── Efekt sahneleri ── */}
        <View style={styles.section}>
          <View style={styles.divRow}>
            <View style={styles.divLine} />
            <Text style={styles.divLabel}>{t('presets.dynamicEffectsLabel')}</Text>
            <View style={styles.divLine} />
          </View>
          <View style={styles.effectList}>
            {effectPresets.map(renderEffect)}
          </View>
        </View>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  addBtn: { minWidth: 60, alignItems: 'flex-end' },
  addBtnText: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.cyan },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.xl },

  titleBlock: { gap: Spacing.sm },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: { fontFamily: Fonts.sans, fontSize: 28, color: Colors.text, fontWeight: '300' },
  titleDesc: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.text2, lineHeight: 18 },

  // Yeni preset formu
  form: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.lg, gap: Spacing.lg },
  formTitle: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.cyan },
  formPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  formPreviewDot: { width: 40, height: 40, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border2 },
  formPreviewLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  formPreviewValue: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1, color: Colors.text },
  formLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3, marginBottom: -Spacing.sm },
  iconScroll: { flexGrow: 0 },
  iconBtn: { width: 44, height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  iconBtnSelected: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  iconBtnText: { fontSize: 22 },
  formInput: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 1, color: Colors.text },
  saveBtn: { height: 48, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg4 },
  saveBtnText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 2, color: Colors.cyan },

  // Bölüm
  section: { gap: Spacing.md },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  divLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },

  // Statik kartlar — 2 kolonlu grid
  staticGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  staticCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.md },
  cardActive: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  cardIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text, fontWeight: '400' },
  cardDesc: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, shadowOffset: { width: 0, height: 0 }, elevation: 3 },

  // Ortak kart elemanları
  applyOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: Radius.md, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  applyDots: { fontFamily: Fonts.mono, fontSize: 20, color: Colors.cyan, letterSpacing: 4 },
  activeDot: { position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.cyan },

  // Efekt kartları — tam genişlik
  effectList: { gap: Spacing.sm },
  effectCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, overflow: 'hidden' },
  effectCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  effectRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  speedLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1, color: Colors.text3 },
  effectColorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  expandBtn: { padding: 4 },
  expandArrow: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.text2, lineHeight: 22 },
  expandArrowOpen: { transform: [{ rotate: '90deg' }] },

  // Efekt ayar paneli
  effectPanel: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  effectPanelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.lg },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  panelLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  panelVal: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.text2 },
  panelSlider: { width: '100%', height: 28, marginBottom: Spacing.md },
  panelColorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  rgbRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  rgbLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text3, width: 16 },
  rgbSlider: { flex: 1, height: 28 },
  rgbVal: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text2, width: 28, textAlign: 'right' },
  panelButtons: { marginTop: Spacing.md },
  panelApplyBtn: { height: 44, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  panelApplyText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.cyan },

  hintText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text3, textAlign: 'center' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});