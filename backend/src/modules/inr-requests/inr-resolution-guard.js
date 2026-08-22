import { Refund } from '../payments/refunds/refund.model.js';
import { Replacement } from '../replacements/replacement.model.js';
import { INRRequest } from './inr-request.model.js';

const activeReplacementStatuses = ['PROPOSED', 'ACCEPTED', 'FULFILLING'];
const refundStatuses = ['PROCESSING', 'COMPLETED', 'FAILED'];

export const maintainInrResolutionGuard = async () => {
  await INRRequest.createCollection();

  const missingFilter = {
    $or: [{ resolutionMode: { $exists: false } }, { resolutionMode: null }],
  };
  const requests = await INRRequest.find(missingFilter).select('_id').lean();
  const now = new Date();
  const conflicts = [];
  const backfills = [];
  let backfilled = 0;

  for (const request of requests) {
    const [replacement, refund] = await Promise.all([
      Replacement.findOne({
        inrRequestId: request._id,
        status: { $in: activeReplacementStatuses },
      })
        .select('_id status')
        .lean(),
      Refund.findOne({
        sourceType: 'INR',
        sourceId: request._id,
        status: { $in: refundStatuses },
      })
        .select('_id status')
        .lean(),
    ]);

    if (replacement && refund) {
      conflicts.push({
        inrRequestId: request._id,
        replacementId: replacement._id,
        replacementStatus: replacement.status,
        refundId: refund._id,
        refundStatus: refund.status,
      });
      continue;
    }

    const resolutionMode = refund
      ? 'REFUND'
      : replacement
        ? 'REPLACEMENT'
        : 'NONE';
    backfills.push({ inrRequestId: request._id, resolutionMode });
  }

  if (conflicts.length > 0) {
    const ids = conflicts
      .map((conflict) => String(conflict.inrRequestId))
      .join(', ');
    const error = new Error(
      `Cannot backfill INR resolution guard; conflicting active replacement and refund for INR request(s): ${ids}`,
    );
    error.conflicts = conflicts;
    throw error;
  }

  for (const backfill of backfills) {
    const result = await INRRequest.updateOne(
      { _id: backfill.inrRequestId, ...missingFilter },
      {
        $set: {
          resolutionMode: backfill.resolutionMode,
          resolutionModeUpdatedAt: now,
        },
      },
    );
    backfilled += result.modifiedCount;
  }

  return { backfilled, conflicts };
};
