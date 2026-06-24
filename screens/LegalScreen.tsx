/**
 * screens/LegalScreen.tsx
 *
 * Gizlilik Politikası ve Kullanım Koşulları ekranı.
 * Tab switcher ile iki doküman arasında geçiş yapılır.
 * Metin dile göre otomatik değişir (useLanguage).
 */

import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

type Tab = 'privacy' | 'terms';
type Props = { onBack: () => void };

// ── İçerikler ─────────────────────────────────────────────────────────────────
// Her bölüm type: 'h1' | 'h2' | 'body' olarak tanımlanmıştır.
// Böylece scroll içinde özel başlık/metin stilleri uygulanabilir.
type Section =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'body'; text: string };

function getPrivacyContent(lang: 'tr' | 'en'): Section[] {
  if (lang === 'tr') return [
    { type: 'h1', text: 'Gizlilik Politikası' },
    { type: 'body', text: 'Son güncelleme: Haziran 2026' },
    { type: 'body', text: 'Ambience Bureau, ESP32 tabanlı akıllı LED cihazlarınızı yerel Wi-Fi ağınız üzerinden kontrol etmenizi sağlayan bir mobil uygulamadır.' },
    { type: 'h2', text: 'Temel İlke' },
    { type: 'body', text: 'Uygulama, herhangi bir uzak sunucuya veri göndermez. Tüm cihaz bilgileri, ayarlar ve tercihler yalnızca telefonunuzun yerel depolama alanında saklanır.' },
    { type: 'h2', text: 'Toplanan ve İşlenen Veriler' },
    { type: 'body', text: 'Cihaz bilgileri (cihaz adı, IP, PIN ve tercihler) yalnızca telefonunuzda (AsyncStorage) saklanır, sunucuya iletilmez.\n\nDil tercihiniz yerel olarak saklanır.\n\nOtomasyon kuralları hem telefonunuzda hem de ilgili ESP32 cihazının belleğinde saklanır.' },
    { type: 'h2', text: 'İstenen İzinler' },
    { type: 'body', text: 'Yerel ağ erişimi: ESP32 cihazlarını bulmak ve iletişim kurmak için gereklidir.\n\nKonum izni (yalnızca Android): Android, Wi-Fi taraması için konum izni zorunlu kılar. Konumunuz kaydedilmez.\n\nBildirimler: Zamanlayıcı/otomasyon kuralları için yerel bildirimler planlanır.' },
    { type: 'h2', text: 'Üçüncü Taraflarla Paylaşım' },
    { type: 'body', text: 'Uygulama, hiçbir kullanıcı verisini üçüncü taraflarla paylaşmaz, satmaz veya reklam amacıyla kullanmaz. Uygulama içinde reklam bulunmaz.' },
    { type: 'h2', text: 'Firmware Güncellemeleri' },
    { type: 'body', text: 'Güncelleme kontrolünde GitHub\'da herkese açık bir dosyaya erişilir. Bu istek sırasında kişisel veri gönderilmez.' },
    { type: 'h2', text: 'Verilerin Silinmesi' },
    { type: 'body', text: 'Cihazı listeden kaldırdığınızda veya uygulamayı sildiğinizde, telefonunuzdaki tüm ilgili veriler silinir.' },
  ];

  return [
    { type: 'h1', text: 'Privacy Policy' },
    { type: 'body', text: 'Last updated: June 2026' },
    { type: 'body', text: 'Ambience Bureau is a mobile application that lets you control your ESP32-based smart LED devices over your local Wi-Fi network.' },
    { type: 'h2', text: 'Core Principle' },
    { type: 'body', text: 'The App does not send any data to remote servers. All device information, settings, and preferences are stored exclusively on your phone\'s local storage.' },
    { type: 'h2', text: 'Data We Collect and Process' },
    { type: 'body', text: 'Device information (name, IP, PIN, and preferences) is stored only on your phone (AsyncStorage) and is never sent to any server.\n\nYour language preference is stored locally.\n\nAutomation rules are stored both on your phone and in the relevant ESP32 device\'s memory.' },
    { type: 'h2', text: 'Permissions' },
    { type: 'body', text: 'Local network access: Required to discover your ESP32 devices and communicate with them.\n\nLocation permission (Android only): Android requires location permission for Wi-Fi scanning. Your location is never recorded.\n\nNotifications: Local notifications are scheduled for your timer/automation rules.' },
    { type: 'h2', text: 'Third-Party Sharing' },
    { type: 'body', text: 'The App does not share, sell, or use any user data for advertising. There are no ads in the App.' },
    { type: 'h2', text: 'Firmware Updates' },
    { type: 'body', text: 'When checking for updates, a publicly hosted file on GitHub is accessed. No personal data is sent during this request.' },
    { type: 'h2', text: 'Deleting Your Data' },
    { type: 'body', text: 'When you remove a device or uninstall the App, all related data on your phone is deleted.' },
  ];
}

