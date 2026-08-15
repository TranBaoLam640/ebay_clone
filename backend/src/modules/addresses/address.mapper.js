export const toAddressSnapshot = (address) => {
  const source = address?.toObject ? address.toObject() : address;
  return {
    fullName: source.fullName ?? source.recipientName,
    phone: source.phone,
    addressLine: source.addressLine,
    ward: source.ward,
    district: source.district,
    province: source.province,
    country: source.country,
    ...(source.postalCode && { postalCode: source.postalCode }),
  };
};
