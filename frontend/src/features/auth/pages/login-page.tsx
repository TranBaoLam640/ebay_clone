import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { useAuth } from '../hooks/use-auth';
import { messageFromError } from '../utils/auth-errors';
import { ApiError } from '@/services/types';
import { defaultPathForRole, paths } from '@/routes/paths';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, refetchMe } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      const me = await refetchMe();
      navigate(from ?? defaultPathForRole(me.data?.role), { replace: true });
    } catch (err) {
      // Email not verified → route the user to the OTP step.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        navigate(paths.verifyEmail, { state: { email } });
        return;
      }
      setError(messageFromError(err, t('auth.errors.loginFallback')));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-text">{t('auth.loginTitle')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.loginSubtitle')}</p>

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
        <Input
          label={t('auth.passwordLabel')}
          type="password"
          autoComplete="current-password"
          leadingIcon="icon-lock"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="-mt-1 text-right">
          <Link to={paths.forgotPassword} className="text-sm text-primary hover:underline">
            {t('auth.forgotPasswordLink')}
          </Link>
        </div>
        <Button type="submit" fullWidth size="lg" loading={login.isPending}>
          {t('auth.loginButton')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to={paths.register} className="font-semibold text-primary hover:underline">
          {t('auth.registerLink')}
        </Link>
      </p>
    </div>
  );
}
