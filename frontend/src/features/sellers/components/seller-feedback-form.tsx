import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { RatingInput } from '@/components/rating-input';
import { Textarea } from '@/components/textarea';
import { cn } from '@/utils/cn';
import {
  type SellerFeedback,
  type SellerFeedbackCommentType,
  type SellerFeedbackFields,
} from '../services/seller-feedback-api';
import { SellerFeedbackImagePicker } from './seller-feedback-image-picker';

export interface SellerFeedbackValue extends SellerFeedbackFields {
  images?: File[];
}

interface SellerFeedbackFormProps {
  mode?: 'create' | 'edit' | 'revision';
  initialValue?: SellerFeedback | null;
  submitting?: boolean;
  allowImages?: boolean;
  onSubmit: (value: SellerFeedbackValue) => void;
  onCancel: () => void;
}

const MAX_COMMENT = 500;
const SENTIMENTS: SellerFeedbackCommentType[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

export function SellerFeedbackForm({
  mode = 'create',
  initialValue,
  submitting,
  allowImages = mode === 'create',
  onSubmit,
  onCancel,
}: SellerFeedbackFormProps) {
  const { t } = useTranslation();
  const [commentType, setCommentType] = useState<SellerFeedbackCommentType>('POSITIVE');
  const [commentText, setCommentText] = useState('');
  const [itemAsDescribedRating, setItemAsDescribedRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [shippingTimeRating, setShippingTimeRating] = useState(0);
  const [shippingAndHandlingChargesRating, setShippingAndHandlingChargesRating] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const requiresDetailedRatings = mode === 'create';
  const missingDetailedRatings =
    requiresDetailedRatings &&
    [
      itemAsDescribedRating,
      communicationRating,
      shippingTimeRating,
      shippingAndHandlingChargesRating,
    ].some((rating) => rating === 0);

  useEffect(() => {
    if (!initialValue) return;
    setCommentType(initialValue.commentType ?? 'POSITIVE');
    setCommentText(initialValue.commentText ?? initialValue.comment ?? '');
    setItemAsDescribedRating(initialValue.itemAsDescribedRating ?? 0);
    setCommunicationRating(initialValue.communicationRating ?? 0);
    setShippingTimeRating(initialValue.shippingTimeRating ?? 0);
    setShippingAndHandlingChargesRating(initialValue.shippingAndHandlingChargesRating ?? 0);
  }, [initialValue]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (missingDetailedRatings) return;
    const payload: SellerFeedbackValue = {
      commentType,
      commentText: commentText.trim() || undefined,
      ...(itemAsDescribedRating > 0 ? { itemAsDescribedRating } : {}),
      ...(communicationRating > 0 ? { communicationRating } : {}),
      ...(shippingTimeRating > 0 ? { shippingTimeRating } : {}),
      ...(shippingAndHandlingChargesRating > 0 ? { shippingAndHandlingChargesRating } : {}),
      ...(allowImages && images.length ? { images } : {}),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text">{t('sellerFeedback.sentiment')}</span>
        <div className="grid grid-cols-3 gap-2">
          {SENTIMENTS.map((sentiment) => (
            <button
              key={sentiment}
              type="button"
              onClick={() => setCommentType(sentiment)}
              className={cn(
                'h-10 rounded-md border px-2 text-sm font-semibold transition-colors',
                commentType === sentiment
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text hover:bg-surface-2',
              )}
            >
              {t(`sellerFeedback.commentType.${sentiment}`)}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label={t('sellerFeedback.commentLabel')}
        placeholder={t('sellerFeedback.commentPlaceholder')}
        value={commentText}
        maxLength={MAX_COMMENT}
        onChange={(e) => setCommentText(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <DsrField
          label={t('sellerFeedback.itemAsDescribed')}
          value={itemAsDescribedRating}
          onChange={setItemAsDescribedRating}
          required={requiresDetailedRatings}
          showError={submitted && itemAsDescribedRating === 0}
        />
        <DsrField
          label={t('sellerFeedback.communication')}
          value={communicationRating}
          onChange={setCommunicationRating}
          required={requiresDetailedRatings}
          showError={submitted && communicationRating === 0}
        />
        <DsrField
          label={t('sellerFeedback.shippingTime')}
          value={shippingTimeRating}
          onChange={setShippingTimeRating}
          required={requiresDetailedRatings}
          showError={submitted && shippingTimeRating === 0}
        />
        <DsrField
          label={t('sellerFeedback.shippingAndHandlingCharges')}
          value={shippingAndHandlingChargesRating}
          onChange={setShippingAndHandlingChargesRating}
          required={requiresDetailedRatings}
          showError={submitted && shippingAndHandlingChargesRating === 0}
        />
      </div>

      {allowImages && (
        <SellerFeedbackImagePicker value={images} onChange={setImages} disabled={submitting} />
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('sellerFeedback.cancel')}
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {t(`sellerFeedback.${mode === 'create' ? 'submit' : 'saveFeedback'}`)}
        </Button>
      </div>
    </form>
  );
}

function DsrField({
  label,
  value,
  onChange,
  required,
  showError,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  showError?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <RatingInput value={value} onChange={onChange} size={22} />
      {showError && <span className="text-xs text-danger">{t('sellerFeedback.ratingRequired')}</span>}
    </div>
  );
}
