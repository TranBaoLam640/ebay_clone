import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface SellerFeedbackImagePickerProps {
  value: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function SellerFeedbackImagePicker({
  value,
  onChange,
  disabled,
}: SellerFeedbackImagePickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previews = useMemo(
    () => value.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [value],
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews],
  );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...value];
    Array.from(files).forEach((file) => {
      if (next.length >= MAX_IMAGES) return;
      if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) return;
      next.push(file);
    });
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text">{t('sellerFeedback.images')}</span>
        <span className="text-xs text-muted">{value.length}/{MAX_IMAGES}</span>
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {previews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2">
              <img src={preview.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                aria-label={t('sellerFeedback.removeImage')}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 rounded-md bg-surface/90 p-1 text-text hover:bg-surface-2"
              >
                <Icon variant="icon-close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={disabled || value.length >= MAX_IMAGES}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || value.length >= MAX_IMAGES}
        className="w-fit"
        onClick={() => inputRef.current?.click()}
      >
        <Icon variant="icon-plus" size={14} />
        {t('sellerFeedback.addImages')}
      </Button>
    </div>
  );
}
