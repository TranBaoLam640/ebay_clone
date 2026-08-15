import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Price } from '@/components/price';

interface PayPalApprovalModalProps {
  open: boolean;
  amount: number;
  approving?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

/**
 * Simulated PayPal approval step. The backend uses a PayPal *simulation*
 * provider, so this stands in for the real hosted approval page: the buyer
 * reviews the amount and approves, which triggers the capture call.
 */
export function PayPalApprovalModal({
  open,
  amount,
  approving,
  onApprove,
  onCancel,
}: PayPalApprovalModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onCancel} title={t('checkout.paypalApproveTitle')}>
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        {/* PayPal-style brand lockup (wordmark, no external asset). */}
        <div className="flex items-center gap-0.5 text-2xl font-extrabold tracking-tight">
          <Icon variant="icon-lock" size={22} className="mr-1 text-[#003087]" />
          <span className="text-[#003087]">Pay</span>
          <span className="text-[#009cde]">Pal</span>
        </div>

        <p className="text-sm text-muted">{t('checkout.paypalApproveSubtitle')}</p>

        <div className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{t('checkout.total')}</span>
            <Price cents={amount} className="text-lg" />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            fullWidth
            size="lg"
            loading={approving}
            onClick={onApprove}
            className="!bg-[#0070ba] !text-white hover:!bg-[#005ea6]"
          >
            {t('checkout.paypalApproveButton')}
          </Button>
          <Button fullWidth variant="ghost" disabled={approving} onClick={onCancel}>
            {t('checkout.paypalCancelButton')}
          </Button>
        </div>

        <p className="text-xs text-muted">{t('checkout.paypalSimulationNote')}</p>
      </div>
    </Modal>
  );
}
