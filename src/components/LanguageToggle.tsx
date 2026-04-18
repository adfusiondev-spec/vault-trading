'use client';
import { useTranslation } from '@/lib/i18n';

export function LanguageToggle() {
  const { lang, toggleLang } = useTranslation();
  return (
    <button
      onClick={toggleLang}
      title="Switch language"
      style={{
        background: 'transparent',
        border: '1px solid #FFD700',
        color: '#FFD700',
        borderRadius: '6px',
        padding: '4px 14px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '13px',
        letterSpacing: '0.5px',
        flexShrink: 0,
      }}
    >
      {lang === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
