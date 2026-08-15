import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const rating = z.number().int().min(1).max(5);
const optionalRating = rating.optional();
const comment = z.string().trim().max(2000).optional();
const emptyBody = z.object({}).strict().default({});
const feedbackFields = {
  rating,
  comment,
  itemAsDescribedRating: optionalRating,
  communicationRating: optionalRating,
  shippingRating: optionalRating,
};

export const createSellerFeedbackSchema = z
  .object({
    body: z.object(feedbackFields).strict(),
    params: z.object({ orderId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const updateSellerFeedbackSchema = z
  .object({
    body: z
      .object({
        rating: optionalRating,
        comment,
        itemAsDescribedRating: optionalRating,
        communicationRating: optionalRating,
        shippingRating: optionalRating,
      })
      .strict()
      .refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
      }),
    params: z.object({ feedbackId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const deleteSellerFeedbackSchema = z
  .object({
    body: emptyBody,
    params: z.object({ feedbackId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const listSellerFeedbacksSchema = z
  .object({
    body: emptyBody,
    params: z.object({ sellerId: objectId }).strict(),
    query: z
      .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        rating: z.coerce.number().int().min(1).max(5).optional(),
        sort: z
          .enum(['newest', 'oldest', 'rating_desc', 'rating_asc'])
          .optional(),
      })
      .strict(),
  })
  .strict();
