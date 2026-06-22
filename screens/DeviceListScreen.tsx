/**
 * screens/DeviceListScreen.tsx
 * Kayıtlı ESP32 cihazlarını listeleyen ekran.
 *
 * Her cihaz satırında:
 *   - Cihaza bağlan
 *   - Yeniden adlandır
 *   - Uygulamadan sil
 *   - Fabrika sıfırla
 *   - Firmware güncelle (OTA)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '../i18n/translations';
import {
  getDevices,
  removeDevice,
  renameDevice,
} from '../services/deviceStorage';
import { cancelAllNotifications } from '../services/notificationService';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = {
  activeDeviceId: string;
  onSelect:  (device: Device) => void;
  onAddNew:  () => void;
  onSetup:   () => void;
  onBack:    () => void;
  onStart:   () => void;
  onLegal:   () => void;
};

type OTAStatus = 'idle' | 'checking' | 'available' | 'updating' | 'up_to_date' | 'error';

type OTAState = {
  status:      OTAStatus;
  current?:    string;
  latest?:     string;
  notes?:      string;
  errorMsg?:   string;
};

export default function DeviceListScreen({
  activeDeviceId,
  onSelect,
  onAddNew,
  onSetup,
  onBack,
  onStart,
  onLegal,
}: Props) {
  const { t, language, setLanguage } = useLanguage();
  const [devices, setDevices]           = useState<Device[]>([]);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingName, setEditingName]   = useState('');
  const [resetting, setResetting]       = useState<string | null>(null);
  // Her cihaz için OTA state — key: device.id
  const [otaStates, setOtaStates]       = useState<Record<string, OTAState>>({});

  useEffect(() => { loadDevices(); }, []);

  const loadDevices = async () => setDevices(await getDevices());

  const setOtaState = (deviceId: string, state: Partial<OTAState>) => {
    setOtaStates((prev) => ({
      ...prev,
      [deviceId]: { ...(prev[deviceId] ?? { status: 'idle' }), ...state },
    }));
  };

  // ── Sil ────────────────────────────────────────────────────────────────────
  const handleDelete = (device: Device) => {
    Alert.alert(
      t('deviceList.removeTitle'),
      `"${device.name}" ${t('deviceList.removeDesc')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deviceList.removeButton'), style: 'destructive',
          onPress: async () => {
            await removeDevice(device.id);
            await AsyncStorage.removeItem('torva_setup_done');
            const remaining = await getDevices();
            if (remaining.length === 0) onStart();
            else { await loadDevices(); if (device.id === activeDeviceId) onBack(); }
          },
        },
      ]
    );
  };

  // ── Yeniden adlandır ───────────────────────────────────────────────────────
  const startEdit = (device: Device) => { setEditingId(device.id); setEditingName(device.name); };
  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await renameDevice(editingId, editingName.trim());
    setEditingId(null);
    await loadDevices();
  };

  // ── Fabrika sıfırlama ──────────────────────────────────────────────────────
  const handleFactoryReset = (device: Device) => {
    Alert.alert(
      t('deviceList.factoryResetTitle'),
      `"${device.name}" ${t('deviceList.factoryResetDesc')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('deviceList.factoryResetButton'), style: 'destructive', onPress: () => confirmFactoryReset(device) },
      ]
    );
  };

  const confirmFactoryReset = async (device: Device) => {
    setResetting(device.id);
    try {
      const pin = device.pin ? `?pin=${device.pin}` : '';
      const res = await fetch(`http://${device.ip}/factory-reset${pin}`);
      if (res.ok) {
        await removeDevice(device.id);
        await AsyncStorage.removeItem('torva_setup_done');
        // ESP32 otomasyon kuralları silindi — telefondaki bildirimleri de iptal et
        await cancelAllNotifications();
        const remaining = await getDevices();
        Alert.alert(
          t('deviceList.resetDoneTitle'),
          `"${device.name}" ${t('deviceList.resetDoneDesc')}`,
          [{ text: t('common.ok'), onPress: () => { if (remaining.length === 0) onStart(); else if (device.id === activeDeviceId) onBack(); else loadDevices(); } }]
        );
      } else { throw new Error(t('deviceList.serverError')); }
    } catch {
      Alert.alert(
        t('deviceList.unreachableTitle'),
        `"${device.name}" ${t('deviceList.unreachableDesc')}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('deviceList.removeOnlyButton'), style: 'destructive',
            onPress: async () => {
              await removeDevice(device.id);
              await AsyncStorage.removeItem('torva_setup_done');
              // ESP32'ye ulaşılamadı ama telefon bildirimlerini temizle
              await cancelAllNotifications();
              const remaining = await getDevices();
              if (remaining.length === 0) onStart();
              else if (device.id === activeDeviceId) onBack();
              else loadDevices();
            },
          },
        ]
      );
    }
    setResetting(null);
  };

  // ── OTA: Güncelleme kontrol ────────────────────────────────────────────────
  const handleOtaCheck = async (device: Device) => {
    setOtaState(device.id, { status: 'checking' });
    try {
      const pin = device.pin ? `?pin=${device.pin}` : '';
      const res  = await fetch(`http://${device.ip}/ota/check${pin}`);

      if (!res.ok) {
        setOtaState(device.id, { status: 'error', errorMsg: `HTTP ${res.status}` });
        return;
      }

      const data = await res.json();

      if (data.available) {
        setOtaState(device.id, {
          status:  'available',
          current: data.current,
          latest:  data.latest,
          notes:   data.notes,
        });
      } else {
        setOtaState(device.id, {
          status:  'up_to_date',
          current: data.current,
          latest:  data.latest,
        });
      }
    } catch {
      setOtaState(device.id, { status: 'error', errorMsg: t('deviceList.otaUnreachable') });
    }
  };

  // ── OTA: Güncelleme uygula ─────────────────────────────────────────────────
  const handleOtaUpdate = (device: Device) => {
    const ota = otaStates[device.id];
    Alert.alert(
      t('deviceList.otaUpdateTitle'),
      `"${device.name}" ${t('deviceList.otaUpdateDesc')}` +
      `${t('deviceList.currentVersionLabel')}: ${ota?.current ?? '?'}\n${t('deviceList.otaNewVersionLabel')}: ${ota?.latest ?? '?'}\n\n` +
      (ota?.notes ? `${ota.notes}\n\n` : '') +
      t('deviceList.otaUpdateDuration'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('deviceList.otaUpdateButton'), onPress: () => applyOtaUpdate(device) },
      ]
    );
  };

  const applyOtaUpdate = async (device: Device) => {
    setOtaState(device.id, { status: 'updating' });
    try {
      const pin = device.pin ? `?pin=${device.pin}` : '';
      await fetch(`http://${device.ip}/ota/update${pin}`);

      // ESP32 güncelleme sırasında yanıt vermez — 60 saniye bekle sonra kontrol et
      Alert.alert(
        t('deviceList.otaStartedTitle'),
        t('deviceList.otaStartedDesc'),
        [{
          text: t('common.ok'),
          onPress: () => setOtaState(device.id, { status: 'idle' }),
        }]
      );
    } catch {
      setOtaState(device.id, { status: 'error', errorMsg: t('deviceList.otaStartFailed') });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Device }) => {
    const isActive    = item.id === activeDeviceId;
    const isEditing   = item.id === editingId;
    const isResetting = item.id === resetting;
    const ota         = otaStates[item.id] ?? { status: 'idle' };

    return (
      <View style={[styles.itemWrap, isActive && styles.itemWrapActive]}>

        {/* ── Cihaz satırı ── */}
        <View style={styles.row}>
          <View style={[styles.rowDot, { backgroundColor: isActive ? Colors.cyan : Colors.border2 }]} />

          <View style={styles.rowCenter}>
            {isEditing ? (
              <TextInput
                value={editingName}
                onChangeText={setEditingName}
                onSubmitEditing={confirmRename}
                autoFocus
                style={styles.renameInput}
                placeholderTextColor={Colors.text3}
              />
            ) : (
              <TouchableOpacity onPress={() => !isActive && onSelect(item)}>
                <Text style={[styles.rowName, isActive && { color: Colors.cyan }]}>{item.name}</Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowIp}>{item.ip}</Text>
                  {item.pin !== '' && <Text style={styles.rowPin}>🔒</Text>}
                  <Text style={[styles.rowType, {
                    color: item.type === 'ws2812b' ? Colors.purple :
                           item.type === 'single_led' ? Colors.amber : Colors.text3,
                  }]}>
                    {item.type === 'ws2812b' ? 'RGB' :
                     item.type === 'single_led' ? 'LED' :
                     item.type === 'relay' ? t('deviceList.relayType') : '?'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Eylemler */}
          <View style={styles.rowActions}>
            {isEditing ? (
              <TouchableOpacity onPress={confirmRename} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: Colors.cyan }]}>{t('deviceList.saveButton')}</Text>
              </TouchableOpacity>
            ) : isResetting ? (
              <Text style={[styles.actionText, { color: Colors.amber }]}>{t('deviceList.resettingLabel')}</Text>
            ) : (
              <>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{t('deviceList.editButton')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: Colors.red }]}>{t('deviceList.removeShortButton')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleFactoryReset(item)}
                  style={[styles.actionBtn, styles.resetBtn]}
                >
                  <Text style={[styles.actionText, { color: Colors.amber }]}>{t('deviceList.resetShortButton')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── OTA bölümü ── */}
        <View style={styles.otaRow}>

          {/* Kontrol butonu */}
          {(ota.status === 'idle' || ota.status === 'error' || ota.status === 'up_to_date') && (
            <TouchableOpacity
              onPress={() => handleOtaCheck(item)}
              style={styles.otaCheckBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.otaCheckBtnText}>
                {ota.status === 'up_to_date' ? t('deviceList.otaUpToDate') : t('deviceList.otaCheckButton')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Kontrol ediliyor */}
          {ota.status === 'checking' && (
            <Text style={styles.otaStatusText}>{t('deviceList.otaChecking')}</Text>
          )}

          {/* Güncelleniyor */}
          {ota.status === 'updating' && (
            <Text style={[styles.otaStatusText, { color: Colors.amber }]}>
              {t('deviceList.otaUpdating')}
            </Text>
          )}

          {/* Hata */}
          {ota.status === 'error' && (
            <Text style={[styles.otaStatusText, { color: Colors.red }]}>
              ⚠ {ota.errorMsg ?? t('deviceList.otaConnectionError')}
            </Text>
          )}

          {/* Güncelleme mevcut */}
          {ota.status === 'available' && (
            <View style={styles.otaUpdateRow}>
              <View style={styles.otaUpdateInfo}>
                <Text style={styles.otaUpdateLabel}>{t('deviceList.otaNewVersionLabel')}</Text>
                <Text style={styles.otaUpdateVersions}>
                  {ota.current} → <Text style={{ color: Colors.cyan }}>{ota.latest}</Text>
                </Text>
                {ota.notes ? (
                  <Text style={styles.otaUpdateNotes}>{ota.notes}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => handleOtaUpdate(item)}
                style={styles.otaUpdateBtn}
                activeOpacity={0.75}
              >
                <Text style={styles.otaUpdateBtnText}>{t('deviceList.otaUpdateNowButton')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Güncel */}
          {ota.status === 'up_to_date' && (
            <Text style={[styles.otaStatusText, { color: Colors.green }]}>
              ✓ {ota.current} — {t('deviceList.otaUpToDateLabel')}
            </Text>
          )}

        </View>

      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={styles.headerBrand}>{t('deviceList.headerBrand')}</Text>
        <TouchableOpacity
          onPress={() => Alert.alert(
            t('deviceList.addDeviceTitle'),
            t('deviceList.addPrompt'),
            [
              {
                text: t('deviceList.newSetup'),
                onPress: onSetup,
              },
              {
                text: t('deviceList.scanNetwork'),
                onPress: onAddNew,
              },
              { text: t('common.cancel'), style: 'cancel' },
            ]
          )}
          style={styles.addBtn}
        >
          <Text style={styles.addText}>{t('deviceList.addButton')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      {/* Başlık */}
      <View style={styles.titleBlock}>
        <Text style={styles.titleEyebrow}>{t('deviceList.title')}</Text>
        <Text style={styles.titleMain}>{devices.length} {t('deviceList.count')}</Text>
        <Text style={styles.titleDesc}>
          {t('deviceList.hint')}
        </Text>
      </View>

      {/* Dil seçimi */}
      <TouchableOpacity
        onPress={() => setShowLanguagePicker(true)}
        style={styles.langRow}
        activeOpacity={0.75}
      >
        <Text style={styles.langLabel}>{t('settings.language')}</Text>
        <View style={styles.langValue}>
          <Text style={styles.langFlag}>{LANGUAGE_META[language].flag}</Text>
          <Text style={styles.langValueText}>{LANGUAGE_META[language].label}</Text>
          <Text style={styles.chevronRight}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Dil seçim modalı */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity
          style={styles.langModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={styles.langModalCard}>
            <Text style={styles.langModalTitle}>{t('settings.selectLanguage')}</Text>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={async () => {
                  await setLanguage(lang);
                  setShowLanguagePicker(false);
                }}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                activeOpacity={0.75}
              >
                <Text style={styles.langFlag}>{LANGUAGE_META[lang].flag}</Text>
                <Text style={[styles.langOptionText, language === lang && styles.langOptionTextActive]}>
                  {LANGUAGE_META[lang].label}
                </Text>
                {language === lang && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Yasal / Legal butonu */}
      <TouchableOpacity
        onPress={onLegal}
        style={styles.langRow}
        activeOpacity={0.75}
      >
        <Text style={styles.langLabel}>{t('legal.title').toUpperCase()}</Text>
        <View style={styles.langValue}>
          <Text style={styles.langValueText}>
            {t('legal.privacy')} · {t('legal.terms')}
          </Text>
          <Text style={styles.chevronRight}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Liste */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('deviceList.emptyTitle')}</Text>
            <Text style={styles.emptySubText}>{t('deviceList.emptyDesc')}</Text>
          </View>
        }
      />

      {/* Fiziksel reset notu */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t('deviceList.physicalResetTitle')}</Text>
        <Text style={styles.infoText}>
          {t('deviceList.physicalResetDesc')}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>{t('deviceList.footerBrand')}</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.lg },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  addBtn: { minWidth: 60, alignItems: 'flex-end' },
  addText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },
  titleBlock: { gap: Spacing.xs, marginTop: Spacing.xl, marginBottom: Spacing.lg },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: { fontFamily: Fonts.sans, fontSize: 28, color: Colors.text, fontWeight: '300' },
  titleDesc: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3, lineHeight: 16 },
  // Dil seçimi
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
  },
  langLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  langValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  langFlag: { fontSize: 16 },
  langValueText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text },
  chevronRight: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text3 },
  langModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  langModalCard: {
    width: '80%',
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  langModalTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3, marginBottom: Spacing.sm },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langOptionActive: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  langOptionText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: Colors.text2 },
  langOptionTextActive: { color: Colors.cyan },
  langCheck: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.cyan },
  listContent: { paddingBottom: Spacing.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border3 },

  // Cihaz kartı
  itemWrap: { paddingVertical: Spacing.md, gap: Spacing.sm },
  itemWrapActive: { backgroundColor: Colors.cyanAlpha, marginHorizontal: -Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },

  // Cihaz satırı
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  rowCenter: { flex: 1, gap: 2 },
  rowName: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text, fontWeight: '400' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowIp: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  rowPin: { fontSize: 10 },
  rowType: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2 },
  rowActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  actionBtn: { paddingVertical: Spacing.xs, paddingHorizontal: 2 },
  actionText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text2 },
  resetBtn: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border, paddingLeft: Spacing.sm, marginLeft: 2 },
  renameInput: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text, borderBottomWidth: 1, borderBottomColor: Colors.cyan2, paddingVertical: 2, letterSpacing: 1 },

  // OTA bölümü
  otaRow: { paddingLeft: 6 + Spacing.md, gap: Spacing.xs },
  otaCheckBtn: { alignSelf: 'flex-start' },
  otaCheckBtnText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text3 },
  otaStatusText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  otaUpdateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  otaUpdateInfo: { flex: 1, gap: 2 },
  otaUpdateLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.cyan },
  otaUpdateVersions: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1, color: Colors.text },
  otaUpdateNotes: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.text3, lineHeight: 16 },
  otaUpdateBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha },
  otaUpdateBtnText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan },

  // Bilgi notu
  emptyBox: { marginTop: Spacing.xl * 2, alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text2 },
  emptySubText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text3, textAlign: 'center' },
  infoBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  infoTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text, fontWeight: '500' },
  infoText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});