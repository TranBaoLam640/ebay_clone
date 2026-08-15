/**
 * Supported UI languages — the single source of truth for the language switcher
 * and i18n resources. To add a language later:
 *   1. Add its `locales/<code>.json` file.
 *   2. Register it in `resources` in `./index.ts`.
 *   3. Append an entry here (code, label, flag).
 * The switcher renders straight from this list, so no UI change is needed.
 */
export interface LanguageOption {
  code: string;
  /** Native name shown in the switcher (e.g. "English", "Tiếng Việt"). */
  label: string;
  /** Short code shown on the collapsed button (e.g. "EN"). */
  short: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { code: 'zh', label: '中文', short: 'CN' },
  { code: 'jp', label: '日本語', short: 'JP' },
];

export const LANGUAGE_STORAGE_KEY = 'sbay-lang';
