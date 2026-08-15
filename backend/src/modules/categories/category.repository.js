import { Category } from './category.model.js';

const publicFields =
  '_id uuid name slug description parentId status createdAt updatedAt';

export const findActive = (parentId) => {
  const filter = { status: 'ACTIVE' };
  if (parentId) filter.parentId = parentId;

  return Category.find(filter)
    .select(publicFields)
    .sort({ name: 1, _id: 1 })
    .lean()
    .exec();
};

export const findActiveById = (categoryId) =>
  Category.findOne({ _id: categoryId, status: 'ACTIVE' })
    .select(publicFields)
    .lean()
    .exec();

/** Resolve a public category uuid → internal ObjectId (null if not found). */
export const resolveIdByUuid = async (uuid) => {
  const doc = await Category.findOne({ uuid }).select('_id').lean();
  return doc?._id ?? null;
};

/** Resolve many ObjectIds → Map(idString → uuid) for exposing parent refs. */
export const resolveUuidsByIds = async (ids) => {
  const docs = await Category.find({ _id: { $in: ids } })
    .select('_id uuid')
    .lean();
  return new Map(docs.map((doc) => [String(doc._id), doc.uuid]));
};
