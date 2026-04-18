'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { ar } from './ar';

type Lang = 'en' | 'ar';
type Translations = Record<TranslationKey, string>;

interface I18nContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  t: en as Translations,
  toggleLang: () => {},
  isRTL: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('vault_lang') as Lang | null;
    if (saved === 'ar' || saved === 'en') setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('vault_lang', lang);
  }, [lang]);

  const toggleLang = () => setLang(prev => (prev === 'en' ? 'ar' : 'en'));

  return (
    <I18nContext.Provider
      value={{ lang, t: (lang === 'ar' ? ar : en) as Translations, toggleLang, isRTL: lang === 'ar' }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export const useTranslation = () => useContext(I18nContext);
