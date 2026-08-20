import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { hashPassword } from '../common/utils/hash.js';
import { User } from '../modules/users/user.model.js';
import { Category } from '../modules/categories/category.model.js';
import { SellerProfile } from '../modules/sellers/seller-profile.model.js';
import { Product } from '../modules/products/product.model.js';
import { Coupon } from '../modules/coupons/coupon.model.js';
import {
  isStorageConfigured,
  publicBaseUrl,
  storageClient,
} from '../modules/uploads/storage-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productAssetDir = path.resolve(__dirname, '../../seed-assets/products');
const now = new Date();
const activeStart = new Date('2020-01-01T00:00:00.000Z');
const activeEnd = new Date('2099-12-31T23:59:59.000Z');
const expiredStart = new Date('2020-01-01T00:00:00.000Z');
const expiredEnd = new Date('2021-01-01T00:00:00.000Z');
const password = 'Strong1!Password';

const mimeByExt = new Map([
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
]);

const ids = Object.freeze({
  adminUser: new mongoose.Types.ObjectId('680000000000000000000001'),
  buyerOne: new mongoose.Types.ObjectId('680000000000000000000002'),
  buyerTwo: new mongoose.Types.ObjectId('680000000000000000000003'),
  sellerUserOne: new mongoose.Types.ObjectId('680000000000000000000011'),
  sellerUserTwo: new mongoose.Types.ObjectId('680000000000000000000012'),
  sellerUserThree: new mongoose.Types.ObjectId('680000000000000000000013'),
  sellerUserFour: new mongoose.Types.ObjectId('680000000000000000000014'),
  sellerOne: new mongoose.Types.ObjectId('680000000000000000000021'),
  sellerTwo: new mongoose.Types.ObjectId('680000000000000000000022'),
  sellerThree: new mongoose.Types.ObjectId('680000000000000000000023'),
  sellerFour: new mongoose.Types.ObjectId('680000000000000000000024'),
});

const rootCategories = [
  ['Electronics', 'electronics'],
  ['Fashion', 'fashion'],
  ['Home & Living', 'home-living'],
  ['Beauty & Health', 'beauty-health'],
  ['Sports & Outdoors', 'sports-outdoors'],
  ['Books & Hobbies', 'books-hobbies'],
];

const childCategories = {
  electronics: [
    ['Phones', 'phones'],
    ['Laptops', 'laptops'],
    ['Cameras', 'cameras'],
    ['Audio', 'audio'],
    ['Wearables', 'wearables'],
  ],
  fashion: [
    ['Shoes', 'shoes'],
    ['Bags', 'bags'],
    ['Watches', 'watches'],
    ['Accessories', 'accessories'],
  ],
  'home-living': [
    ['Furniture', 'furniture'],
    ['Kitchen', 'kitchen'],
    ['Decor', 'decor'],
    ['Garden', 'garden'],
  ],
  'beauty-health': [
    ['Skincare', 'skincare'],
    ['Fragrance', 'fragrance'],
    ['Personal Care', 'personal-care'],
  ],
  'sports-outdoors': [
    ['Fitness', 'fitness'],
    ['Camping', 'camping'],
    ['Outdoor Gear', 'outdoor-gear'],
  ],
  'books-hobbies': [
    ['Books', 'books'],
    ['Toys', 'toys'],
    ['Collectibles', 'collectibles'],
  ],
};

