import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddresses } from '../hooks/use-addresses';
import { AddressForm } from '../components/address-form';
import type { Address, AddressInput } from '../services/address-api';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/contexts/toast-context';
import { messageFromError } from '@/features/auth/utils/auth-errors';

/** Manage delivery addresses: list, add, edit, delete, set default. */
export default function AddressesPage() {
  const { t } = useTranslation();
  const { list, create, update, remove, setDefault } = useAddresses();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Address | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (data: AddressInput) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data });
        notify(t('account.addressUpdatedToast'), 'success');
      } else {
        await create.mutateAsync(data);
        notify(t('account.addressAddedToast'), 'success');
      }
      closeForm();
    } catch (err) {
      notify(messageFromError(err), 'error');
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-xl font-bold text-text">{t('account.addressesTitle')}</h2>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Icon variant="icon-plus" size={16} />
          {/* Full label on wider screens; icon carries it on narrow phones. */}
          <span className="hidden sm:inline">{t('account.addAddressFull')}</span>
          <span className="sm:hidden">{t('account.addAddressShort')}</span>
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="icon-map-pin"
          title={t('account.noAddressesTitle')}
          description={t('account.noAddressesDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data!.map((addr) => (
            <li key={addr.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{addr.recipientName}</span>
                    <span className="text-sm text-muted">{addr.phone}</span>
                    {addr.isDefault && <Badge tone="primary">{t('account.defaultBadge')}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {addr.addressLine}, {addr.ward}, {addr.district}, {addr.province}, {addr.country}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconBtn label={t('account.editLabel')} icon="icon-edit" onClick={() => { setEditing(addr); setShowForm(true); }} />
                  <IconBtn label={t('account.deleteLabel')} icon="icon-trash" onClick={() => setConfirmDelete(addr)} />
                </div>
              </div>
              {!addr.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setDefault.mutate(addr.id)}
                >
                  {t('account.setAsDefault')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal size="lg" open={showForm} onClose={closeForm} title={editing ? t('account.modalEditAddress') : t('account.modalAddAddress')}>
        <AddressForm
          initial={editing ?? undefined}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('account.modalDeleteTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {t('account.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={async () => {
                if (!confirmDelete) return;
                await remove.mutateAsync(confirmDelete.id);
                notify(t('account.addressDeletedToast'), 'success');
                setConfirmDelete(null);
              }}
            >
              {t('account.delete')}
            </Button>
          </>
        }
      >
        {t('account.deleteConfirmMessage', { name: confirmDelete?.recipientName })}
      </Modal>
    </div>
  );
}

function IconBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'icon-edit' | 'icon-trash';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <Icon variant={icon} size={18} />
    </button>
  );
}
