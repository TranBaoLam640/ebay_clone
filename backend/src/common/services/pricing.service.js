export const calculateDiscount = (coupon, subtotal) => {
  const raw =
    coupon.discountType === 'PERCENTAGE'
      ? Math.floor((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;
  return Math.min(raw, coupon.maxDiscount ?? raw, subtotal);
};

export const allocateDiscount = (groups, discount) => {
  let allocated = 0;
  return groups.map((group, index) => {
    const value =
      index === groups.length - 1
        ? discount - allocated
        : Math.min(
            Math.floor(
              (discount * group.subtotal) /
                groups.reduce((sum, item) => sum + item.subtotal, 0),
            ),
            group.subtotal,
          );
    allocated += value;
    return { ...group, discount: value, total: group.subtotal - value };
  });
};
