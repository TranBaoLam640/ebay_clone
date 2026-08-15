import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Icon } from './icon';

/** Light/dark theme switch button for the header. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2"
      aria-label={isDark ? t('common.switchToLight') : t('common.switchToDark')}
      title={isDark ? t('common.themeLight') : t('common.themeDark')}
    >
      <Icon variant={isDark ? 'icon-sun' : 'icon-moon'} size={20} />
    </button>
  );
}
