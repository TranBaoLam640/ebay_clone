import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const numericRating = z.coerce.number().int().min(1).max(5);
const optionalRating = z.preprocess(
  (value) => (value === '' ? undefined : value),
  numericRating.optional(),
);
const commentText = z.string().trim().max(500).optional();
const legacyComment = z.string().trim().max(2000).optional();
const emptyBody = z.object({}).strict().default({});
const feedbackFields = {
  commentType: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  commentText,
  rating: optionalRating,
  comment: legacyComment,
  itemAsDescribedRating: optionalRating,
  communicationRating: optionalRating,
  shippingTimeRating: optionalRating,
  shippingAndHandlingChargesRating: optionalRating,
  shippingRating: optionalRating,
};
const revisionFeedbackFields = {
  commentType: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  commentText,
  itemAsDescribedRating: optionalRating,
  communicationRating: optionalRating,
  shippingTimeRating: optionalRating,
  shippingAndHandlingChargesRating: optionalRating,
};

export const createSellerFeedbackSchema = z
  .object({
    body: z
      .object(feedbackFields)
      .strict()
      .refine((body) => body.rating !== undefined || body.commentType, {
        message: 'rating or commentType is required',
      }),
    params: z.object({ orderId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const createOrderItemSellerFeedbackSchema = z
  .object({
    body: z
      .object({
        commentType: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
        commentText,
        itemAsDescribedRating: optionalRating,
        communicationRating: optionalRating,
        shippingTimeRating: optionalRating,
        shippingAndHandlingChargesRating: optionalRating,
      })
      .strict(),
    params: z.object({ orderId: objectId, orderItemId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const getOrderItemSellerFeedbackSchema = z
  .object({
    body: emptyBody,
    params: z.object({ orderId: objectId, orderItemId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const updateSellerFeedbackSchema = z
  .object({
    body: z
      .object({
        rating: optionalRating,
        commentType: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
        commentText,
        comment: legacyComment,
        itemAsDescribedRating: optionalRating,
        communicationRating: optionalRating,
        shippingTimeRating: optionalRating,
        shippingAndHandlingChargesRating: optionalRating,
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

export const awaitingSellerFeedbackSchema = z
  .object({
    body: emptyBody,
    params: z.object({}).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const respondToSellerFeedbackSchema = z
  .object({
    body: z.object({ commentText: z.string().trim().min(1).max(500) }).strict(),
    params: z.object({ feedbackId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const addSellerFeedbackFollowUpSchema = z
  .object({
    body: z.object({ commentText: z.string().trim().min(1).max(500) }).strict(),
    params: z.object({ feedbackId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const createFeedbackRevisionRequestSchema = z
  .object({
    body: emptyBody,
    params: z.object({ feedbackId: objectId }).strict(),
    query: z.object({}).strict(),
  })
  .strict();

export const respondToFeedbackRevisionRequestSchema = z
  .object({
    body: z
      .discriminatedUnion('decision', [
        z
          .object({
            decision: z.literal('ACCEPT'),
            feedback: z.object(revisionFeedbackFields).strict(),
          })
          .strict(),
        z.object({ decision: z.literal('DECLINE') }).strict(),
      ])
      .refine((body) => body.decision !== 'ACCEPT' || Boolean(body.feedback), {
        message: 'feedback is required when accepting a revision request',
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
        commentType: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
        sort: z
          .enum(['newest', 'oldest', 'rating_desc', 'rating_asc'])
          .optional(),
      })
      .strict(),
  })
  .strict();
