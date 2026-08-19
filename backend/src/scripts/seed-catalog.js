import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { hashPassword } from '../common/utils/hash.js';
import { User } from '../modules/users/user.model.js';
import { SellerProfile } from '../modules/sellers/seller-profile.model.js';
import { Category } from '../modules/categories/category.model.js';
import { CatalogProduct } from '../modules/catalog-products/catalog-product.model.js';
import { Product } from '../modules/products/product.model.js';
import { Coupon } from '../modules/coupons/coupon.model.js';
import {
  isStorageConfigured,
  publicBaseUrl,
  storageClient,
} from '../modules/uploads/storage-client.js';

const isDryRun = process.argv.includes('--dry-run');
const developmentPassword = 'Strong1!Password';
const now = new Date();
const activeStart = new Date('2020-01-01T00:00:00.000Z');
const activeEnd = new Date('2099-12-31T23:59:59.000Z');
const expiredStart = new Date('2020-01-01T00:00:00.000Z');
const expiredEnd = new Date('2021-01-01T00:00:00.000Z');

const seedEmails = [
  'seller1@example.test',
  'seller2@example.test',
  'seller3@example.test',
  'buyer1@example.test',
  'admin@example.test',
];

const sellerSeeds = [
  {
    ownerEmail: 'seller1@example.test',
    displayName: 'Tech Haven',
    description: 'Demo seller for phones, laptops, cameras, and smart devices.',
  },
  {
    ownerEmail: 'seller2@example.test',
    displayName: 'Urban Style',
    description: 'Demo seller for fashion, bags, watches, and beauty items.',
  },
  {
    ownerEmail: 'seller3@example.test',
    displayName: 'Home Corner',
    description:
      'Demo seller for furniture, home goods, outdoor gear, and hobbies.',
  },
];

const rootCategorySeeds = [
  ['Electronics', 'electronics'],
  ['Fashion', 'fashion'],
  ['Home & Living', 'home-living'],
  ['Beauty & Health', 'beauty-health'],
  ['Sports & Outdoors', 'sports-outdoors'],
  ['Books & Hobbies', 'books-hobbies'],
];

const childCategorySeeds = {
  electronics: [
    ['Phones', 'phones'],
    ['Laptops', 'laptops'],
    ['Cameras', 'cameras'],
    ['Smart Watches', 'smart-watches'],
  ],
  fashion: [
    ['Shoes', 'shoes'],
    ['Bags', 'bags'],
    ['Watches', 'watches'],
  ],
  'home-living': [
    ['Furniture', 'furniture'],
    ['Kitchen', 'kitchen'],
    ['Rugs', 'rugs'],
  ],
  'beauty-health': [
    ['Skincare', 'skincare'],
    ['Fragrance', 'fragrance'],
  ],
  'sports-outdoors': [
    ['Fitness', 'fitness'],
    ['Camping', 'camping'],
    ['Outdoor', 'outdoor'],
  ],
  'books-hobbies': [
    ['Books', 'books'],
    ['Collectibles', 'collectibles'],
    ['Toys', 'toys'],
  ],
};

const auctionTitles = new Set([
  'Canon P Repaint Black 35mm Rangefinder Film Camera L39 From Japan',
  'Richard Mille Tourbillon Pablo Mac Donough RM 053 Box & Papers',
  'Old Vintage Art Deco 3x5 Chinese Silk Rug in Brown Animal Pictorial Pattern',
  'Gravity Falls Journal 3 - Signed Blacklight Special Edition Book #2,148/10,000',
  'AUTHENTIC FUNKO POP HARRY POTTER GOLD KINDER JOY 2024 - LIMITED EDITION',
]);

