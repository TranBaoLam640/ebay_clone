import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';
import jp from './locales/ja.json';
import { LANGUAGES, LANGUAGE_STORAGE_KEY } from './languages';

/**
 * App-wide i18n setup. English is the only bundled locale for now; the structure
 * (namespaced JSON + i18next) lets extra languages drop in later without code
 * changes — add a `locales/<lang>.json` and register it in `resources`.
 */

// Restore the user's saved language, falling back to English if it's unknown
// (e.g. a language that was removed since it was stored).
function initialLanguage(): string {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved && LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
    zh: { translation: zh },
    jp: { translation: jp },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values, so i18next escaping would double-encode.
    escapeValue: false,
  },
});

// Persist the choice and keep <html lang> in sync for accessibility/SEO.
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;