const productTemplates = [
  ['Samsung Galaxy S23', 'phones', 12990000],
  ['Aero 15 Creator Laptop', 'laptops', 24500000],
  ['Canon Travel Camera', 'cameras', 8900000],
  ['Sony Compact Camera L1600', 'cameras', 6400000],
  ['Wireless Audio Headphones', 'audio', 1890000],
  ['Galaxy Watch 7', 'wearables', 6290000],
  ['Jordan Street Sneakers', 'shoes', 4200000],
  ['Vintage Leather Shoes', 'shoes', 1550000],
  ['Louis Vuitton City Bag', 'bags', 18900000],
  ['Marc Jacobs Tote', 'bags', 6500000],
  ['Richard Miles L500 Watch', 'watches', 8200000],
  ['Japanese Steel Scissors', 'accessories', 390000],
  ['Modern Sofa Furniture', 'furniture', 9900000],
  ['High Heel Accent Chair', 'furniture', 3490000],
  ['Bubble House Decor Lamp', 'decor', 1290000],
  ['Old Vintage Decor Set', 'decor', 760000],
  ['Bonsai Desk Plant', 'garden', 550000],
  ['Sushi Roller Kit', 'kitchen', 230000],
  ['Firming Face Serum', 'skincare', 490000],
  ['White Fade Day Cream', 'skincare', 350000],
  ['Alien Flora Fragrance', 'fragrance', 1450000],
  ['Weight Analysis Smart Scale', 'personal-care', 790000],
  ['Sleeping Bag Pro', 'camping', 950000],
  ['Portable Camping Chair', 'outdoor-gear', 620000],
  ['Home Fitness Weight Set', 'fitness', 1250000],
  ['Gravity Fall Book', 'books', 280000],
  ['Golden Toy Figure', 'toys', 450000],
  ['Toy Soldier Collection', 'collectibles', 520000],
  ['Battle Royale Game Kit', 'toys', 390000],
  ['Six-Tube Pedal Board', 'collectibles', 2100000],
  ['Premium Phone Bundle', 'phones', 15990000],
  ['Student Laptop Pack', 'laptops', 13500000],
  ['Mirrorless Camera Starter Kit', 'cameras', 15400000],
  ['Daily Carry Backpack', 'bags', 890000],
  ['Minimal Silver Watch', 'watches', 1750000],
  ['Nordic Coffee Table', 'furniture', 2400000],
  ['Ceramic Kitchen Set', 'kitchen', 690000],
  ['Garden Bonsai Gift Box', 'garden', 890000],
  ['Hydrating Skincare Duo', 'skincare', 720000],
  ['Trail Camping Bundle', 'camping', 1790000],
  ['Strength Training Kit', 'fitness', 2200000],
  ['Classic Novel Collection', 'books', 610000],
  ['Collector Robot Toy', 'collectibles', 990000],
  ['Smartphone Photography Kit', 'phones', 2650000],
  ['Office Comfort Chair', 'furniture', 3100000],
  ['Running Shoes Lite', 'shoes', 1290000],
  ['Luxury Perfume Gift Set', 'fragrance', 2350000],
  ['Kids Creative Toy Pack', 'toys', 420000],
];

