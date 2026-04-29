/**
 * screens/DeviceListScreen.tsx
 * Kayıtlı ESP32 cihazlarını listeleyen, cihaz değiştirme,
 * yeniden adlandırma ve silme işlemlerini sağlayan ekran.
 * ControlScreen'deki cihaz adına basılınca açılır.
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Device } from '../types/Device';
import {
  getDevices,
  removeDevice,
  renameDevice,
} from '../services/deviceStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

type Props = {
  activeDeviceId: string;              // Şu an kontrol edilen cihazın ID'si
  onSelect: (device: Device) => void;  // Farklı cihaza geçmek için
  onAddNew: () => void;                // "+" → ScanScreen'e gönderir
  onBack:   () => void;                // Geri → ControlScreen'e döner
};

export default function DeviceListScreen({
  activeDeviceId,
  onSelect,
  onAddNew,
  onBack,
}: Props) {
  const [devices, setDevices]         = useState<Device[]>([]);
  const [editingId, setEditingId]     = useState<string | null>(null); // Hangi cihaz düzenleniyor
  const [editingName, setEditingName] = useState('');

  // Ekran açılınca listeyi yükle
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const list = await getDevices();
    setDevices(list);
  };

  // Cihazı sil — aktif cihaz silinirse listeye dön
  const handleDelete = (device: Device) => {
    Alert.alert(
      'Cihazı Sil',
      `"${device.name}" listeden kaldırılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await removeDevice(device.id);
            await loadDevices();

            // Silinen cihaz aktifse geri dön (App.tsx yeni cihaz seçtirecek)
            if (device.id === activeDeviceId) onBack();
          },
        },
      ]
    );
  };

  // Düzenleme modunu aç
  const startEdit = (device: Device) => {
    setEditingId(device.id);
    setEditingName(device.name);
  };

  // Yeni adı kaydet
  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await renameDevice(editingId, editingName.trim());
    setEditingId(null);
    await loadDevices();
  };

  // ── Liste satırı ──────────────────────────────────────────────
  const renderItem = ({ item }: { item: Device }) => {
    const isActive  = item.id === activeDeviceId;
    const isEditing = item.id === editingId;

    return (
      <View style={[styles.row, isActive && styles.rowActive]}>

        {/* Sol: aktif göstergesi */}
        <View style={[styles.rowDot, { backgroundColor: isActive ? Colors.cyan : Colors.border2 }]} />

        {/* Orta: isim veya düzenleme alanı */}
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
              <Text style={[styles.rowName, isActive && styles.rowNameActive]}>
                {item.name}
              </Text>
              <Text style={styles.rowIp}>{item.ip}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sağ: eylem butonları */}
        <View style={styles.rowActions}>
          {isEditing ? (
            // Düzenleme modunda: kaydet
            <TouchableOpacity onPress={confirmRename} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: Colors.cyan }]}>KAYDET</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Yeniden adlandır */}
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionBtn}>
                <Text style={styles.actionText}>DÜZENLE</Text>
              </TouchableOpacity>

              {/* Sil */}
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: Colors.red }]}>SİL</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← GERİ</Text>
        </TouchableOpacity>
        <Text style={styles.headerBrand}>CİHAZLAR</Text>
        {/* Yeni cihaz ekle butonu */}
        <TouchableOpacity onPress={onAddNew} style={styles.addBtn}>
          <Text style={styles.addText}>+ EKLE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      {/* ── Başlık ── */}
      <View style={styles.titleBlock}>
        <Text style={styles.titleEyebrow}>// KAYITLI CİHAZLAR</Text>
        <Text style={styles.titleMain}>
          {devices.length} cihaz kayıtlı
        </Text>
      </View>

      {/* ── Cihaz listesi ── */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Henüz kayıtlı cihaz yok.</Text>
            <Text style={styles.emptySubText}>
              Sağ üstteki + butonuna bas ve ağı tara.
            </Text>
          </View>
        }
      />

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>37.0° N · 35.3° E</Text>
        <View style={styles.footerSep} />
        <Text style={styles.footerText}>Smart Craft · IoT</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  backBtn: { minWidth: 60 },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text2,
  },
  headerBrand: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.text2,
  },
  addBtn: { minWidth: 60, alignItems: 'flex-end' },
  addText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.cyan,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },

  // ── Başlık ──────────────────────────────────────────────────────
  titleBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  titleEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: Colors.cyan,
  },
  titleMain: {
    fontFamily: Fonts.sans,
    fontSize: 28,
    color: Colors.text,
    fontWeight: '300',
  },

  // ── Liste ────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: Spacing.xl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowActive: {
    // Aktif cihaz satırını hafifçe vurgula
    backgroundColor: Colors.cyanAlpha,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  rowDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    flexShrink: 0,
  },
  rowCenter: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400',
  },
  rowNameActive: {
    color: Colors.cyan,
  },
  rowIp: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.text3,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    paddingVertical: Spacing.xs,
  },
  actionText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.text2,
  },
  renameInput: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cyan2,
    paddingVertical: 2,
    letterSpacing: 1,
  },

  // ── Boş durum ────────────────────────────────────────────────────
  emptyBox: {
    marginTop: Spacing.xl * 2,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text2,
  },
  emptySubText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.text3,
    textAlign: 'center',
  },

  // ── Footer ──────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.md,
  },
  footerText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 2.5,
    color: Colors.text3,
  },
  footerSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border2,
  },
});
