import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { useAuth } from '../hooks/use-auth';
import { authApi } from '../services/auth-api';
import { messageFromError } from '../utils/auth-errors';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';

/**
 * Email OTP verification step. The email arrives via router state (from
 * register/login). A 6-digit OTP is verified, then the user is sent to login.
 * Resend is gated by a client-side cooldown countdown.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { verifyEmail } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) navigate(paths.register, { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyEmail.mutateAsync({ email, otp });
      notify(t('auth.verifyEmailSuccess'), 'success');
      navigate(paths.login, { replace: true, state: { email } });
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.otpInvalid')));
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await authApi.resendVerification(email);
      notify(t('auth.resendSuccess'), 'success');
      setCooldown(60);
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.resendFailed')));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-text">{t('auth.verifyEmailTitle')}</h1>
      <p className="mt-1 text-sm text-muted">
        <Trans
          i18nKey="auth.verifyEmailSubtitle"
          values={{ email }}
          components={{ em: <span className="font-semibold text-text" /> }}
        />
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label={t('auth.otpLabel')}
          inputMode="numeric"
          maxLength={6}
          required
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="text-center text-lg tracking-[0.4em]"
        />
        <Button type="submit" fullWidth loading={verifyEmail.isPending} disabled={otp.length !== 6}>
          {t('auth.verifyButton')}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted">
        {t('auth.noCode')}{' '}
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className="font-semibold text-primary hover:underline disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? t('auth.resendCooldown', { count: cooldown }) : t('auth.resendButton')}
        </button>
      </div>

      <p className="mt-2 text-center text-sm">
        <Link to={paths.login} className="text-muted hover:text-text">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