const attributesBySlug = {
  phones: [
    ['Brand', 'Samsung'],
    ['Storage', 256, 'number', 'GB'],
    ['Condition', 'New'],
  ],
  laptops: [
    ['RAM', 16, 'number', 'GB'],
    ['Storage', 512, 'number', 'GB'],
    ['Condition', 'New'],
  ],
  cameras: [
    ['Resolution', 24, 'number', 'MP'],
    ['Condition', 'Like New'],
  ],
  audio: [
    ['Connection', 'Bluetooth'],
    ['Noise Cancelling', true, 'boolean'],
  ],
  wearables: [
    ['Color', 'Graphite'],
    ['Warranty', 12, 'number', 'months'],
  ],
  shoes: [
    ['Size', 'EU 42'],
    ['Material', 'Leather and textile'],
  ],
  bags: [
    ['Material', 'Leather'],
    ['Color', 'Brown'],
  ],
  watches: [
    ['Case Size', 42, 'number', 'mm'],
    ['Condition', 'New'],
  ],
  accessories: [
    ['Material', 'Steel'],
    ['Origin', 'Japan'],
  ],
  furniture: [
    ['Material', 'Wood and fabric'],
    ['Room', 'Living room'],
  ],
  kitchen: [
    ['Material', 'Ceramic'],
    ['Dishwasher Safe', true, 'boolean'],
  ],
  decor: [
    ['Style', 'Vintage'],
    ['Color', 'Warm neutral'],
  ],
  garden: [
    ['Plant Type', 'Indoor'],
    ['Pot Included', true, 'boolean'],
  ],
  skincare: [
    ['Skin Type', 'All skin types'],
    ['Volume', 50, 'number', 'ml'],
  ],
  fragrance: [
    ['Volume', 100, 'number', 'ml'],
    ['Gender', 'Unisex'],
  ],
  'personal-care': [
    ['Battery Powered', true, 'boolean'],
    ['Warranty', 12, 'number', 'months'],
  ],
  fitness: [
    ['Material', 'Steel'],
    ['Weight', 20, 'number', 'kg'],
  ],
  camping: [
    ['Water Resistant', true, 'boolean'],
    ['Weight', 1, 'number', 'kg'],
  ],
  'outdoor-gear': [
    ['Foldable', true, 'boolean'],
    ['Material', 'Aluminum'],
  ],
  books: [
    ['Language', 'English'],
    ['Format', 'Paperback'],
  ],
  toys: [
    ['Age Range', '6+'],
    ['Material', 'Plastic'],
  ],
  collectibles: [
    ['Condition', 'Good'],
    ['Limited Edition', false, 'boolean'],
  ],
};

const toAttribute = ([name, value, dataType, unit]) => ({
  name,
  normalizedName: name.trim().toLowerCase().replace(/\s+/g, ' '),
  value,
  dataType: dataType || (typeof value === 'number' ? 'number' : 'string'),
  ...(unit ? { unit } : {}),
});

const readProductAssets = async () => {
  const entries = await readdir(productAssetDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => mimeByExt.has(path.extname(name).toLowerCase()))
    .sort();

  if (files.length === 0) {
    throw new Error(`No product images found in ${productAssetDir}`);
  }
  return files;
};

const uploadProductAssets = async (files) => {
  if (!isStorageConfigured || !storageClient) {
    throw new Error('Cloudflare R2 is not fully configured');
  }

  const uploaded = [];
  for (const fileName of files) {
    const ext = path.extname(fileName).toLowerCase();
    const key = `products/${fileName}`;
    const body = await readFile(path.join(productAssetDir, fileName));
    await storageClient.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: mimeByExt.get(ext),
      }),
    );
    uploaded.push({ fileName, key, url: `${publicBaseUrl}/${key}` });
  }
  return uploaded;
};

const resetCatalogCollections = async () => {
  await Promise.all([
    Product.deleteMany({}),
    Category.deleteMany({}),
    SellerProfile.deleteMany({}),
    Coupon.deleteMany({}),
    User.deleteMany({
      email: {
        $in: [
          'admin@example.test',
          'buyer1@example.test',
          'buyer2@example.test',
          'seller1@example.test',
          'seller2@example.test',
          'seller3@example.test',
          'seller4@example.test',
        ],
      },
    }),
  ]);
};