const productSeeds = [
  {
    title: 'Samsung Galaxy S23 Ultra - 256 GB - Phantom Black (Unlocked)',
    catalogEPID: 'SBAY-EPID-0001',
    catalogName: 'Samsung Galaxy S23 Ultra',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    categorySlug: 'phones',
    seller: 'Tech Haven',
    price: 12990000,
    stock: 18,
    status: 'ACTIVE',
    imageKeys: ['products/samsung-galaxy-s23.webp'],
    attributes: [
      ['Storage', 256, 'number', 'GB'],
      ['Color', 'Phantom Black'],
      ['Network', 'Unlocked'],
    ],
  },
  {
    title:
      'Samsung Galaxy S23 Ultra - 256 GB - Phantom Black (Unlocked) - Urban Style Listing',
    catalogEPID: 'SBAY-EPID-0001',
    catalogName: 'Samsung Galaxy S23 Ultra',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    categorySlug: 'phones',
    seller: 'Urban Style',
    price: 12790000,
    stock: 9,
    status: 'ACTIVE',
    imageKeys: ['products/samsung-galaxy-s23.webp'],
    attributes: [
      ['Storage', 256, 'number', 'GB'],
      ['Color', 'Phantom Black'],
      ['Network', 'Unlocked'],
    ],
  },
  {
    title:
      'Samsung Galaxy Watch 7 SM-L300 | 40mm | GPS | Bluetooth - Multi Color SmartWatch',
    categorySlug: 'smart-watches',
    seller: 'Tech Haven',
    price: 6290000,
    stock: 12,
    status: 'ACTIVE',
    imageKeys: ['products/samsung-galaxy-watch7.webp'],
    attributes: [
      ['Model', 'SM-L300'],
      ['Case Size', 40, 'number', 'mm'],
      ['Connectivity', 'GPS, Bluetooth'],
      ['Color', 'Multi Color'],
    ],
  },
  {
    title: 'Aero 15 KD 15.6" 4K Core i7 11800H RTX 3060 32GB RAM 1TB SSD',
    categorySlug: 'laptops',
    seller: 'Tech Haven',
    price: 24500000,
    stock: 5,
    status: 'ACTIVE',
    imageKeys: ['products/aero-15.webp'],
    attributes: [
      ['Display', '15.6 inch 4K'],
      ['Processor', 'Core i7 11800H'],
      ['GPU', 'RTX 3060'],
      ['RAM', 32, 'number', 'GB'],
      ['Storage', '1TB SSD'],
    ],
  },
  {
    title:
      'Sony Cyber-Shot RX100 II 20.2 MP 3.6x Zoom DSC-RX100M2 Digital Camera 窶・Black',
    categorySlug: 'cameras',
    seller: 'Tech Haven',
    price: 6400000,
    stock: 7,
    status: 'ACTIVE',
    imageKeys: ['products/sony-camera-l1600.webp'],
    attributes: [
      ['Brand', 'Sony'],
      ['Model', 'DSC-RX100M2'],
      ['Resolution', 20.2, 'number', 'MP'],
      ['Zoom', '3.6x'],
      ['Color', 'Black'],
    ],
  },
  {
    title: 'Canon P Repaint Black 35mm Rangefinder Film Camera L39 From Japan',
    categorySlug: 'cameras',
    seller: 'Tech Haven',
    price: 8900000,
    stock: 2,
    status: 'ACTIVE',
    imageKeys: ['products/canon-camera.webp'],
    attributes: [
      ['Brand', 'Canon'],
      ['Format', '35mm'],
      ['Type', 'Rangefinder Film Camera'],
      ['Mount', 'L39'],
      ['Color', 'Black'],
      ['Origin', 'Japan'],
    ],
  },
  {
    title:
      "Off White Virgil Abloh Air Jordan 1 High VAA White Sneakers Men's Size 12",
    categorySlug: 'shoes',
    seller: 'Urban Style',
    price: 4200000,
    stock: 6,
    status: 'ACTIVE',
    imageKeys: ['products/jordan-shoes.webp'],
    attributes: [
      ['Brand', 'Air Jordan'],
      ['Size', 'Men 12'],
      ['Color', 'White'],
    ],
  },
  {
    title:
      'Vintage- Allen Edmonds Spencer Black Leather Oxford Dress Shoes/Mens Size 12',
    categorySlug: 'shoes',
    seller: 'Urban Style',
    price: 1550000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    imageKeys: ['products/vintage-shoes.webp'],
    attributes: [
      ['Brand', 'Allen Edmonds'],
      ['Style', 'Oxford Dress Shoes'],
      ['Material', 'Black Leather'],
      ['Size', 'Men 12'],
    ],
  },
  {
    title:
      'Marc Jacobs Classic Q Baby Groovy 2Way Shoulder Bag Handbag Bordeaux Leather Y2K',
    categorySlug: 'bags',
    seller: 'Urban Style',
    price: 6500000,
    stock: 4,
    status: 'ACTIVE',
    imageKeys: ['products/marc_jacobs.webp'],
    attributes: [
      ['Brand', 'Marc Jacobs'],
      ['Style', '2Way Shoulder Bag'],
      ['Material', 'Leather'],
      ['Color', 'Bordeaux'],
    ],
  },
  {
    title: 'Richard Mille Tourbillon Pablo Mac Donough RM 053 Box & Papers',
    categorySlug: 'watches',
    seller: 'Urban Style',
    price: 1250000000,
    stock: 1,
    status: 'ACTIVE',
    imageKeys: ['products/richard-miles-l500.webp'],
    attributes: [
      ['Brand', 'Richard Mille'],
      ['Model', 'RM 053'],
      ['Movement', 'Tourbillon'],
      ['Includes', 'Box & Papers'],
    ],
  },
  {
    title: 'Edra On the Rocks Sectional Sofa *In Stock*',
    categorySlug: 'furniture',
    seller: 'Home Corner',
    price: 9900000,
    stock: 3,
    status: 'ACTIVE',
    imageKeys: ['products/sofa-furniture.webp'],
    attributes: [
      ['Brand', 'Edra'],
      ['Type', 'Sectional Sofa'],
      ['Availability', 'In Stock'],
    ],
  },
  {
    title:
      'High Heel Shoe Chair Y2K Zebra Print Accent Chair Glam Bedroom Furniture',
    categorySlug: 'furniture',
    seller: 'Home Corner',
    price: 3490000,
    stock: 8,
    status: 'ACTIVE',
    imageKeys: ['products/high-heel-chair.webp'],
    attributes: [
      ['Type', 'Accent Chair'],
      ['Style', 'Y2K Glam'],
      ['Pattern', 'Zebra Print'],
      ['Room', 'Bedroom'],
    ],
  },
  {
    title:
      'Sushi Roller Mold with Bamboo sushi mat Diy Sushi Making Kit Machinekitchen',
    categorySlug: 'kitchen',
    seller: 'Home Corner',
    price: 230000,
    stock: 35,
    status: 'ACTIVE',
    imageKeys: ['products/sushi-roller.webp'],
    attributes: [
      ['Type', 'Sushi Making Kit'],
      ['Includes', 'Bamboo sushi mat'],
      ['Use', 'DIY Sushi'],
    ],
  },
  {
    title: 'KAI Kitchen Scissors All Stainless Steel Made in Japan DH3345',
    categorySlug: 'kitchen',
    seller: 'Home Corner',
    price: 390000,
    stock: 20,
    status: 'ACTIVE',
    imageKeys: ['products/japan-schissors.webp'],
    attributes: [
      ['Brand', 'KAI'],
      ['Material', 'All Stainless Steel'],
      ['Model', 'DH3345'],
      ['Origin', 'Japan'],
    ],
  },
  {
    title:
      'Old Vintage Art Deco 3x5 Chinese Silk Rug in Brown Animal Pictorial Pattern',
    categorySlug: 'rugs',
    seller: 'Home Corner',
    price: 760000,
    stock: 1,
    status: 'ACTIVE',
    imageKeys: ['products/old-vintage-decor.webp'],
    attributes: [
      ['Style', 'Art Deco'],
      ['Size', '3x5'],
      ['Material', 'Chinese Silk'],
      ['Color', 'Brown'],
      ['Pattern', 'Animal Pictorial'],
    ],
  },
  {
    title:
      'WHITE FADE DAY CREAM; SUPER HIDRATANTE PERFECTA PARA SU USO DIARIO SPF 30, 5oz',
    categorySlug: 'skincare',
    seller: 'Urban Style',
    price: 350000,
    stock: 22,
    status: 'ACTIVE',
    imageKeys: ['products/white-fade-day-cream.webp'],
    attributes: [
      ['Type', 'Day Cream'],
      ['SPF', 30, 'number'],
      ['Size', '5oz'],
    ],
  },
  {
    title:
      'Me Dicube EGF NAD Firming Serum Anti-Wrinkle Face Skincare Essence NEW',
    categorySlug: 'skincare',
    seller: 'Urban Style',
    price: 490000,
    stock: 18,
    status: 'ACTIVE',
    imageKeys: ['products/firming-serum.webp'],
    attributes: [
      ['Brand', 'Me Dicube'],
      ['Type', 'Firming Serum'],
      ['Skincare Concern', 'Anti-Wrinkle'],
      ['Condition', 'NEW'],
    ],
  },
  {
    title: 'Alien Flora Futura by MUGLER for Women 2 oz EDT',
    categorySlug: 'fragrance',
    seller: 'Urban Style',
    price: 1450000,
    stock: 9,
    status: 'ACTIVE',
    imageKeys: ['products/alien-flora.webp'],
    attributes: [
      ['Brand', 'MUGLER'],
      ['Fragrance', 'Alien Flora Futura'],
      ['Gender', 'Women'],
      ['Size', '2 oz'],
      ['Type', 'EDT'],
    ],
  },
  {
    title:
      'InBody Fitness Body Composition Scanning Kang Analyzer Fat Scale Weight Analysis',
    categorySlug: 'fitness',
    seller: 'Tech Haven',
    price: 790000,
    stock: 10,
    status: 'ACTIVE',
    imageKeys: ['products/weight-analysys.webp'],
    attributes: [
      ['Brand', 'InBody'],
      ['Type', 'Body Composition Analyzer'],
      ['Use', 'Weight Analysis'],
    ],
  },
  {
    title:
      '6 Tube Pedal Resistance Band Sit Up Pull Rope Yoga Fitness Exercise Equipment UK',
    categorySlug: 'fitness',
    seller: 'Home Corner',
    price: 260000,
    stock: 28,
    status: 'ACTIVE',
    imageKeys: ['products/6_tub_peda.webp'],
    attributes: [
      ['Type', 'Resistance Band'],
      ['Tubes', 6, 'number'],
      ['Use', 'Yoga Fitness Exercise'],
    ],
  },
  {
    title: 'Coleman Brazos YEV2602 Sleeping Bag',
    categorySlug: 'camping',
    seller: 'Home Corner',
    price: 950000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    imageKeys: ['products/sleeping-bag.webp'],
    attributes: [
      ['Brand', 'Coleman'],
      ['Model', 'Brazos YEV2602'],
      ['Type', 'Sleeping Bag'],
    ],
  },
  {
    title:
      'Inflatable Dome Tent Party Hire Transparent Bubble House Tent For Outdoor Event',
    categorySlug: 'outdoor',
    seller: 'Home Corner',
    price: 2200000,
    stock: 4,
    status: 'HIDDEN',
    imageKeys: ['products/bubble-house.webp'],
    attributes: [
      ['Type', 'Inflatable Dome Tent'],
      ['Material Style', 'Transparent Bubble House'],
      ['Use', 'Outdoor Event'],
    ],
  },
  {
    title:
      'Gravity Falls Journal 3 - Signed Blacklight Special Edition Book #2,148/10,000',
    categorySlug: 'books',
    seller: 'Home Corner',
    price: 610000,
    stock: 2,
    status: 'ACTIVE',
    imageKeys: ['products/gravity-fall-book.webp'],
    attributes: [
      ['Title', 'Gravity Falls Journal 3'],
      ['Edition', 'Signed Blacklight Special Edition'],
      ['Number', '2,148/10,000'],
    ],
  },
  {
    title: 'Battle Royale (GOLLANCZ S.F.),Koushun Takami',
    categorySlug: 'books',
    seller: 'Home Corner',
    price: 280000,
    stock: 16,
    status: 'ACTIVE',
    imageKeys: ['products/battle_royale.webp'],
    attributes: [
      ['Title', 'Battle Royale'],
      ['Author', 'Koushun Takami'],
      ['Series', 'GOLLANCZ S.F.'],
    ],
  },
  {
    title:
      'AUTHENTIC FUNKO POP HARRY POTTER GOLD KINDER JOY 2024 - LIMITED EDITION',
    categorySlug: 'collectibles',
    seller: 'Home Corner',
    price: 450000,
    stock: 5,
    status: 'ACTIVE',
    imageKeys: ['products/gold-toy.webp'],
    attributes: [
      ['Brand', 'FUNKO POP'],
      ['Theme', 'Harry Potter'],
      ['Color', 'Gold'],
      ['Edition', 'Limited Edition'],
    ],
  },
  {
    title: 'Raraion - Inflatable Toy Soldier with Candy Cane, 1.8m',
    categorySlug: 'toys',
    seller: 'Home Corner',
    price: 520000,
    stock: 7,
    status: 'DRAFT',
    imageKeys: ['products/toy_soldier.webp'],
    attributes: [
      ['Brand', 'Raraion'],
      ['Type', 'Inflatable Toy Soldier'],
      ['Height', 1.8, 'number', 'm'],
      ['Accessory', 'Candy Cane'],
    ],
  },
];

