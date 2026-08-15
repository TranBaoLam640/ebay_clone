import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const integer = z.coerce.number().int().nonnegative();
const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const normalizeName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');
const dateString = z
  .string()
  .datetime({ offset: true })
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');
const typedAttribute = z
  .object({
    name: z.string().trim().min(1),
    normalizedName: z.string().trim().min(1).optional(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    dataType: z.enum(['string', 'number', 'boolean', 'date']),
    unit: z.string().trim().min(1).optional(),
  })
  .superRefine((attribute, context) => {
    const valid =
      (attribute.dataType === 'string' &&
        typeof attribute.value === 'string') ||
      (attribute.dataType === 'number' &&
        typeof attribute.value === 'number' &&
        Number.isFinite(attribute.value)) ||
      (attribute.dataType === 'boolean' &&
        typeof attribute.value === 'boolean') ||
      (attribute.dataType === 'date' &&
        dateString.safeParse(attribute.value).success);
    if (!valid)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Value must match dataType ${attribute.dataType}`,
      });
  })
  .transform((attribute) => ({
    ...attribute,
    normalizedName: normalizeName(attribute.name),
  }));

const attributes = z.array(typedAttribute).superRefine((items, context) => {
  const names = new Set();
  items.forEach((item, index) => {
    if (names.has(item.normalizedName))
      context.addIssue({
        code: 'custom',
        path: [index, 'normalizedName'],
        message: 'Duplicate normalized attribute name',
      });
    names.add(item.normalizedName);
  });
});

export const productInputSchema = z
  .object({
    sellerId: objectId,
    categoryId: objectId,
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    price: z.number().int().nonnegative(),
    stock: z.number().int().nonnegative(),
    images: z.array(z.url({ protocol: /^https?$/ })).optional(),
    attributes: attributes.optional(),
    status: z
      .enum(['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'DELETED'])
      .optional(),
  })
  .transform((product) => ({
    ...product,
    stock: product.status === 'OUT_OF_STOCK' ? 0 : product.stock,
  }));

export const listSchema = z.object({
  body: z.any(),
  params: z.object({}),
  query: z
    .object({
      search: z.string().trim().min(1).max(200).optional(),
      // Category is addressed by public uuid; seller still by ObjectId.
      categoryId: z.string().uuid('Invalid category id').optional(),
      sellerId: objectId.optional(),
      minPrice: integer.optional(),
      maxPrice: integer.optional(),
      inStock: booleanQuery.optional(),
      // Listing format facet: 'auction' → AUCTION listings; 'offerable' → FIXED
      // listings with Best Offer enabled. The two are mutually exclusive.
      format: z.enum(['auction', 'offerable']).optional(),
      sort: z
        .enum(['newest', 'price_asc', 'price_desc', 'rating_desc'])
        .default('newest'),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    })
    .strict()
    .refine(
      ({ minPrice, maxPrice }) =>
        minPrice === undefined ||
        maxPrice === undefined ||
        minPrice <= maxPrice,
      {
        message: 'minPrice must not exceed maxPrice',
        path: ['minPrice'],
      },
    ),
});

export const detailSchema = z.object({
  body: z.any(),
  // Products are addressed by public uuid at the API boundary.
  params: z.object({ productId: z.string().uuid('Invalid product id') }),
  query: z.object({}).strict(),
});

// Batch live-availability lookup: ?ids=uuid1,uuid2,... (deduped, 1..100 uuids).
export const availabilitySchema = z.object({
  body: z.any(),
  params: z.object({}).strict(),
  query: z
    .object({
      ids: z
        .string()
        .transform((value) => [
          ...new Set(
            value
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        ])
        .pipe(
          z
            .array(z.string().uuid('Invalid product id'))
            .min(1, 'ids is required')
            .max(100, 'Too many ids (max 100)'),
        ),
    })
    .strict(),
});
