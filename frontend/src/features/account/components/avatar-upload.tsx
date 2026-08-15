import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadApi } from '@/services/upload-api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';

interface AvatarUploadProps {
  /** Current avatar URL (may be empty). */
  value: string;
  name?: string;
  /** Called with the new public URL after a successful upload. */
  onChange: (url: string) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';

/** Pick an image → upload to storage → hand back the public URL. */
export function AvatarUpload({ value, name, onChange }: AvatarUploadProps) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notify(t('account.avatarTooLarge'), 'error');
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadApi.avatar(file);
      onChange(url);
      notify(t('account.avatarUploaded'), 'success');
    } catch (err) {
      notify(messageFromError(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar src={value || undefined} name={name} size={64} />
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFile}
          className="hidden"
        />
        <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={pick}>
          <Icon variant="icon-camera" size={16} />
          {t('account.uploadAvatar')}
        </Button>
        <p className="text-xs text-muted">{t('account.avatarUploadHint')}</p>
      </div>
    </div>
  );
}
