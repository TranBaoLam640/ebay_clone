import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RatingInput } from '@/components/rating-input';
import { Textarea } from '@/components/textarea';
import { Button } from '@/components/button';

export interface ReviewFormValue {
  rating: number;
  comment?: string;
}

interface ReviewFormProps {
  submitting?: boolean;
  onSubmit: (value: ReviewFormValue) => void;
  onCancel: () => void;
}

const MAX_COMMENT = 2000;

/** Star rating + optional comment. Rating is required (1–5). */
export function ReviewForm({ submitting, onSubmit, onCancel }: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('reviews.ratingRequired'));
      return;
    }
    setError(null);
    const trimmed = comment.trim();
    onSubmit({ rating, comment: trimmed || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">{t('reviews.yourRating')}</span>
        <RatingInput
          value={rating}
          onChange={(v) => {
            setRating(v);
            setError(null);
          }}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <Textarea
        label={t('reviews.commentLabel')}
        placeholder={t('reviews.commentPlaceholder')}
        value={comment}
        maxLength={MAX_COMMENT}
        onChange={(e) => setComment(e.target.value)}
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
