import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { AppError } from '../../common/errors/app-error.js';
import * as repository from './category.repository.js';

// Expose the public uuid as `id`; `parentId` is the parent's uuid (resolved via
// the passed map) so the frontend never sees internal ObjectIds.
const toPublicCategory = (parentUuidById) => (category) => ({
  id: category.uuid,
  name: category.name,
  slug: category.slug,
  description: category.description,
  parentId: category.parentId
    ? (parentUuidById.get(String(category.parentId)) ?? null)
    : null,
  status: category.status,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

export const listCategories = async ({ parentId } = {}) => {
  // The API addresses categories by uuid; resolve a parent filter to its ObjectId.
  const internalParentId = parentId
    ? await repository.resolveIdByUuid(parentId)
    : undefined;
  if (parentId && !internalParentId) return [];
  const categories = await repository.findActive(internalParentId);
  const parentUuidById = await repository.resolveUuidsByIds(
    categories.map((c) => c.parentId).filter(Boolean),
  );
  return categories.map(toPublicCategory(parentUuidById));
};

export const getCategory = async (categoryUuid) => {
  const internalId = await repository.resolveIdByUuid(categoryUuid);
  const category = internalId
    ? await repository.findActiveById(internalId)
    : null;
  if (!category)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Category not found');
  const parentUuidById = category.parentId
    ? await repository.resolveUuidsByIds([category.parentId])
    : new Map();
  return toPublicCategory(parentUuidById)(category);
};
