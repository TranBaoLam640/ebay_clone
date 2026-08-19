import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
// Products are addressed by public uuid at the API boundary.
const productUuid = z.string().uuid('Invalid product id');
const empty = z.object({}).strict();
const comment = z.string().trim().max(2000).optional();

export const listProductReviewsSchema = z
  .object({
    body: z.any(),
    params: z.object({ productId: productUuid }).strict(),
    query: z
      .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        q: z.string().trim().min(1).max(200).optional(),
        rating: z.coerce.number().int().min(1).max(5).optional(),
        sort: z
          .enum([
            'newest',
            'oldest',
            'highest',
            'lowest',
            'rating_desc',
            'rating_asc',
          ])
          .optional(),
      })
      .strict(),
  })
  .strict();

export const reviewSummarySchema = z
  .object({
    body: z.any(),
    params: z.object({ productId: productUuid }).strict(),
    query: empty,
  })
  .strict();

export const createProductReviewSchema = z
  .object({
    body: z
      .object({
        orderId: objectId,
        orderItemId: objectId,
        rating: z.number().int().min(1).max(5),
        comment,
      })
      .strict(),
    params: z.object({ productId: productUuid }).strict(),
    query: empty,
  })
  .strict();

export const createOrderItemProductReviewSchema = z
  .object({
    body: z
      .object({
        rating: z.number().int().min(1).max(5),
        comment,
      })
      .strict(),
    params: z.object({ orderId: objectId, orderItemId: objectId }).strict(),
    query: empty,
  })
  .strict();

export const updateProductReviewSchema = z
  .object({
    body: z
      .object({ rating: z.number().int().min(1).max(5).optional(), comment })
      .strict()
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
      }),
    params: z.object({ reviewId: objectId }).strict(),
    query: empty,
  })
  .strict();

export const productReviewIdSchema = z
  .object({
    body: z.any(),
    params: z.object({ reviewId: objectId }).strict(),
    query: empty,
  })
  .strict();