const couponSeeds = [
  {
    code: 'SAVE10',
    description: 'Active 10% development coupon.',
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
    description: 'Active fixed 50,000 VND development coupon.',
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
    description: 'Active 15% technology test coupon.',
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
    code: 'FASHION20',
    description: 'Active 20% fashion test coupon.',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscount: 250000,
    minOrderValue: 500000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    usageLimit: 30,
    perUserLimit: 2,
    status: 'ACTIVE',
  },
  {
    code: 'MIN500K',
    description: 'Minimum subtotal fixed discount test coupon.',
    discountType: 'FIXED_AMOUNT',
    discountValue: 80000,
    minOrderValue: 500000,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'ACTIVE',
  },
  {
    code: 'LIMITED5',
    description: 'Active coupon with a global usage limit of five.',
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
    description: 'Expired coupon for validation testing.',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startsAt: expiredStart,
    expiresAt: expiredEnd,
    status: 'ACTIVE',
  },
  {
    code: 'INACTIVE20',
    description: 'Inactive coupon for validation testing.',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    startsAt: activeStart,
    expiresAt: activeEnd,
    status: 'INACTIVE',
  },
];

const ensureDevelopmentEnvironment = () => {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run catalog seed when NODE_ENV=production');
  }
  if (!isStorageConfigured || !storageClient) {
    throw new Error('Cloudflare R2 storage is not fully configured');
  }
};

