/**
 * components/ErrorBoundary.tsx
 *
 * React'in render hatalarını yakalayan sınır bileşeni.
 * Beklenmeyen bir hata (örn. Model3DViewer'da bir GL hatası, veya
 * herhangi bir ekranda null-pointer benzeri bir render hatası) oluştuğunda
 * tüm uygulamanın beyaz ekrana düşmesini engeller; bunun yerine
 * kullanıcıya tasarım diline uygun bir "bir şeyler ters gitti" ekranı
 * gösterir ve yeniden başlatma imkânı sunar.
 *
 * Not: Error boundary'ler SADECE class component olarak yazılabilir
 * (React henüz hook tabanlı bir eşdeğer sunmuyor). Bu yüzden useLanguage()
 * hook'u burada kullanılamaz; bunun yerine LanguageContext'e
 * static contextType ile bağlanılır.
 *
 * Kullanım (App.tsx içinde) — LanguageProvider DIŞTA, ErrorBoundary İÇTE olmalı,
 * aksi halde context.t() henüz hazır olmadığı için hata mesajı boş kalır:
 *   <LanguageProvider>
 *     <ErrorBoundary>
 *       <AppInner />
 *     </ErrorBoundary>
 *   </LanguageProvider>
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LanguageContext } from '../i18n/LanguageContext';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  static contextType = LanguageContext;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Geliştirme sürecinde teşhis için konsola yaz.
    // İleride bir crash-reporting servisi (Sentry vb.) eklenirse buraya bağlanır.
    console.error('ErrorBoundary yakaladı:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const ctx = this.context as { t?: (key: string) => string } | null;
      const t = ctx?.t ?? ((key: string) => key);

      return (
        <View style={styles.bg}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>{t('errorBoundary.title')}</Text>
            <Text style={styles.desc}>{t('errorBoundary.desc')}</Text>

            <TouchableOpacity
              onPress={this.handleRestart}
              activeOpacity={0.8}
              style={styles.restartBtn}
            >
              <Text style={styles.restartBtnText}>{t('errorBoundary.restartButton')}</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsLabel}>{t('errorBoundary.detailsLabel')}</Text>
                <Text style={styles.detailsText}>
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  desc: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  restartBtn: {
    borderWidth: 1,
    borderColor: Colors.cyan2,
    backgroundColor: Colors.cyanAlpha,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  restartBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: Colors.cyan,
  },
  detailsBox: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg3,
    width: '100%',
  },
  detailsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.text3,
    marginBottom: Spacing.sm,
  },
  detailsText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.red,
    lineHeight: 14,
  },
});

export default ErrorBoundary;
