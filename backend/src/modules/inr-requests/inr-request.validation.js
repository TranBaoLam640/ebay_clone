import { z } from 'zod';
import {
  INR_REQUESTED_RESOLUTIONS,
  INR_STATUSES,
} from './inr-request.constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const empty = z.object({}).strict();

export const createSchema = z.object({
  body: z
    .object({
      orderId: objectId,
      orderItemId: objectId,
      quantityMissing: z.number().int().positive(),
      requestedResolution: z.enum(INR_REQUESTED_RESOLUTIONS),
      details: z.string().trim().min(1).max(1000).optional(),
    })
    .strict(),
  params: empty,
  query: empty,
});

export const listSchema = z.object({
  body: z.any(),
  params: empty,
  query: z
    .object({
      status: z.enum(INR_STATUSES).optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .strict(),
});

export const idSchema = z.object({
  body: z.any(),
  params: z.object({ requestId: objectId }).strict(),
  query: empty,
});

export const trackingEvidenceSchema = z.object({
  body: z
    .object({
      carrierId: objectId,
      trackingId: z.string().trim().min(1).max(120),
    })
    .strict(),
  params: z.object({ requestId: objectId }).strict(),
  query: empty,
});
