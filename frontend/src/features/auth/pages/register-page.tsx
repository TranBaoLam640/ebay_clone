import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { useAuth } from '../hooks/use-auth';
import { messageFromError, validateEmail, validatePassword } from '../utils/auth-errors';
import { paths } from '@/routes/paths';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr ?? undefined, password: passErr ?? undefined });
      return;
    }
    setFieldErrors({});
    try {
      await register.mutateAsync({ fullName, email, password });
      navigate(paths.verifyEmail, { state: { email } });
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.registerFallback')));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-text">{t('auth.registerTitle')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.registerSubtitle')}</p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label={t('auth.fullNameLabel')}
          autoComplete="name"
          leadingIcon="icon-user"
          placeholder={t('auth.fullNamePlaceholder')}
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label={t('auth.emailLabel')}
          type="email"
          autoComplete="email"
          leadingIcon="icon-mail"
          placeholder="you@example.com"
          required
          error={fieldErrors.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={t('auth.passwordLabel')}
          type="password"
          autoComplete="new-password"
          leadingIcon="icon-lock"
          placeholder="••••••••"
          required
          error={fieldErrors.password}
          hint={t('auth.passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" fullWidth size="lg" loading={register.isPending}>
          {t('auth.registerButton')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.hasAccount')}{' '}
        <Link to={paths.login} className="font-semibold text-primary hover:underline">
          {t('auth.loginLink')}
        </Link>
      </p>
    </div>
  );
}
