import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { paths } from '@/routes/paths';
import NotFoundPage from './not-found-page';

/**
 * Router-level error boundary. Renders for any error thrown while matching or
 * rendering a route (loader/render errors, and 404s from unmatched paths). A
 * 404 response falls through to the dedicated <NotFoundPage>; everything else
 * shows a friendly generic error with recovery actions, instead of React
 * Router's bare default screen.
 */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();

  // Unmatched route → keep the familiar 404 page.
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-danger">!</p>
      <h1 className="mt-3 text-2xl font-bold text-text">{t('errorPage.title')}</h1>
      <p className="mt-2 text-muted">{t('errorPage.description')}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={() => window.location.reload()}>
          {t('errorPage.reload')}
        </Button>
        <Link to={paths.home}>
          <Button size="lg" variant="secondary">
            {t('errorPage.backHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