const listProductImageKeys = async () => {
  const keys = [];
  let continuationToken;
  do {
    const response = await storageClient.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: 'products/',
        ContinuationToken: continuationToken,
      }),
    );
    keys.push(
      ...(response.Contents || [])
        .map((item) => item.Key)
        .filter((key) => key && !key.endsWith('/')),
    );
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return keys.sort();
};

const publicUrlForKey = (key) => `${publicBaseUrl}/${key.replace(/^\/+/, '')}`;

const toAttribute = ([name, value, dataType, unit]) => ({
  name,
  normalizedName: name.trim().toLowerCase().replace(/\s+/g, ' '),
  value,
  dataType: dataType || (typeof value === 'number' ? 'number' : 'string'),
  ...(unit ? { unit } : {}),
});

const descriptionFor = (seed) =>
  `Demo catalog listing for ${seed.title}. Details are based on the product title only.`;

const validateImageMapping = (availableKeys) => {
  const available = new Set(availableKeys);
  const unmatched = productSeeds.filter((seed) =>
    seed.imageKeys.some((key) => !available.has(key)),
  );

  if (unmatched.length > 0) {
    for (const seed of unmatched) {
      console.error(`UNMATCHED PRODUCT: ${seed.title}`);
      console.error(`Required keys: ${seed.imageKeys.join(', ')}`);
    }
    throw new Error('R2 product image mapping is incomplete');
  }
};

