import { Refund } from '../payments/refunds/refund.model.js';
import { Replacement } from '../replacements/replacement.model.js';
import { INRRequest } from './inr-request.model.js';

const activeReplacementStatuses = ['PROPOSED', 'ACCEPTED', 'FULFILLING'];
const terminalAbandonedReplacementStatuses = [
  'DECLINED',
  'CANCELLED',
  'FAILED',
];
const refundStatuses = ['PROCESSING', 'COMPLETED', 'FAILED'];

const lifecycleConflict = (type, request, replacement) => ({
  type,
  inrRequestId: request._id,
  inrStatus: request.status,
  resolutionMode: request.resolutionMode,
  replacementId: replacement._id,
  replacementStatus: replacement.status,
  inventoryClaimStatus: replacement.inventoryClaimStatus,
});

const scanLifecycleConflicts = async () => {
  const replacements = await Replacement.find({
    status: {
      $in: [
        ...activeReplacementStatuses,
        ...terminalAbandonedReplacementStatuses,
        'COMPLETED',
      ],
    },
  })
    .select('_id inrRequestId status inventoryClaimStatus')
    .lean();
  if (replacements.length === 0) return [];
  const requests = await INRRequest.find({
    _id: { $in: replacements.map((item) => item.inrRequestId) },
  })
    .select('_id status resolutionMode')
    .lean();
  const requestMap = new Map(requests.map((item) => [String(item._id), item]));
  const conflicts = [];
  for (const replacement of replacements) {
    const request = requestMap.get(String(replacement.inrRequestId));
    if (!request) continue;
    if (
      request.status === 'CLOSED' &&
      activeReplacementStatuses.includes(replacement.status)
    )
      conflicts.push(
        lifecycleConflict(
          'CLOSED_INR_WITH_ACTIVE_REPLACEMENT',
          request,
          replacement,
        ),
      );
    if (
      request.status === 'CLOSED' &&
      replacement.inventoryClaimStatus === 'CLAIMED'
    )
      conflicts.push(
        lifecycleConflict(
          'CLOSED_INR_WITH_CLAIMED_INVENTORY',
          request,
          replacement,
        ),
      );
    if (replacement.status === 'COMPLETED' && request.status === 'OPEN')
      conflicts.push(
        lifecycleConflict(
          'COMPLETED_REPLACEMENT_WITH_OPEN_INR',
          request,
          replacement,
        ),
      );
    if (
      request.status === 'OPEN' &&
      request.resolutionMode === 'REPLACEMENT' &&
      terminalAbandonedReplacementStatuses.includes(replacement.status)
    )
      conflicts.push(
        lifecycleConflict(
          'OPEN_REPLACEMENT_MODE_WITH_ABANDONED_TERMINAL_REPLACEMENT',
          request,
          replacement,
        ),
      );
  }
  return conflicts;
};

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

  const lifecycleConflicts = await scanLifecycleConflicts();
  return { backfilled, conflicts, lifecycleConflicts };
};
