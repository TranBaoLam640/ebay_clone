import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RatingInput } from '@/components/rating-input';
import { Input } from '@/components/input';
import { Textarea } from '@/components/textarea';
import { Button } from '@/components/button';

export interface ReviewFormValue {
  rating: number;
  title: string;
  description: string;
}

interface ReviewFormProps {
  submitting?: boolean;
  onSubmit: (value: ReviewFormValue) => void;
  onCancel: () => void;
}

const MAX_COMMENT = 2000;
const MAX_TITLE = 120;

/** Product review form. Rating, title, and description are required. */
export function ReviewForm({ submitting, onSubmit, onCancel }: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{
    rating?: string;
    title?: string;
    description?: string;
  }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const nextErrors: typeof errors = {};
    if (rating < 1) {
      nextErrors.rating = t('reviews.ratingRequired');
    }
    if (!trimmedTitle) {
      nextErrors.title = t('reviews.titleRequired');
    }
    if (!trimmedDescription) {
      nextErrors.description = t('reviews.descriptionRequired');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({ rating, title: trimmedTitle, description: trimmedDescription });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">{t('reviews.yourRating')}</span>
        <RatingInput
          value={rating}
          onChange={(v) => {
            setRating(v);
            setErrors((current) => ({ ...current, rating: undefined }));
          }}
        />
        {errors.rating && <p className="text-xs text-danger">{errors.rating}</p>}
      </div>

      <Input
        label={t('reviews.titleLabel')}
        placeholder={t('reviews.titlePlaceholder')}
        value={title}
        maxLength={MAX_TITLE}
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          setErrors((current) => ({ ...current, title: undefined }));
        }}
      />

      <Textarea
        label={t('reviews.descriptionLabel')}
        placeholder={t('reviews.descriptionPlaceholder')}
        value={description}
        maxLength={MAX_COMMENT}
        error={errors.description}
        onChange={(e) => {
          setDescription(e.target.value);
          setErrors((current) => ({ ...current, description: undefined }));
        }}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('reviews.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('reviews.submit')}
        </Button>
      </div>
    </form>
  );
}
