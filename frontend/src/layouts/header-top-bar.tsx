import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icon';

/** Thin promotional/utility bar above the main header. */
export function HeaderTopBar() {
  const { t } = useTranslation();
  return (
    <div className="hidden bg-primary text-on-primary md:block">
      <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between px-4 text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <Icon variant="icon-truck" size={14} />
          {t('topBar.freeShipping')}
        </p>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <Icon variant="icon-phone" size={13} />
            1900 6868
          </span>
          <span className="flex items-center gap-1.5">
            <Icon variant="icon-lock" size={13} />
            {t('topBar.secureTransactions')}
          </span>
        </div>
      </div>
    </div>
  );
}
