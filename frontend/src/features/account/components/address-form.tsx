import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Address, AddressInput } from '../services/address-api';
import { validateAddress, trimAddress, type AddressErrors } from '../utils/validate-address';
import { Input } from '@/components/input';
import { Button } from '@/components/button';

interface AddressFormProps {
  initial?: Address;
  submitting?: boolean;
  onSubmit: (data: AddressInput) => void;
  onCancel: () => void;
}

const EMPTY: AddressInput = {
  recipientName: '',
  phone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  country: 'Vietnam',
  postalCode: '',
};

/** Create/edit form for a delivery address. */
export function AddressForm({ initial, submitting, onSubmit, onCancel }: AddressFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AddressInput>(
    initial
      ? {
          recipientName: initial.recipientName,
          phone: initial.phone,
          addressLine: initial.addressLine,
          ward: initial.ward,
          district: initial.district,
          province: initial.province,
          country: initial.country,
          postalCode: initial.postalCode ?? '',
        }
      : EMPTY,
  );

  const [errors, setErrors] = useState<AddressErrors>({});

  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [key]: value }));
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  /** Translate a stored i18n key into the current language, if the field has an error. */
  const errText = (key: keyof AddressInput) => (errors[key] ? t(errors[key]!) : undefined);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateAddress(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    onSubmit(trimAddress(form));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('account.fieldRecipientName')} value={form.recipientName} onChange={set('recipientName')} error={errText('recipientName')} required />
        <Input label={t('account.fieldPhone')} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errText('phone')} required />
      </div>
      <Input label={t('account.fieldAddressLine')} value={form.addressLine} onChange={set('addressLine')} error={errText('addressLine')} required />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label={t('account.fieldWard')} value={form.ward} onChange={set('ward')} error={errText('ward')} required />
        <Input label={t('account.fieldDistrict')} value={form.district} onChange={set('district')} error={errText('district')} required />
        <Input label={t('account.fieldProvince')} value={form.province} onChange={set('province')} error={errText('province')} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('account.fieldCountry')} value={form.country} onChange={set('country')} error={errText('country')} required />
        <Input label={t('account.fieldPostalCode')} inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} error={errText('postalCode')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('account.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? t('account.save') : t('account.addAddressFull')}
        </Button>
      </div>
    </form>
  );
}
