import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RatingInput } from '@/components/rating-input';
import { Textarea } from '@/components/textarea';
import { Button } from '@/components/button';

export interface SellerFeedbackValue {
  rating: number;
  comment?: string;
}

interface SellerFeedbackFormProps {
  submitting?: boolean;
  onSubmit: (value: SellerFeedbackValue) => void;
  onCancel: () => void;
}

const MAX_COMMENT = 2000;

/** Rate the seller (star + optional comment). Rating is required (1–5). */
export function SellerFeedbackForm({ submitting, onSubmit, onCancel }: SellerFeedbackFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('sellerFeedback.ratingRequired'));
      return;
    }
    setError(null);
    onSubmit({ rating, comment: comment.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">{t('sellerFeedback.yourRating')}</span>
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
        label={t('sellerFeedback.commentLabel')}
        placeholder={t('sellerFeedback.commentPlaceholder')}
        value={comment}
        maxLength={MAX_COMMENT}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('sellerFeedback.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('sellerFeedback.submit')}
        </Button>
      </div>
    </form>
  );
}