const seedUsersAndSellers = async () => {
  const passwordHash = await hashPassword(password);
  await User.create([
    {
      _id: ids.adminUser,
      email: 'admin@example.test',
      passwordHash,
      fullName: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      _id: ids.buyerOne,
      email: 'buyer1@example.test',
      passwordHash,
      fullName: 'Buyer One',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      _id: ids.buyerTwo,
      email: 'buyer2@example.test',
      passwordHash,
      fullName: 'Buyer Two',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    ...[1, 2, 3, 4].map((number) => ({
      _id: ids[`sellerUser${['One', 'Two', 'Three', 'Four'][number - 1]}`],
      email: `seller${number}@example.test`,
      passwordHash,
      fullName: `Seller Owner ${number}`,
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    })),
  ]);

  const sellers = await SellerProfile.create([
    {
      _id: ids.sellerOne,
      userId: ids.sellerUserOne,
      displayName: 'Tech Haven',
      description: 'Phones, laptops, cameras, and daily electronics.',
      averageFeedbackRating: 4.8,
      feedbackCount: 42,
      status: 'ACTIVE',
    },
    {
      _id: ids.sellerTwo,
      userId: ids.sellerUserTwo,
      displayName: 'Urban Style',
      description: 'Fashion picks, shoes, bags, watches, and accessories.',
      averageFeedbackRating: 4.6,
      feedbackCount: 31,
      status: 'ACTIVE',
    },
    {
      _id: ids.sellerThree,
      userId: ids.sellerUserThree,
      displayName: 'Home Corner',
      description: 'Furniture, kitchen goods, decor, and garden essentials.',
      averageFeedbackRating: 4.7,
      feedbackCount: 27,
      status: 'ACTIVE',
    },
    {
      _id: ids.sellerFour,
      userId: ids.sellerUserFour,
      displayName: 'Daily Finds',
      description: 'Beauty, outdoor gear, books, toys, and collectibles.',
      averageFeedbackRating: 4.5,
      feedbackCount: 19,
      status: 'ACTIVE',
    },
  ]);

  return sellers;
};

const seedCategories = async () => {
  const categoryBySlug = new Map();
  for (const [name, slug] of rootCategories) {
    const [category] = await Category.create([
      {
        name,
        slug,
        description: `${name} products and marketplace listings.`,
        status: 'ACTIVE',
      },
    ]);
    categoryBySlug.set(slug, category);
  }

  for (const [parentSlug, children] of Object.entries(childCategories)) {
    const parent = categoryBySlug.get(parentSlug);
    for (const [name, slug] of children) {
      const [category] = await Category.create([
        {
          name,
          slug,
          description: `${name} listings in ${parent.name}.`,
          parentId: parent._id,
          status: 'ACTIVE',
        },
      ]);
      categoryBySlug.set(slug, category);
    }
  }
  return categoryBySlug;
};

const sellerForCategory = (slug) => {
  if (['phones', 'laptops', 'cameras', 'audio', 'wearables'].includes(slug))
    return ids.sellerOne;
  if (['shoes', 'bags', 'watches', 'accessories'].includes(slug))
    return ids.sellerTwo;
  if (['furniture', 'kitchen', 'decor', 'garden'].includes(slug))
    return ids.sellerThree;
  return ids.sellerFour;
};

const seedProducts = async ({ categoryBySlug, uploadedImages }) => {
  const products = productTemplates.map(
    ([title, categorySlug, price], index) => {
      const image = uploadedImages[index % uploadedImages.length];
      const status =
        index % 17 === 0
          ? 'OUT_OF_STOCK'
          : index % 23 === 0
            ? 'HIDDEN'
            : 'ACTIVE';
      const listingType = index % 9 === 0 ? 'AUCTION' : 'FIXED';
      const stock = status === 'OUT_OF_STOCK' ? 0 : 3 + (index % 28);
      const auctionStart = new Date(Date.now() - 60 * 60 * 1000);
      const auctionEnd = new Date(
        Date.now() + (2 + (index % 7)) * 24 * 60 * 60 * 1000,
      );

      return {
        sellerId: sellerForCategory(categorySlug),
        categoryId: categoryBySlug.get(categorySlug)._id,
        title,
        description: `${title} seeded for SBay catalog testing with Cloudflare R2 image delivery.`,
        price,
        stock,
        images: [image.url],
        attributes: (
          attributesBySlug[categorySlug] || [['Condition', 'New']]
        ).map(toAttribute),
        status,
        averageRating: Number((3.8 + (index % 12) / 10).toFixed(1)),
        reviewCount: 2 + (index % 18),
        listingType,
        offersEnabled: listingType === 'FIXED' && index % 2 === 0,
        ...(listingType === 'AUCTION'
          ? {
              auction: {
                startPrice: Math.round(price * 0.65),
                currentBid: Math.round(price * 0.65),
                startsAt: auctionStart,
                endsAt: auctionEnd,
                status: 'OPEN',
                version: 0,
                bidCount: 0,
                reservePrice: Math.round(price * 0.8),
                buyNowPrice: Math.round(price * 1.05),
                reserveMet: false,
              },
            }
          : {}),
      };
    },
  );

  await Product.insertMany(products);
};

const seedCoupons = async () => {
  await Coupon.insertMany([
    {
      code: 'SAVE10',
      description: 'Save 10% on a development checkout.',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 150000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      perUserLimit: 3,
      status: 'ACTIVE',
    },
    {
      code: 'WELCOME50K',
      description: 'Save 50,000 VND on your first seeded order.',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      minOrderValue: 200000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      perUserLimit: 1,
      status: 'ACTIVE',
    },
    {
      code: 'TECH15',
      description: '15% development discount for electronics.',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscount: 300000,
      minOrderValue: 1000000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      usageLimit: 50,
      perUserLimit: 2,
      status: 'ACTIVE',
    },
    {
      code: 'MIN500K',
      description: 'Save 80,000 VND on orders from 500,000 VND.',
      discountType: 'FIXED_AMOUNT',
      discountValue: 80000,
      minOrderValue: 500000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      status: 'ACTIVE',
    },
    {
      code: 'LIMITED5',
      description: 'Limited test coupon with only five total uses.',
      discountType: 'FIXED_AMOUNT',
      discountValue: 100000,
      minOrderValue: 700000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      usageLimit: 5,
      perUserLimit: 1,
      status: 'ACTIVE',
    },
    {
      code: 'EXPIRED10',
      description: 'Expired coupon for negative-path testing.',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: expiredStart,
      expiresAt: expiredEnd,
      status: 'ACTIVE',
    },
    {
      code: 'INACTIVE20',
      description: 'Inactive coupon for negative-path testing.',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      startsAt: activeStart,
      expiresAt: activeEnd,
      status: 'INACTIVE',
    },
    {
      code: 'SOLDOUT50K',
      description: 'Coupon that has already reached its usage limit.',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      startsAt: activeStart,
      expiresAt: activeEnd,
      usageLimit: 1,
      usageCount: 1,
      perUserLimit: 1,
      status: 'ACTIVE',
    },
  ]);
};

const seedCatalog = async () => {
  const assetFiles = await readProductAssets();
  await connectDatabase();
  const uploadedImages = await uploadProductAssets(assetFiles);
  await resetCatalogCollections();
  await seedUsersAndSellers();
  const categoryBySlug = await seedCategories();
  await seedProducts({ categoryBySlug, uploadedImages });
  await seedCoupons();

  const counts = {
    uploadedImages: uploadedImages.length,
    users: await User.countDocuments(),
    sellers: await SellerProfile.countDocuments(),
    categories: await Category.countDocuments(),
    products: await Product.countDocuments(),
    coupons: await Coupon.countDocuments(),
  };

  process.stdout.write('Catalog R2 seed complete\n');
  process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
  process.stdout.write('Login accounts:\n');
  [
    { email: 'buyer1@example.test', password },
    { email: 'buyer2@example.test', password },
    { email: 'seller1@example.test', password },
    { email: 'seller2@example.test', password },
    { email: 'seller3@example.test', password },
    { email: 'seller4@example.test', password },
    { email: 'admin@example.test', password },
  ].forEach(({ email, password }) => {
    process.stdout.write(`- ${email} / ${password}\n`);
  });
};

try {
  await seedCatalog();
} catch (error) {
  console.error({
    name: error.name,
    code: error.code,
    message: error.message,
    statusCode: error.$metadata?.httpStatusCode,
    requestId: error.$metadata?.requestId,
  });
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
