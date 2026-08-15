import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icon';
import { paths } from '@/routes/paths';

/** Global product search box. Submits to the product list with a `search` query. */
export function HeaderSearch() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `${paths.products}?search=${encodeURIComponent(q)}` : paths.products);
  };

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon variant="icon-search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        className="h-10 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-text placeholder:text-muted transition-colors focus:border-primary focus:outline-none"
      />
    </form>
  );
}
