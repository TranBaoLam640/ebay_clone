import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Coupon } from '../modules/coupons/coupon.model.js';

const now = new Date();
const activeStart = new Date('2020-01-01T00:00:00.000Z');
const activeEnd = new Date('2099-12-31T23:59:59.000Z');

const coupons = [
  {
    code: 'SAVE10',
    description: 'Giảm 10% cho đơn test',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startsAt: activeStart,
    expiresAt: activeEnd,
    perUserLimit: 3,
    status: 'ACTIVE',
  },
  {
    code: 'SAVE20CAP',
    description: 'Giảm 20%, tối đa 200.000 VND',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscount: 200000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    perUserLimit: 5,
    status: 'ACTIVE',
  },
  {
    code: 'FIXED100K',
    description: 'Giảm cố định 100.000 VND',
    discountType: 'FIXED_AMOUNT',
    discountValue: 100000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'ACTIVE',
  },
  {
    code: 'MIN500K',
    description: 'Giảm 50.000 VND cho đơn từ 500.000 VND',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50000,
    minOrderValue: 500000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'ACTIVE',
  },
  {
    code: 'BIGORDER',
    description: 'Giảm 500.000 VND cho đơn từ 10.000.000 VND',
    discountType: 'FIXED_AMOUNT',
    discountValue: 500000,
    minOrderValue: 10000000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'ACTIVE',
  },
  {
    code: 'EXPIRED',
    description: 'Coupon đã hết hạn để test lỗi',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    startsAt: new Date('2020-01-01T00:00:00.000Z'),
    expiresAt: new Date('2021-01-01T00:00:00.000Z'),
    status: 'ACTIVE',
  },
  {
    code: 'INACTIVE',
    description: 'Coupon inactive để test lỗi',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'INACTIVE',
  },
  {
    code: 'SOLDOUT',
    description: 'Coupon đã hết lượt để test usage limit',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    usageLimit: 1,
    usageCount: 1,
    perUserLimit: 1,
    status: 'ACTIVE',
  },
];

const seedCoupons = async () => {
  await connectDatabase();
  await Coupon.bulkWrite(
    coupons.map((coupon) => ({
      updateOne: {
        filter: { code: coupon.code },
        update: {
          $set: {
            ...coupon,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    })),
  );
};

try {
  await seedCoupons();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
