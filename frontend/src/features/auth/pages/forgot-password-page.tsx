import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { authApi } from '../services/auth-api';
import { messageFromError } from '../utils/auth-errors';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';

/**
 * Step 1 of password reset: enter the account email to receive an OTP. Always
 * proceeds to the reset step (the backend never reveals whether the email
 * exists), carrying the email in router state.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      notify(t('auth.forgotPasswordSuccess'), 'success');
      navigate(paths.resetPassword, { state: { email } });
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.resendFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-text">{t('auth.forgotPasswordTitle')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.forgotPasswordSubtitle')}</p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label={t('auth.emailLabel')}
          type="email"
          autoComplete="email"
          leadingIcon="icon-mail"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {t('auth.sendResetButton')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to={paths.login} className="text-muted hover:text-text">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
