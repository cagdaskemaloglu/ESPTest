/**
 * components/PinScreen.tsx
 * ESP32'den 403 gelince veya PIN bilinmiyorsa gösterilen ekran.
 *
 * İki mod:
 *   'enter'  → Kullanıcı mevcut PIN'i girer (yanlış PIN durumu)
 *   'setup'  → Cihaz PIN gerektiriyor ama uygulama PIN bilmiyor
 *              (eski kayıt veya PIN değiştirilmiş)
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

type Props = {
  deviceName:  string;
  mode:        'enter' | 'setup';
  onSubmit:    (pin: string) => void;
  onCancel:    () => void;
  error?:      string | null;  // Yanlış PIN mesajı
  isLoading?:  boolean;
};

export default function PinScreen({
  deviceName,
  mode,
  onSubmit,
  onCancel,
  error,
  isLoading,
}: Props) {
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (pin.length < 4) return;
    onSubmit(pin);
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.backdrop} />

      <View style={styles.card}>

        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>// GÜVENLİK</Text>
          <Text style={styles.title}>
            {mode === 'enter' ? 'PIN Gerekli' : 'PIN Bilinmiyor'}
          </Text>
          <Text style={styles.subtitle}>{deviceName}</Text>
        </View>

        {/* Açıklama */}
        <Text style={styles.desc}>
          {mode === 'enter'
            ? 'Bu cihaza erişmek için PIN\'ini gir.'
            : 'Bu cihaz için kayıtlı PIN bulunamadı.\nKurulum sırasında belirlediğin PIN\'i gir.'}
        </Text>

        {/* PIN input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PIN</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
            placeholder="••••"
            placeholderTextColor={Colors.text3}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            style={[styles.input, error && styles.inputError]}
          />
        </View>

        {/* Hata mesajı */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* Butonlar */}
        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={pin.length < 4 || isLoading}
            activeOpacity={0.75}
            style={[
              styles.submitBtn,
              (pin.length < 4 || isLoading) && styles.submitBtnDisabled,
            ]}
          >
            <Text style={[
              styles.submitBtnText,
              (pin.length < 4 || isLoading) && { color: Colors.text3 },
            ]}>
              {isLoading ? '[ DOĞRULANÜYOR... ]' : '[ GİRİŞ ]'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.75}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>← Geri Dön</Text>
          </TouchableOpacity>
        </View>

        {/* İpucu */}
        <Text style={styles.hint}>
          PIN'ini unuttuysan cihazı fabrika ayarlarına sıfırlaman gerekir.
        </Text>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,11,16,0.92)',
  },
  card: {
    width: '88%',
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg2,
    padding: Spacing.xl,
    gap: Spacing.lg,
    zIndex: 101,
  },
  header: { gap: Spacing.xs },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 4,
    color: Colors.cyan,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    color: Colors.text,
    fontWeight: '300',
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.text3,
  },
  desc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text2,
    lineHeight: 20,
  },
  inputGroup: { gap: Spacing.sm },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.text3,
  },
  input: {
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 20,
    letterSpacing: 6,
    color: Colors.text,
    textAlign: 'center',
  },
  inputError: { borderColor: Colors.red },
  errorBox: {
    borderWidth: 1,
    borderColor: Colors.red,
    borderRadius: Radius.sm,
    backgroundColor: Colors.redAlpha,
    padding: Spacing.md,
  },
  errorText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.red,
  },
  buttons: { gap: Spacing.sm },
  submitBtn: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.cyan2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanAlpha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  submitBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    letterSpacing: 3,
    color: Colors.cyan,
  },
  cancelBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.text2,
  },
  hint: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.text3,
    textAlign: 'center',
    lineHeight: 16,
  },
});
