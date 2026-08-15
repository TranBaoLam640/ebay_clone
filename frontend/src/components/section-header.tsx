import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon } from './icon';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  linkTo?: string;
  linkLabel?: string;
  align?: 'left' | 'center';
}

/** Consistent heading block for homepage sections. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  linkTo,
  linkLabel,
  align = 'left',
}: SectionHeaderProps) {
  const { t } = useTranslation();
  const resolvedLinkLabel = linkLabel ?? t('common.seeAll');
  const centered = align === 'center';
  return (
    <div
      className={`mb-6 flex flex-col gap-2 ${centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'}`}
    >
      <div className={centered ? 'max-w-2xl' : ''}>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Icon variant="icon-sparkles" size={14} />
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl font-extrabold text-text md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-muted">{description}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {resolvedLinkLabel}
          <Icon variant="icon-arrow-right" size={16} />
        </Link>
      )}
    </div>
  );
}
