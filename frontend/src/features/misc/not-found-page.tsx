import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { paths } from '@/routes/paths';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-3 text-2xl font-bold text-text">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted">{t('notFound.description')}</p>
      <Link to={paths.home} className="mt-6">
        <Button size="lg">{t('notFound.backHome')}</Button>
      </Link>
    </div>
  );
}
