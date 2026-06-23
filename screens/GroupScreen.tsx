/**
 * screens/GroupScreen.tsx
 *
 * Oda/Grup yönetim ekranı.
 * - Grupları listeler
 * - Yeni grup oluşturma / düzenleme formu (ad, ikon, cihaz seçimi)
 * - Grup kartından tek tuşla tüm cihazları aç/kapat
 * - Kısmi başarı durumunda (bazı cihazlar offline) kullanıcıya bildirim
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLanguage } from '../i18n/LanguageContext';
import { sendGroupCommand } from '../services/groupController';
import {
  addGroup,
  getGroups,
  removeGroup,
  updateGroup,
} from '../services/groupStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';
import { Group } from '../types/Group';

type Props = {
  devices: Device[];
  onBack:  () => void;
};

const ICON_OPTIONS = ['💡', '🛋️', '🛏️', '🍳', '🚿', '🏠', '📚', '🎮', '🌿', '🔆', '🌙', '⭐'];

type SendStatus = 'idle' | 'sending' | 'done';

export default function GroupScreen({ devices, onBack }: Props) {
  const { t } = useLanguage();

  const [groups,      setGroups]      = useState<Group[]>([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Form state
  const [formName,      setFormName]      = useState('');
  const [formIcon,      setFormIcon]      = useState('💡');
  const [formDeviceIds, setFormDeviceIds] = useState<string[]>([]);
  const [saving,        setSaving]        = useState(false);

  // Komut gönderme durumu — her grup için ayrı
  const [sendStatus, setSendStatus] = useState<Record<string, SendStatus>>({});
  const [sendMsg,    setSendMsg]    = useState<Record<string, string>>({});

  const statusTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadGroups = useCallback(async () => {
    const g = await getGroups();
    setGroups(g);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // ── Form ─────────────────────────────────────────────────────────────────
  const openNewForm = () => {
    setEditingGroup(null);
    setFormName('');
    setFormIcon('💡');
    setFormDeviceIds([]);
    setShowForm(true);
  };

  const openEditForm = (group: Group) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormIcon(group.icon);
    setFormDeviceIds([...group.deviceIds]);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingGroup(null);
  };

  const toggleDeviceInForm = (deviceId: string) => {
    setFormDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, {
          name:      formName.trim(),
          icon:      formIcon,
          deviceIds: formDeviceIds,
        });
      } else {
        await addGroup(formName.trim(), formIcon, formDeviceIds);
      }
      await loadGroups();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (group: Group) => {
    Alert.alert(
      t('group.deleteTitle'),
      `"${group.name}" ${t('group.deleteDesc')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text:  t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await removeGroup(group.id);
            await loadGroups();
          },
        },
      ]
    );
  };

  // ── Komut gönderme ────────────────────────────────────────────────────────
  const sendToGroup = async (group: Group, type: 'on' | 'off') => {
    const groupDevices = devices.filter((d) => group.deviceIds.includes(d.id));
    if (groupDevices.length === 0) return;

    setSendStatus((prev) => ({ ...prev, [group.id]: 'sending' }));
    setSendMsg((prev) => ({ ...prev, [group.id]: t('group.sending') }));

    const results = await sendGroupCommand(groupDevices, { type });
    const successCount = results.filter((r) => r.success).length;

    const msg = successCount === groupDevices.length
      ? t('group.sentSuccess')
      : `${successCount}/${groupDevices.length} ${t('group.sentPartial')}`;

    setSendStatus((prev) => ({ ...prev, [group.id]: 'done' }));
    setSendMsg((prev) => ({ ...prev, [group.id]: msg }));

    // 3 saniye sonra temizle
    if (statusTimers.current[group.id]) clearTimeout(statusTimers.current[group.id]);
    statusTimers.current[group.id] = setTimeout(() => {
      setSendStatus((prev) => ({ ...prev, [group.id]: 'idle' }));
      setSendMsg((prev) => ({ ...prev, [group.id]: '' }));
    }, 3000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const renderGroup = ({ item: group }: { item: Group }) => {
    const groupDevices = devices.filter((d) => group.deviceIds.includes(d.id));
    const status = sendStatus[group.id] ?? 'idle';
    const msg    = sendMsg[group.id] ?? '';

    return (
      <View style={styles.card}>
        {/* Kart başlığı */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>{group.icon}</Text>
            <View>
              <Text style={styles.cardName}>{group.name}</Text>
              <Text style={styles.cardSub}>
                {groupDevices.length} {t('group.devices').toLowerCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => openEditForm(group)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        </View>

        {/* Cihaz listesi özeti */}
        <View style={styles.devicePills}>
          {groupDevices.map((d) => (
            <View key={d.id} style={styles.devicePill}>
              <Text style={styles.devicePillText}>{d.name}</Text>
            </View>
          ))}
          {group.deviceIds.length === 0 && (
            <Text style={styles.noDeviceText}>{t('group.noDevices')}</Text>
          )}
        </View>

        {/* Durum mesajı */}
        {msg !== '' && (
          <Text style={[
            styles.statusMsg,
            status === 'done' && { color: Colors.green },
          ]}>
            {msg}
          </Text>
        )}

        {/* Kontrol butonları */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOn, status === 'sending' && { opacity: 0.5 }]}
            onPress={() => sendToGroup(group, 'on')}
            disabled={status === 'sending'}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, { color: Colors.cyan }]}>
              {status === 'sending' ? '...' : t('group.turnOn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOff, status === 'sending' && { opacity: 0.5 }]}
            onPress={() => sendToGroup(group, 'off')}
            disabled={status === 'sending'}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, { color: Colors.text2 }]}>
              {status === 'sending' ? '...' : t('group.turnOff')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(group)}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('group.tab')}</Text>
        <TouchableOpacity onPress={openNewForm} style={styles.addBtn} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Başlık */}
      <View style={styles.titleBlock}>
        <Text style={styles.titleEyebrow}>{t('group.title')}</Text>
      </View>

      {/* Grup listesi */}
      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyTitle}>{t('group.empty')}</Text>
          <Text style={styles.emptyDesc}>{t('group.emptyDesc')}</Text>
          <TouchableOpacity onPress={openNewForm} style={styles.emptyAddBtn} activeOpacity={0.8}>
            <Text style={styles.emptyAddBtnText}>{t('group.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />
      )}

      {/* Grup oluştur / düzenle formu */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Form başlığı */}
              <Text style={styles.formTitle}>
                {editingGroup ? t('group.editGroup').toUpperCase() : t('group.newGroup').toUpperCase()}
              </Text>

              {/* Ad */}
              <Text style={styles.fieldLabel}>{t('group.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder={t('group.namePlaceholder')}
                placeholderTextColor={Colors.text3}
                maxLength={30}
              />

              {/* İkon seçimi */}
              <Text style={styles.fieldLabel}>{t('group.iconLabel')}</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, formIcon === icon && styles.iconOptionActive]}
                    onPress={() => setFormIcon(icon)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconOptionText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cihaz seçimi */}
              <Text style={styles.fieldLabel}>{t('group.devicesLabel')}</Text>
              {devices.length === 0 ? (
                <Text style={styles.noDeviceText}>{t('group.noDevices')}</Text>
              ) : (
                devices.map((device) => {
                  const selected = formDeviceIds.includes(device.id);
                  return (
                    <TouchableOpacity
                      key={device.id}
                      style={[styles.deviceRow, selected && styles.deviceRowSelected]}
                      onPress={() => toggleDeviceInForm(device.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View>
                        <Text style={[styles.deviceRowName, selected && { color: Colors.cyan }]}>
                          {device.name}
                        </Text>
                        <Text style={styles.deviceRowIp}>{device.ip}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={{ height: Spacing.xl }} />

              {/* Kaydet */}
              <TouchableOpacity
                style={[styles.saveBtn, (!formName.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!formName.trim() || saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? t('group.savingButton') : t('group.saveButton')}
                </Text>
              </TouchableOpacity>

              {/* İptal */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeForm}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { width: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text2 },
  headerTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.text3 },
  addBtn: { width: 60, alignItems: 'flex-end' },
  addBtnText: { fontFamily: Fonts.mono, fontSize: 20, color: Colors.cyan },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  titleBlock: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 3, color: Colors.text3 },
  listContent: { padding: Spacing.xl, paddingTop: Spacing.md },

  // Kart
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bg2, padding: Spacing.lg, gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { fontSize: 28 },
  cardName: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: '600', color: Colors.text },
  cardSub: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3, marginTop: 2 },
  editBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text2 },
  devicePills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  devicePill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.full ?? 999, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3,
  },
  devicePillText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text2 },
  statusMsg: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3, textAlign: 'center' },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm,
    borderWidth: 1, alignItems: 'center',
  },
  actionBtnOn: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  actionBtnOff: { borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  actionBtnText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1 },
  deleteBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.red },
  noDeviceText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text3, fontStyle: 'italic' },

  // Boş durum
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.md,
    backgroundColor: Colors.cyanAlpha,
  },
  emptyAddBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: Colors.cyan },

  // Modal form
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  formCard: {
    backgroundColor: Colors.bg2, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xl, maxHeight: '85%',
  },
  formTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.text3, marginBottom: Spacing.lg },
  fieldLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text3, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  input: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.sm,
    backgroundColor: Colors.bg3, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontFamily: Fonts.sans, fontSize: 14, color: Colors.text,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconOption: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  iconOptionActive: { borderColor: Colors.cyan, backgroundColor: Colors.cyanAlpha },
  iconOptionText: { fontSize: 22 },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    backgroundColor: Colors.bg3, marginBottom: Spacing.xs,
  },
  deviceRowSelected: { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: Colors.cyan, backgroundColor: Colors.cyan },
  checkmark: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.bg },
  deviceRowName: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text },
  deviceRowIp: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.text3 },
  saveBtn: {
    borderWidth: 1, borderColor: Colors.cyan2, borderRadius: Radius.md,
    backgroundColor: Colors.cyanAlpha, paddingVertical: Spacing.md, alignItems: 'center',
  },
  saveBtnText: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 2, color: Colors.cyan },
  cancelBtn: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  cancelBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: Colors.text3 },
});
