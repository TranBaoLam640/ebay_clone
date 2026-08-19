import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/button';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';
import { useToast } from '@/contexts/toast-context';
import { ApiError } from '@/services/types';
import { paths } from '@/routes/paths';
import { formatPrice } from '@/utils/format-price';
import { auctionApi } from '../services/auction-api';

/** "Make Offer" affordance for offers-enabled FIXED listings (buyer half). */
export function MakeOfferButton({
  uuid,
  isAuthenticated,
  stock,
  price,
}: {
  uuid: string;
  isAuthenticated: boolean;
  stock: number;
  price: number;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const createOffer = useMutation({
    mutationFn: () =>
      auctionApi.createOffer(uuid, {
        amount: Number(amount.replace(/\D/g, '')),
        quantity: Number(quantity),
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      notify(t('offer.submitted'), 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError) notify(err.message, 'error');
    },
  });

  if (!isAuthenticated)
    return (
      <Link to={paths.login}>
        <Button variant="secondary" size="lg" fullWidth>
          <Icon variant="icon-tag" size={18} />
          {t('offer.make')}
        </Button>
      </Link>
    );

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onClick={() => setOpen(true)}
      >
        <Icon variant="icon-tag" size={18} />
        {t('offer.make')}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setSubmitted(false);
        }}
        title={t('offer.make')}
        footer={
          submitted ? (
            <Link to={paths.account.offers}>
              <Button variant="accent">{t('offer.viewMyOffers')}</Button>
            </Link>
          ) : (
            <Button
              variant="accent"
              loading={createOffer.isPending}
              onClick={() => createOffer.mutate()}
              disabled={!amount || !Number(quantity)}
            >
              {t('offer.submit')}
            </Button>
          )
        }
      >
        {submitted ? (
          <p className="text-sm text-muted">{t('offer.awaitingResponse')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stock > 1 && (
              <>
                <label
                  className="text-sm font-medium text-text"
                  htmlFor="offer-quantity"
                >
                  Quantity
                </label>
                <input
                  id="offer-quantity"
                  type="number"
                  min={1}
                  max={stock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </>
            )}
            <label
              className="text-sm font-medium text-text"
              htmlFor="offer-amount"
            >
              Offer price per item
            </label>
            <input
              id="offer-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatPrice(0)}
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <p className="text-sm text-muted">
              Original price: {formatPrice(price)} each
            </p>
            <p className="text-sm font-semibold text-text">
              Offer total:{' '}
              {formatPrice(
                Number(amount.replace(/\D/g, '') || 0) * Number(quantity || 1),
              )}
            </p>
            <label
              className="text-sm font-medium text-text"
              htmlFor="offer-message"
            >
              {t('offer.message')}
            </label>
            <textarea
              id="offer-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
