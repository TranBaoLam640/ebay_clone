import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/features/auth/services/auth-api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { AvatarUpload } from '../components/avatar-upload';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';

/** Edit basic profile fields: full name, phone, and uploaded avatar. */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notify } = useToast();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user]);

  const update = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        fullName,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['auth', 'me'], updated);
      notify(t('account.profileSavedToast'), 'success');
    },
    onError: (err) => setError(messageFromError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate();
  };

  return (
    <div className="max-w-lg">
      <h2 className="mb-1 text-xl font-bold text-text">{t('account.profileTitle')}</h2>
      <p className="mb-6 text-sm text-muted">{t('account.profileSubtitle')}</p>

      <div className="mb-6">
        <p className="font-semibold text-text">{user?.email}</p>
        <p className="mb-4 text-sm text-muted">{t('account.emailCannotChange')}</p>
        {/* Uploading immediately updates the avatar URL; Save persists it with
            the rest of the profile fields. */}
        <AvatarUpload
          value={avatarUrl || user?.avatarUrl || ''}
          name={fullName || user?.fullName}
          onChange={setAvatarUrl}
        />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input label={t('account.fieldFullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label={t('account.fieldPhone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('account.phonePlaceholder')} />
        <Button type="submit" loading={update.isPending} className="w-fit">
          {t('account.saveChanges')}
        </Button>
      </form>
    </div>
  );
}
