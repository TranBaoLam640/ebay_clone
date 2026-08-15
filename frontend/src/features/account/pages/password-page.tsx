import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/features/auth/services/auth-api';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { useToast } from '@/contexts/toast-context';
import { messageFromError, validatePassword } from '@/features/auth/utils/auth-errors';

/** Change password form with client-side policy check and confirmation. */
export default function PasswordPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      notify(t('account.passwordChangedToast'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    },
    onError: (err) => setError(messageFromError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const policy = validatePassword(newPassword);
    if (policy) return setError(policy);
    if (newPassword !== confirm) return setError(t('account.passwordMismatch'));
    change.mutate();
  };

  return (
    <div className="max-w-lg">
      <h2 className="mb-1 text-xl font-bold text-text">{t('account.passwordTitle')}</h2>
      <p className="mb-6 text-sm text-muted">{t('account.passwordSubtitle')}</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label={t('account.fieldCurrentPassword')}
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          label={t('account.fieldNewPassword')}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint={t('account.passwordHint')}
          required
        />
        <Input
          label={t('account.fieldConfirmPassword')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" loading={change.isPending} className="w-fit">
          {t('account.updatePassword')}
        </Button>
      </form>
    </div>
  );
}
