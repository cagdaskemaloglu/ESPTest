/**
 * screens/AutomationScreen.tsx
 * ESP32 automation kurallarını yönetir.
 *
 * Bildirim entegrasyonu:
 *   Kural eklenince → telefona scheduled notification planlanır
 *   Kural silinince → notification iptal edilir
 *   notificationId kuralın yanında state'te saklanır
 *
 * notificationId ESP32'de değil, sadece telefonda tutulur.
 * AutomationRule tipine notificationId eklendi.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { requestNotificationPermission } from '../services/notificationService';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = { device: Device; onBack: () => void };
type FormMode = 'none' | 'daily' | 'countdown';

// notificationId'yi yerel state'te tut
// ESP32'den gelen listede yok — sadece bu oturumda eklenenler için var
type LocalRule = AutomationRule & { notificationId?: string };

// ── NumberPicker bileşeni ─────────────────────────────────────────────────────
type NumberPickerProps = {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  onChange: (v: number) => void;
};

function NumberPicker({ label, value, min, max, onChange }: NumberPickerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const startRepeat = (delta: number) => {
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onChange(clamp(value + delta));
      }, 100);
    }, 400);
  };

  const stopRepeat = () => {
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <View style={ps.wrapper}>
      <Text style={ps.label}>{label}</Text>
      <View style={ps.row}>
        <TouchableOpacity
          onPress={() => onChange(clamp(value - 1))}
          onLongPress={() => startRepeat(-1)}
          onPressOut={stopRepeat}
          activeOpacity={0.7}
          style={ps.btn}
        >
          <Text style={ps.btnText}>−</Text>
        </TouchableOpacity>
        <View style={ps.display}>
          <Text style={ps.displayText}>{String(value).padStart(2, '0')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onChange(clamp(value + 1))}
          onLongPress={() => startRepeat(1)}
          onPressOut={stopRepeat}
          activeOpacity={0.7}
          style={ps.btn}
        >
          <Text style={ps.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.sm },
  label:   { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: {
    width: 44, height: 44, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg4,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText:     { fontFamily: Fonts.mono, fontSize: 20, color: Colors.cyan, lineHeight: 24 },
  display: {
    width: 72, height: 52, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.cyan2,
    backgroundColor: Colors.cyanAlpha,
    alignItems: 'center', justifyContent: 'center',
  },
  displayText: { fontFamily: Fonts.mono, fontSize: 28, color: Colors.cyan, letterSpacing: 2 },
});

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function AutomationScreen({ device, onBack }: Props) {
  const [rules, setRules]         = useState<LocalRule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [esp32Time, setEsp32Time] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formMode, setFormMode]   = useState<FormMode>('none');

  // Form state
  const [dailyHour,   setDailyHour]   = useState(22);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [dailyAction, setDailyAction] = useState<0 | 1>(0);
  const [cdHour,   setCdHour]         = useState(0);
  const [cdMinute, setCdMinute]       = useState(30);
  const [cdAction, setCdAction]       = useState<0 | 1>(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ruleList, time] = await Promise.all([
      listRules(device.ip),
      getESP32Time(device.ip),
    ]);
    // ESP32'den gelen kurallar — notificationId yok (telefon tarafında saklanmıyor)
    setRules(ruleList.map((r) => ({ ...r, notificationId: undefined })));

    if (time) {
      setEsp32Time(
        `${String(time.hour).padStart(2,'0')}:${String(time.minute).padStart(2,'0')}:${String(time.second).padStart(2,'0')}`
      );
    } else {
      setEsp32Time(null);
    }
    setLoading(false);
  }, [device.ip]);

  useEffect(() => {
    // Bildirim izni iste
    requestNotificationPermission();

    loadData();

    timerRef.current = setInterval(() => setRules((p) => [...p]), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadData]);

  // ── Kural ekle ─────────────────────────────────────────────────────────────
  const handleAddDaily = async () => {
    setSaving(true);
    const result = await addDailyRule(device.ip, {
      hour:       dailyHour,
      minute:     dailyMinute,
      action:     dailyAction,
      deviceName: device.name,
    });
    setSaving(false);

    if (result) {
      // Yeni kuralı notificationId ile birlikte listeye ekle
      setRules((prev) => [...prev, {
        id:              result.id,
        active:          true,
        type:            0,
        hour:            dailyHour,
        minute:          dailyMinute,
        action:          dailyAction,
        triggerAt:       0,
        triggered:       false,
        notificationId:  result.notificationId,
      }]);
      setFormMode('none');
    } else {
      Alert.alert('Hata', 'Kural eklenemedi. ESP32 bağlantısını kontrol et.');
    }
  };

  const handleAddCountdown = async () => {
    const totalSeconds = cdHour * 3600 + cdMinute * 60;
    if (totalSeconds === 0) { Alert.alert('Hata', 'Süre en az 1 dakika olmalı.'); return; }

    setSaving(true);
    const result = await addCountdownRule(device.ip, {
      countdown:  totalSeconds,
      action:     cdAction,
      deviceName: device.name,
    });
    setSaving(false);

    if (result) {
      const triggerAt = Math.floor(Date.now() / 1000) + totalSeconds;
      setRules((prev) => [...prev, {
        id:             result.id,
        active:         true,
        type:           1,
        hour:           0,
        minute:         0,
        action:         cdAction,
        triggerAt,
        triggered:      false,
        notificationId: result.notificationId,
      }]);
      setFormMode('none');
    } else {
      Alert.alert('Hata', 'Kural eklenemedi. ESP32 bağlantısını kontrol et.');
    }
  };

  // ── Kural sil ──────────────────────────────────────────────────────────────
  const handleDelete = (rule: LocalRule) => {
    Alert.alert(
      'Kuralı Sil',
      `"${ruleDescription(rule)}" silinsin mi?\n\nİlgili bildirim de iptal edilecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            // Notification ID'si ile birlikte sil
            await deleteRule(device.ip, rule.id, rule.notificationId);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
          },
        },
      ]
    );
  };

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const handleToggle = async (rule: LocalRule) => {
    const result = await toggleRule(device.ip, rule.id);
    if (result !== null) {
      setRules((prev) =>
        prev.map((r) => r.id === rule.id ? { ...r, active: result.active } : r)
      );
    }
  };

  // ── Aksiyon seçici ─────────────────────────────────────────────────────────
  const ActionPicker = ({ value, onChange }: { value: 0 | 1; onChange: (v: 0 | 1) => void }) => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        onPress={() => onChange(1)}
        style={[styles.actionChoice, value === 1 && styles.actionChoiceOn]}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionChoiceText, value === 1 && { color: Colors.cyan }]}>AÇ</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange(0)}
        style={[styles.actionChoice, value === 0 && styles.actionChoiceOff]}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionChoiceText, value === 0 && { color: Colors.red }]}>KAPAT</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← GERİ</Text>
        </TouchableOpacity>
        <Text style={styles.headerBrand}>OTOMASYON</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↺</Text>
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
          <Text style={styles.titleMain}>Zamanlayıcılar</Text>

          {/* ESP32 saati + bildirim bilgisi */}
          <View style={styles.infoRow}>
            <View style={styles.timeRow}>
              <View style={[styles.timeDot, {
                backgroundColor: esp32Time ? Colors.green : Colors.amber,
              }]} />
              {esp32Time
                ? <Text style={styles.timeText}>ESP32: {esp32Time}</Text>
                : <Text style={[styles.timeText, { color: Colors.amber }]}>NTP bekleniyor...</Text>
              }
            </View>
            <View style={styles.notifRow}>
              <Text style={styles.notifIcon}>🔔</Text>
              <Text style={styles.notifText}>Bildirimler aktif</Text>
            </View>
          </View>
        </View>

        {/* Kural listesi */}
        {loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Yükleniyor...</Text>
          </View>
        ) : rules.length === 0 && formMode === 'none' ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Henüz kural yok.</Text>
            <Text style={styles.emptySubText}>Aşağıdan zamanlayıcı ekleyebilirsin.</Text>
          </View>
        ) : (
          <View style={styles.ruleList}>
            {rules.map((item) => (
              <View key={item.id}>
                <View style={[styles.ruleRow, !item.active && styles.ruleRowInactive]}>
                  <View style={[styles.ruleDot, {
                    backgroundColor: item.active ? Colors.cyan : Colors.text3,
                  }]} />
                  <View style={styles.ruleCenter}>
                    <Text style={[styles.ruleDesc, !item.active && styles.ruleDescInactive]}>
                      {ruleDescription(item)}
                    </Text>
                    <View style={styles.ruleTagRow}>
                      <View style={styles.ruleTag}>
                        <Text style={styles.ruleTagText}>
                          {item.type === 0 ? 'GÜNLİK' : 'TEK SEFERLİK'}
                        </Text>
                      </View>
                      <View style={[styles.ruleTag, {
                        backgroundColor: item.action === 1 ? Colors.cyanAlpha : Colors.redAlpha,
                      }]}>
                        <Text style={[styles.ruleTagText, {
                          color: item.action === 1 ? Colors.cyan : Colors.red,
                        }]}>
                          {item.action === 1 ? 'AÇ' : 'KAPAT'}
                        </Text>
                      </View>
                      {/* Bildirim rozeti */}
                      {item.notificationId && (
                        <View style={styles.notifBadge}>
                          <Text style={styles.notifBadgeText}>🔔</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.ruleActions}>
                    <TouchableOpacity onPress={() => handleToggle(item)} style={styles.actionBtn}>
                      <Text style={[styles.actionText, {
                        color: item.active ? Colors.cyan : Colors.text3,
                      }]}>
                        {item.active ? 'AKTİF' : 'PASİF'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                      <Text style={[styles.actionText, { color: Colors.red }]}>SİL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.ruleSeparator} />
              </View>
            ))}
          </View>
        )}

        {/* Kural ekle butonları */}
        {formMode === 'none' && (
          <View style={styles.addButtons}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>KURAL EKLE</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity onPress={() => setFormMode('daily')} style={styles.addBtn} activeOpacity={0.75}>
              <Text style={styles.addBtnLabel}>GÜNLİK</Text>
              <Text style={styles.addBtnText}>[ Her gün belirli saatte ]</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFormMode('countdown')} style={styles.addBtn} activeOpacity={0.75}>
              <Text style={styles.addBtnLabel}>TEK SEFERLİK</Text>
              <Text style={styles.addBtnText}>[ Belirli süre sonra ]</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Günlük form */}
        {formMode === 'daily' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>// GÜNLİK ZAMANLAYICI</Text>
            <View style={styles.timePickerRow}>
              <NumberPicker label="SAAT"    value={dailyHour}   min={0} max={23} onChange={setDailyHour} />
              <Text style={styles.timeSeparator}>:</Text>
              <NumberPicker label="DAKİKA" value={dailyMinute} min={0} max={59} onChange={setDailyMinute} />
            </View>
            <Text style={styles.formLabel}>AKSİYON</Text>
            <ActionPicker value={dailyAction} onChange={setDailyAction} />

            {/* Bildirim bilgisi */}
            <View style={styles.notifInfoBox}>
              <Text style={styles.notifInfoText}>
                🔔 Her gün {String(dailyHour).padStart(2,'0')}:{String(dailyMinute).padStart(2,'0')}'de telefona bildirim gönderilecek.
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                Her gün{' '}
                <Text style={{ color: Colors.cyan }}>
                  {String(dailyHour).padStart(2,'0')}:{String(dailyMinute).padStart(2,'0')}
                </Text>
                {'\'de LED '}
                <Text style={{ color: dailyAction === 1 ? Colors.cyan : Colors.red }}>
                  {dailyAction === 1 ? 'açılacak' : 'kapanacak'}
                </Text>
              </Text>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                onPress={handleAddDaily}
                disabled={saving}
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                activeOpacity={0.75}
              >
                <Text style={[styles.saveBtnText, saving && { color: Colors.text3 }]}>
                  {saving ? '[ KAYDEDİLİYOR... ]' : '[ KAYDET ]'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFormMode('none')} style={styles.cancelBtn} activeOpacity={0.75}>
                <Text style={styles.cancelBtnText}>İPTAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Countdown formu */}
        {formMode === 'countdown' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>// TEK SEFERLİK ZAMANLAYICI</Text>
            <View style={styles.timePickerRow}>
              <NumberPicker label="SAAT"    value={cdHour}   min={0} max={23} onChange={setCdHour} />
              <Text style={styles.timeSeparator}>:</Text>
              <NumberPicker label="DAKİKA" value={cdMinute} min={0} max={59} onChange={setCdMinute} />
            </View>
            <Text style={styles.formLabel}>AKSİYON</Text>
            <ActionPicker value={cdAction} onChange={setCdAction} />

            {/* Bildirim bilgisi */}
            {(cdHour > 0 || cdMinute > 0) && (
              <View style={styles.notifInfoBox}>
                <Text style={styles.notifInfoText}>
                  🔔 {cdHour > 0 ? `${cdHour} saat ` : ''}{cdMinute > 0 ? `${cdMinute} dakika ` : ''}sonra telefona bildirim gönderilecek.
                </Text>
              </View>
            )}

            <View style={styles.summaryBox}>
              {cdHour === 0 && cdMinute === 0 ? (
                <Text style={[styles.summaryText, { color: Colors.amber }]}>⚠ En az 1 dakika giriniz</Text>
              ) : (
                <Text style={styles.summaryText}>
                  {cdHour > 0   && <Text style={{ color: Colors.cyan }}>{cdHour} saat </Text>}
                  {cdMinute > 0 && <Text style={{ color: Colors.cyan }}>{cdMinute} dakika </Text>}
                  {'sonra LED '}
                  <Text style={{ color: cdAction === 1 ? Colors.cyan : Colors.red }}>
                    {cdAction === 1 ? 'açılacak' : 'kapanacak'}
                  </Text>
                </Text>
              )}
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                onPress={handleAddCountdown}
                disabled={saving || (cdHour === 0 && cdMinute === 0)}
                style={[styles.saveBtn, (saving || (cdHour === 0 && cdMinute === 0)) && styles.saveBtnDisabled]}
                activeOpacity={0.75}
              >
                <Text style={[styles.saveBtnText, (saving || (cdHour === 0 && cdMinute === 0)) && { color: Colors.text3 }]}>
                  {saving ? '[ KAYDEDİLİYOR... ]' : '[ KAYDET ]'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFormMode('none')} style={styles.cancelBtn} activeOpacity={0.75}>
                <Text style={styles.cancelBtnText}>İPTAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  root: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  refreshBtn: { minWidth: 60, alignItems: 'flex-end' },
  refreshText: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text2 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginTop: Spacing.md },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.xl },
  titleBlock: { gap: Spacing.sm },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: { fontFamily: Fonts.sans, fontSize: 32, color: Colors.text, fontWeight: '300' },
  infoRow: { gap: Spacing.xs },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeDot: { width: 6, height: 6, borderRadius: 999 },
  timeText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notifIcon: { fontSize: 11 },
  notifText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.green },
  emptyBox: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text2 },
  emptySubText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text3, textAlign: 'center' },
  ruleList: { gap: 0 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
  ruleRowInactive: { opacity: 0.5 },
  ruleDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  ruleCenter: { flex: 1, gap: Spacing.xs },
  ruleDesc: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.text, lineHeight: 20 },
  ruleDescInactive: { color: Colors.text2 },
  ruleTagRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  ruleTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  ruleTagText: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.text3 },
  notifBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.sm, backgroundColor: Colors.greenAlpha },
  notifBadgeText: { fontSize: 10 },
  ruleActions: { gap: Spacing.sm, alignItems: 'flex-end' },
  actionBtn: { paddingVertical: 2 },
  actionText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text2 },
  ruleSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border3 },
  addButtons: { gap: Spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  dividerLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  addBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: Colors.bg3, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 2 },
  addBtnLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3 },
  addBtnText: { fontFamily: Fonts.mono, fontSize: 14, letterSpacing: 2, color: Colors.text2 },
  form: { gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg3, padding: Spacing.lg },
  formTitle: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 3, color: Colors.cyan },
  formLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3, marginBottom: -Spacing.sm },
  timePickerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.md },
  timeSeparator: { fontFamily: Fonts.mono, fontSize: 32, color: Colors.text2, marginBottom: 6, lineHeight: 52 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionChoice: { flex: 1, height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  actionChoiceOn:  { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  actionChoiceOff: { borderColor: Colors.red, backgroundColor: Colors.redAlpha },
  actionChoiceText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 2, color: Colors.text2 },
  notifInfoBox: { borderWidth: 1, borderColor: Colors.green, borderRadius: Radius.sm, backgroundColor: Colors.greenAlpha, padding: Spacing.md },
  notifInfoText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.green, lineHeight: 18 },
  summaryBox: { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm, backgroundColor: Colors.bg4, padding: Spacing.md },
  summaryText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.text, lineHeight: 22 },
  formButtons: { gap: Spacing.sm },
  saveBtn: { height: 48, borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.sm, backgroundColor: Colors.cyanAlpha, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.bg4 },
  saveBtnText: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 2, color: Colors.cyan },
  cancelBtn: { height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.text2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border3, paddingTop: Spacing.md, paddingHorizontal: Spacing.xl },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});