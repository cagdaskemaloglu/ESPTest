/**
 * screens/DeviceListScreen.tsx
 * Kayıtlı ESP32 cihazlarını listeleyen ekran.
 *
 * Her cihaz satırında:
 *   - Cihaza bağlan (seç)
 *   - Yeniden adlandır
 *   - Uygulamadan sil (sadece kayıt silinir, ESP32 etkilenmez)
 *   - ESP32 Fabrika Sıfırla (WiFi + automation verileri silinir, AP moduna geçer)
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
import {
  getDevices,
  removeDevice,
  renameDevice,
} from '../services/deviceStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = {
  activeDeviceId: string;
  onSelect:  (device: Device) => void;
  onAddNew:  () => void;
  onBack:    () => void;
};

export default function DeviceListScreen({
  activeDeviceId,
  onSelect,
  onAddNew,
  onBack,
}: Props) {
  const [devices, setDevices]         = useState<Device[]>([]);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [resetting, setResetting]     = useState<string | null>(null); // Sıfırlanan cihaz ID

  useEffect(() => { loadDevices(); }, []);

  const loadDevices = async () => {
    setDevices(await getDevices());
  };

  // ── Uygulamadan sil ────────────────────────────────────────────────────────
  // Sadece AsyncStorage'dan kaldırır — ESP32'ye dokunmaz
  const handleDelete = (device: Device) => {
    Alert.alert(
      'Cihazı Listeden Kaldır',
      `"${device.name}" uygulamadan kaldırılsın mı?\n\nESP32 etkilenmez — tekrar tarayarak yeniden ekleyebilirsin.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            await removeDevice(device.id);
            await loadDevices();
            if (device.id === activeDeviceId) onBack();
          },
        },
      ]
    );
  };

  // ── Yeniden adlandır ───────────────────────────────────────────────────────
  const startEdit = (device: Device) => {
    setEditingId(device.id);
    setEditingName(device.name);
  };

  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await renameDevice(editingId, editingName.trim());
    setEditingId(null);
    await loadDevices();
  };

  // ── ESP32 Fabrika Sıfırla ──────────────────────────────────────────────────
  // /factory-reset endpoint'ini çağırır.
  // ESP32: WiFi + automation siler → restart → AP moduna geçer.
  // Uygulama: cihazı listeden de kaldırır (artık erişilemez).
  //
  // UYARI: Kullanıcının hâlâ aynı ağda olması gerekir.
  // Yeni eve taşınma durumunda fiziksel buton kullanılmalı.
  const handleFactoryReset = (device: Device) => {
    Alert.alert(
      '⚠️ Fabrika Sıfırlama',
      `"${device.name}" cihazı sıfırlanacak.\n\n` +
      `• ESP32'nin WiFi bilgileri silinecek\n` +
      `• Automation kuralları silinecek\n` +
      `• Cihaz "ESP32-Setup" moduna geçecek\n` +
      `• Yeniden kurulum gerekecek\n\n` +
      `Bu işlem geri alınamaz. Devam etmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: () => confirmFactoryReset(device),
        },
      ]
    );
  };

  const confirmFactoryReset = async (device: Device) => {
    setResetting(device.id);
    try {
      // ESP32'ye sıfırlama komutu gönder
      const res = await fetch(`http://${device.ip}/factory-reset`);

      if (res.ok) {
        // Başarılı — cihazı listeden kaldır
        await removeDevice(device.id);
        await loadDevices();

        Alert.alert(
          'Sıfırlama Tamamlandı',
          `"${device.name}" sıfırlandı.\n\n` +
          `ESP32 şu an "ESP32-Setup" modunda.\n` +
          `Yeniden kurmak için:\n` +
          `1. "ESP32-Setup" ağına bağlan\n` +
          `2. Kurulum ekranından WiFi bilgilerini gir`,
          [{ text: 'Tamam', onPress: () => { if (device.id === activeDeviceId) onBack(); } }]
        );
      } else {
        throw new Error('Sunucu hatası');
      }
    } catch {
      // ESP32'ye ulaşılamadı — sadece listeden kaldır mı?
      Alert.alert(
        'ESP32\'ye Ulaşılamadı',
        `"${device.name}" cihazına bağlanılamadı.\n\n` +
        `Olası nedenler:\n` +
        `• Cihaz farklı bir ağda\n` +
        `• Cihaz kapalı\n\n` +
        `Cihazı sadece uygulamadan kaldırmak ister misin?\n` +
        `(ESP32 sıfırlanmaz, tekrar tarayarak bulunabilir)`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sadece Listeden Kaldır',
            style: 'destructive',
            onPress: async () => {
              await removeDevice(device.id);
              await loadDevices();
              if (device.id === activeDeviceId) onBack();
            },
          },
        ]
      );
    }
    setResetting(null);
  };

  // ── Liste satırı ──────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Device }) => {
    const isActive   = item.id === activeDeviceId;
    const isEditing  = item.id === editingId;
    const isResetting = item.id === resetting;

    return (
      <View style={[styles.row, isActive && styles.rowActive]}>

        {/* Aktif göstergesi */}
        <View style={[styles.rowDot, {
          backgroundColor: isActive ? Colors.cyan : Colors.border2,
        }]} />

        {/* Orta: isim veya düzenleme */}
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
              <Text style={[styles.rowName, isActive && { color: Colors.cyan }]}>
                {item.name}
              </Text>
              <Text style={styles.rowIp}>{item.ip}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sağ: eylem butonları */}
        <View style={styles.rowActions}>
          {isEditing ? (
            <TouchableOpacity onPress={confirmRename} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: Colors.cyan }]}>KAYDET</Text>
            </TouchableOpacity>
          ) : isResetting ? (
            <Text style={[styles.actionText, { color: Colors.amber }]}>SIFIRLANIYOR...</Text>
          ) : (
            <>
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionBtn}>
                <Text style={styles.actionText}>DÜZENLE</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: Colors.red }]}>KALDIR</Text>
              </TouchableOpacity>

              {/* Fabrika sıfırlama — kırmızı, en sağda */}
              <TouchableOpacity
                onPress={() => handleFactoryReset(item)}
                style={[styles.actionBtn, styles.resetBtn]}
              >
                <Text style={[styles.actionText, { color: Colors.amber }]}>SIFIRLA</Text>
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
        <TouchableOpacity onPress={onAddNew} style={styles.addBtn}>
          <Text style={styles.addText}>+ EKLE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      {/* Başlık */}
      <View style={styles.titleBlock}>
        <Text style={styles.titleEyebrow}>// KAYITLI CİHAZLAR</Text>
        <Text style={styles.titleMain}>{devices.length} cihaz kayıtlı</Text>
        <Text style={styles.titleDesc}>
          SIFIRLA → ESP32 fabrika ayarlarına döner, yeniden kurulum gerekir
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

      {/* Reset butonu fiziksel bilgi notu */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📌 Fiziksel Reset Butonu</Text>
        <Text style={styles.infoText}>
          Uygulamaya erişemiyorsan (farklı ağ, cihaz kapalı):
          {'\n'}GPIO {0}'daki butonu 3 saniye basılı tut →
          {'\n'}LED sarı → kırmızı → sıfırlama tamamlanır
        </Text>
      </View>

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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  backBtn: { minWidth: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.text2 },
  headerBrand: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text2 },
  addBtn: { minWidth: 60, alignItems: 'flex-end' },
  addText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.cyan },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },

  // Başlık
  titleBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  titleEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.cyan },
  titleMain: { fontFamily: Fonts.sans, fontSize: 28, color: Colors.text, fontWeight: '300' },
  titleDesc: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.text3,
    lineHeight: 16,
  },

  // Liste
  listContent: { paddingBottom: Spacing.xl },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowActive: {
    backgroundColor: Colors.cyanAlpha,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  rowDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  rowCenter: { flex: 1, gap: 2 },
  rowName: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text, fontWeight: '400' },
  rowIp: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  rowActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  actionBtn: { paddingVertical: Spacing.xs, paddingHorizontal: 2 },
  actionText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text2 },
  resetBtn: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    paddingLeft: Spacing.sm,
    marginLeft: 2,
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

  // Boş durum
  emptyBox: { marginTop: Spacing.xl * 2, alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.text2 },
  emptySubText: {
    fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1,
    color: Colors.text3, textAlign: 'center',
  },

  // Fiziksel reset bilgi notu
  infoBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg3,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  infoText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.text3,
    lineHeight: 18,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border3,
    paddingTop: Spacing.md,
  },
  footerText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2.5, color: Colors.text3 },
  footerSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border2 },
});