function getTermsContent(lang: 'tr' | 'en'): Section[] {
  if (lang === 'tr') return [
    { type: 'h1', text: 'Kullanım Koşulları' },
    { type: 'body', text: 'Son güncelleme: Haziran 2026' },
    { type: 'body', text: 'Bu uygulamayı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.' },
    { type: 'h2', text: 'Uygulamanın Amacı' },
    { type: 'body', text: 'Ambience Bureau, ESP32 tabanlı LED cihazlarını yerel Wi-Fi ağı üzerinden kontrol etmek için tasarlanmıştır.' },
    { type: 'h2', text: 'Kullanıcının Sorumlulukları' },
    { type: 'body', text: '• Uygulamayı yalnızca kendi cihazlarınızı kontrol etmek için kullanabilirsiniz.\n• Başkasına ait bir cihaza izinsiz erişmek yasaktır.\n• Kötüye kullanımdan doğan sorumluluk kullanıcıya aittir.' },
    { type: 'h2', text: 'Sorumluluk Reddi' },
    { type: 'body', text: 'Uygulama "olduğu gibi" sunulmaktadır. Kesintisiz veya hatasız çalışacağı garanti edilmez.\n\nDonanım arızaları, yanlış kurulum veya üçüncü taraf aksesuarlardan kaynaklanan zararlar için sorumluluk kabul edilmez.\n\nYerel ağ güvenliğinden kullanıcı sorumludur.' },
    { type: 'h2', text: 'Fikri Mülkiyet' },
    { type: 'body', text: 'Uygulamanın kaynak kodu, tasarımı ve içeriği geliştiriciye aittir. İzinsiz kopyalanamaz veya dağıtılamaz.' },
    { type: 'h2', text: 'Değişiklikler' },
    { type: 'body', text: 'Bu koşullar güncellenebilir. "Son güncelleme" alanından takip edilebilir.' },
  ];

  return [
    { type: 'h1', text: 'Terms of Use' },
    { type: 'body', text: 'Last updated: June 2026' },
    { type: 'body', text: 'By using this App, you agree to the following terms.' },
    { type: 'h2', text: 'Purpose of the App' },
    { type: 'body', text: 'Ambience Bureau is designed to control ESP32-based LED devices over a local Wi-Fi network.' },
    { type: 'h2', text: 'User Responsibilities' },
    { type: 'body', text: '• You may only use the App to control your own devices.\n• Unauthorized access to others\' devices is prohibited.\n• Liability for misuse lies solely with the user.' },
    { type: 'h2', text: 'Disclaimer' },
    { type: 'body', text: 'The App is provided "as is." Uninterrupted or error-free operation is not guaranteed.\n\nNo liability is accepted for damage caused by hardware failures, incorrect setup, or third-party accessories.\n\nThe user is responsible for local network security.' },
    { type: 'h2', text: 'Intellectual Property' },
    { type: 'body', text: 'The source code, design, and content of the App belong to the developer. Unauthorized copying or distribution is prohibited.' },
    { type: 'h2', text: 'Changes' },
    { type: 'body', text: 'These terms may be updated. Changes will be reflected in the "Last updated" field.' },
  ];
}

export default function LegalScreen({ onBack }: Props) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('privacy');

  const sections = activeTab === 'privacy'
    ? getPrivacyContent(language)
    : getTermsContent(language);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('legal.title').toUpperCase()}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            {t('legal.privacy')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            {t('legal.terms')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* İçerik */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, i) => {
          if (section.type === 'h1') return (
            <Text key={i} style={styles.h1}>{section.text}</Text>
          );
          if (section.type === 'h2') return (
            <Text key={i} style={styles.h2}>{section.text}</Text>
          );
          return (
            <Text key={i} style={styles.body}>{section.text}</Text>
          );
        })}

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 80,
  },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.text2,
  },
  headerTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.text3,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  tabActive: {
    borderColor: Colors.cyan2,
    backgroundColor: Colors.cyanAlpha,
  },
  tabText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.text3,
  },
  tabTextActive: {
    color: Colors.cyan,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  h1: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  h2: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.cyan2,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.text2,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  footerSpace: {
    height: Spacing.xl * 2,
  },
});