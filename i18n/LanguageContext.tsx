/**
 * i18n/LanguageContext.tsx
 *
 * Dil durumu ve t() çeviri fonksiyonunu sağlayan React Context.
 *
 * Kullanım:
 *   const { t, language, setLanguage } = useLanguage();
 *   <Text>{t('start.welcome')}</Text>
 *
 * Otomatik algılama: ilk açılışta telefon dili kontrol edilir.
 * Desteklenmeyen bir dilse (örn. fr, de) varsayılan olarak 'en' kullanılır.
 * Kullanıcı manuel seçim yaparsa AsyncStorage'a kaydedilir ve sonraki
 * açılışlarda telefon dili yerine bu tercih kullanılır.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Language,
  SUPPORTED_LANGUAGES,
  TranslationKey,
  translations,
} from './translations';

const STORAGE_KEY = 'torva_language';

type LanguageContextValue = {
  language:    Language;
  setLanguage: (lang: Language) => Promise<void>;
  t:           (key: TranslationKey) => string;
  ready:       boolean; // AsyncStorage + cihaz dili okuma tamamlandı mı
};

// Context objesinin kendisi export edilir — class component'ler (örn. ErrorBoundary)
// hook kullanamadığı için static contextType = LanguageContext ile bağlanabilsin.
export const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDeviceLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    const code = locales[0]?.languageCode ?? 'en';
    return SUPPORTED_LANGUAGES.includes(code as Language) ? (code as Language) : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
          setLanguageState(saved as Language);
        } else {
          setLanguageState(detectDeviceLanguage());
        }
      } catch {
        setLanguageState(detectDeviceLanguage());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  };

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key]
      ?? translations.en[key]
      ?? key; // anahtar bulunamazsa kendisini göster — eksik çeviri fark edilsin
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}