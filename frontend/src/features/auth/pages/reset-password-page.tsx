import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { authApi } from '../services/auth-api';
import { messageFromError, validatePassword } from '../utils/auth-errors';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';

/**
 * Step 2 of password reset: enter the 6-digit OTP and a new password. The email
 * comes from router state (forgot-password step). Resend is gated by a
 * client-side cooldown, mirroring the verify-email page.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Reached directly without an email → send the user back to step 1.
  useEffect(() => {
    if (!email) navigate(paths.forgotPassword, { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const policy = validatePassword(newPassword);
    if (policy) {
      setError(policy);
      return;
    }
    if (newPassword !== confirm) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword });
      notify(t('auth.resetPasswordSuccess'), 'success');
      navigate(paths.login, { replace: true, state: { email } });
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.otpInvalid')));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await authApi.resendResetPassword(email);
      notify(t('auth.forgotPasswordSuccess'), 'success');
      setCooldown(60);
    } catch (err) {
      setError(messageFromError(err, t('auth.errors.resendFailed')));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-text">{t('auth.resetPasswordTitle')}</h1>
      <p className="mt-1 text-sm text-muted">
        <Trans
          i18nKey="auth.resetPasswordSubtitle"
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
        <Input
          label={t('auth.newPasswordLabel')}
          type="password"
          autoComplete="new-password"
          leadingIcon="icon-lock"
          placeholder="••••••••"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint={t('auth.passwordHint')}
        />
        <Input
          label={t('auth.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          leadingIcon="icon-lock"
          placeholder="••••••••"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" fullWidth loading={submitting} disabled={otp.length !== 6}>
          {t('auth.resetButton')}
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
