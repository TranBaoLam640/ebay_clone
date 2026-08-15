import type { AddressInput } from '../services/address-api';

/** i18n keys (under `account.validation.*`) mapped per address field. */
export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

/**
 * Vietnamese mobile/landline: optional +84 or leading 0, then 9–10 digits.
 * Spaces, dots and dashes are stripped before matching so users can format freely.
 */
const PHONE_RE = /^(?:\+?84|0)\d{9,10}$/;
/** 4–10 digits; optional field, only validated when a value is present. */
const POSTAL_RE = /^\d{4,10}$/;

const stripSeparators = (v: string) => v.replace(/[\s.\-()]/g, '');

/** Validate a trimmed address payload; returns field → i18n key for each error. */
export function validateAddress(input: AddressInput): AddressErrors {
  const errors: AddressErrors = {};

  const name = input.recipientName.trim();
  if (!name) errors.recipientName = 'account.validation.recipientNameRequired';
  else if (name.length < 2) errors.recipientName = 'account.validation.recipientNameTooShort';
  else if (name.length > 60) errors.recipientName = 'account.validation.recipientNameTooLong';

  const phone = input.phone.trim();
  if (!phone) errors.phone = 'account.validation.phoneRequired';
  else if (!PHONE_RE.test(stripSeparators(phone))) errors.phone = 'account.validation.phoneInvalid';

  const line = input.addressLine.trim();
  if (!line) errors.addressLine = 'account.validation.addressLineRequired';
  else if (line.length < 5) errors.addressLine = 'account.validation.addressLineTooShort';

  if (!input.ward.trim()) errors.ward = 'account.validation.wardRequired';
  if (!input.district.trim()) errors.district = 'account.validation.districtRequired';
  if (!input.province.trim()) errors.province = 'account.validation.provinceRequired';
  if (!input.country.trim()) errors.country = 'account.validation.countryRequired';

  const postal = input.postalCode?.trim();
  if (postal && !POSTAL_RE.test(postal)) errors.postalCode = 'account.validation.postalCodeInvalid';

  return errors;
}

/** Trim all string fields so stored data has no leading/trailing whitespace. */
export function trimAddress(input: AddressInput): AddressInput {
  return {
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    ward: input.ward.trim(),
    district: input.district.trim(),
    province: input.province.trim(),
    country: input.country.trim(),
    postalCode: input.postalCode?.trim() || '',
  };
}