const buildUsers = async () => {
  const passwordHash = await hashPassword(developmentPassword);
  return [
    {
      email: 'seller1@example.test',
      fullName: 'Seller One',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      email: 'seller2@example.test',
      fullName: 'Seller Two',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      email: 'seller3@example.test',
      fullName: 'Seller Three',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      email: 'buyer1@example.test',
      fullName: 'Buyer One',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
    {
      email: 'admin@example.test',
      fullName: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: now,
    },
  ];
};

const upsertUsers = async () => {
  const users = await buildUsers();
  for (const user of users) {
    await User.updateOne(
      { email: user.email },
      {
        $set: {
          fullName: user.fullName,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  return User.find({ email: { $in: seedEmails } }).lean();
};

const upsertSellerProfiles = async (users) => {
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  for (const seller of sellerSeeds) {
    const owner = userByEmail.get(seller.ownerEmail);
    await SellerProfile.updateOne(
      { userId: owner._id },
      {
        $set: {
          displayName: seller.displayName,
          description: seller.description,
          averageFeedbackRating: 0,
          feedbackCount: 0,
          status: 'ACTIVE',
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  return SellerProfile.find({
    userId: {
      $in: sellerSeeds.map((seed) => userByEmail.get(seed.ownerEmail)._id),
    },
  }).lean();
};

const upsertCategories = async () => {
  const categoryBySlug = new Map();

  for (const [name, slug] of rootCategorySeeds) {
    await Category.updateOne(
      { slug },
      {
        $set: {
          name,
          description: `${name} demo catalog category.`,
          parentId: null,
          status: 'ACTIVE',
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    categoryBySlug.set(slug, await Category.findOne({ slug }).lean());
  }

  for (const [parentSlug, children] of Object.entries(childCategorySeeds)) {
    const parent = categoryBySlug.get(parentSlug);
    for (const [name, slug] of children) {
      await Category.updateOne(
        { slug },
        {
          $set: {
            name,
            description: `${name} demo listings.`,
            parentId: parent._id,
            status: 'ACTIVE',
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      categoryBySlug.set(slug, await Category.findOne({ slug }).lean());
    }
  }

  return categoryBySlug;
};

const auctionFor = (price) => ({
  startPrice: Math.round(price * 0.65),
  currentBid: Math.round(price * 0.65),
  reservePrice: Math.round(price * 0.8),
  buyNowPrice: Math.round(price * 1.05),
  startsAt: now,
  endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  status: 'OPEN',
  version: 0,
  bidCount: 0,
  reserveMet: false,
});

const catalogEPIDFor = (seed, index) =>
  seed.catalogEPID || `SBAY-EPID-${String(index + 1).padStart(4, '0')}`;

const expectedImageKeys = () => [
  ...new Set(productSeeds.flatMap((seed) => seed.imageKeys)),
];

const attributeValue = (seed, name) =>
  seed.attributes.find((attribute) => attribute[0] === name)?.[1];

const catalogDocumentFor = ({ seed, index, categoryBySlug }) => ({
  ePID: catalogEPIDFor(seed, index),
  name: seed.catalogName || seed.title.trim(),
  brand: seed.brand || attributeValue(seed, 'Brand'),
  model: seed.model || attributeValue(seed, 'Model'),
  categoryId: categoryBySlug.get(seed.categorySlug)._id,
  imageUrl: publicUrlForKey(seed.imageKeys[0]),
  identifiers: {
    ...(attributeValue(seed, 'MPN') && { mpn: attributeValue(seed, 'MPN') }),
    ...(attributeValue(seed, 'UPC') && { upc: attributeValue(seed, 'UPC') }),
    ...(attributeValue(seed, 'EAN') && { ean: attributeValue(seed, 'EAN') }),
  },
});

const upsertCatalogProducts = async ({ categoryBySlug }) => {
  const catalogByEPID = new Map();
  for (const [index, seed] of productSeeds.entries()) {
    const document = catalogDocumentFor({ seed, index, categoryBySlug });
    await CatalogProduct.updateOne(
      { ePID: document.ePID },
      {
        $set: {
          ...document,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  const docs = await CatalogProduct.find({
    ePID: { $in: productSeeds.map(catalogEPIDFor) },
  }).lean();
  for (const doc of docs) catalogByEPID.set(doc.ePID, doc);
  return catalogByEPID;
};

const buildProductDocument = ({ seed, categoryBySlug, sellerByName }) => {
  const catalogProduct = seed.catalogProduct;
  const listingType = auctionTitles.has(seed.title) ? 'AUCTION' : 'FIXED';
  return {
    sellerId: sellerByName.get(seed.seller)._id,
    categoryId: categoryBySlug.get(seed.categorySlug)._id,
    catalogProductId: catalogProduct?._id,
    title: seed.title.trim(),
    description: descriptionFor(seed),
    price: seed.price,
    stock: seed.status === 'OUT_OF_STOCK' ? 0 : seed.stock,
    images: seed.imageKeys.map(publicUrlForKey),
    attributes: seed.attributes.map(toAttribute),
    status: seed.status,
    averageRating: 0,
    reviewCount: 0,
    listingType,
    offersEnabled:
      listingType === 'FIXED' &&
      productSeeds.findIndex((item) => item.title === seed.title) % 2 === 0,
    ...(listingType === 'AUCTION' ? { auction: auctionFor(seed.price) } : {}),
  };
};

const validatePreparedData = ({ categoryBySlug, sellers, availableKeys }) => {
  const sellerByName = new Map(
    sellers.map((seller) => [seller.displayName, seller]),
  );
  const errors = [];

  for (const seed of productSeeds) {
    if (!categoryBySlug.has(seed.categorySlug))
      errors.push(`Missing category ${seed.categorySlug} for ${seed.title}`);
    if (!sellerByName.has(seed.seller))
      errors.push(`Missing seller ${seed.seller} for ${seed.title}`);
    for (const key of seed.imageKeys) {
      if (!availableKeys.includes(key))
        errors.push(`Missing image ${key} for ${seed.title}`);
    }
    if (!Number.isInteger(seed.price) || seed.price <= 0)
      errors.push(`Invalid price for ${seed.title}`);
    if (!['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'DRAFT'].includes(seed.status))
      errors.push(`Invalid status for ${seed.title}`);
  }

  if (errors.length > 0) {
    throw new Error(`Catalog seed validation failed:\n${errors.join('\n')}`);
  }

  return sellerByName;
};

const upsertProducts = async ({
  categoryBySlug,
  sellers,
  availableKeys,
  catalogByEPID,
}) => {
  const sellerByName = validatePreparedData({
    categoryBySlug,
    sellers,
    availableKeys,
  });

  for (const [index, seed] of productSeeds.entries()) {
    const document = buildProductDocument({
      seed: {
        ...seed,
        catalogProduct: catalogByEPID.get(catalogEPIDFor(seed, index)),
      },
      categoryBySlug,
      sellerByName,
    });
    await Product.updateOne(
      { title: document.title },
      {
        $set: {
          ...document,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
};

const upsertCoupons = async () => {
  for (const coupon of couponSeeds) {
    await Coupon.updateOne(
      { code: coupon.code },
      {
        $set: {
          ...coupon,
          updatedAt: now,
        },
        $setOnInsert: {
          usageCount: 0,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
};

const seedCounts = async () => {
  const categorySlugs = [
    ...rootCategorySeeds.map(([, slug]) => slug),
    ...Object.values(childCategorySeeds).flatMap((items) =>
      items.map(([, slug]) => slug),
    ),
  ];
  return {
    users: await User.countDocuments({ email: { $in: seedEmails } }),
    sellerProfiles: await SellerProfile.countDocuments({
      displayName: { $in: sellerSeeds.map((seller) => seller.displayName) },
    }),
    categories: await Category.countDocuments({ slug: { $in: categorySlugs } }),
    catalogProducts: await CatalogProduct.countDocuments({
      ePID: { $in: productSeeds.map(catalogEPIDFor) },
    }),
    products: await Product.countDocuments({
      title: { $in: productSeeds.map((product) => product.title) },
    }),
    coupons: await Coupon.countDocuments({
      code: { $in: couponSeeds.map((coupon) => coupon.code) },
    }),
  };
};

const printSummary = async ({ availableKeys, dryRun }) => {
  const counts = dryRun
    ? {
        users: seedEmails.length,
        sellerProfiles: sellerSeeds.length,
        categories:
          rootCategorySeeds.length +
          Object.values(childCategorySeeds).reduce(
            (sum, children) => sum + children.length,
            0,
          ),
        catalogProducts: new Set(productSeeds.map(catalogEPIDFor)).size,
        products: productSeeds.length,
        coupons: couponSeeds.length,
      }
    : await seedCounts();

  console.log('Catalog seed');
  console.log('------------');
  console.log('');
  console.log(`Users:           ${counts.users}`);
  console.log(`Seller profiles: ${counts.sellerProfiles}`);
  console.log(`Categories:      ${counts.categories}`);
  console.log(`CatalogProducts: ${counts.catalogProducts}`);
  console.log(`Products:        ${counts.products}`);
  console.log(`Coupons:         ${counts.coupons}`);
  console.log('');
  console.log('R2 images:');
  console.log(`Objects found:   ${availableKeys.length}`);
  console.log(`Matched:         ${productSeeds.length}`);
  console.log('Unmatched:       0');
  console.log('');
  console.log(dryRun ? 'Dry run complete. No database writes.' : 'Done.');
  console.log('');
  console.log('Development login accounts:');
  for (const email of seedEmails) console.log(`- ${email}`);
  console.log('');
  console.log(`Development password: ${developmentPassword}`);
};

const seedCatalog = async () => {
  ensureDevelopmentEnvironment();
  await connectDatabase();

  if (isDryRun) {
    await printSummary({ availableKeys: expectedImageKeys(), dryRun: true });
    return;
  }

  const availableKeys = await listProductImageKeys();
  validateImageMapping(availableKeys);

  const users = await upsertUsers();
  const sellers = await upsertSellerProfiles(users);
  const categoryBySlug = await upsertCategories();
  const catalogByEPID = await upsertCatalogProducts({ categoryBySlug });
  await upsertProducts({
    categoryBySlug,
    sellers,
    availableKeys,
    catalogByEPID,
  });
  await upsertCoupons();
  await printSummary({ availableKeys, dryRun: false });
};

try {
  await seedCatalog();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
