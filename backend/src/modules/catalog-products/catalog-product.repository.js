import mongoose from 'mongoose';
import { CatalogProduct } from './catalog-product.model.js';

const id = (value) => new mongoose.Types.ObjectId(value);

const publicProjection = {
  _id: 0,
  id: '$_id',
  ePID: 1,
  name: 1,
  brand: 1,
  model: 1,
  categoryId: 1,
  imageUrl: 1,
  createdAt: 1,
  updatedAt: 1,
};

const queryFor = ({ q, ePID, brand, model } = {}) => {
  const filter = {};
  if (ePID) filter.ePID = ePID;
  if (brand) filter.brand = brand;
  if (model) filter.model = model;
  if (q) filter.$text = { $search: q };
  return filter;
};

export const list = async ({ q, ePID, brand, model, skip, limit }) => {
  const filter = queryFor({ q, ePID, brand, model });
  const [result] = await CatalogProduct.aggregate([
    { $match: filter },
    ...(q
      ? [
          { $addFields: { score: { $meta: 'textScore' } } },
          { $sort: { score: -1, name: 1 } },
        ]
      : [{ $sort: { name: 1 } }]),
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $project: publicProjection },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]);
  return { items: result?.items || [], total: result?.total[0]?.value || 0 };
};

export const findPublicById = async (catalogProductId) => {
  const [item] = await CatalogProduct.aggregate([
    { $match: { _id: id(catalogProductId) } },
    { $project: publicProjection },
  ]);
  return item || null;
};

export const findPublicByEPID = async (ePID) => {
  const [item] = await CatalogProduct.aggregate([
    { $match: { ePID } },
    { $project: publicProjection },
  ]);
  return item || null;
};

export const findById = (catalogProductId, session) =>
  CatalogProduct.findById(catalogProductId)
    .session(session || null)
    .lean();

export const findByEPID = (ePID, session) =>
  CatalogProduct.findOne({ ePID })
    .session(session || null)
    .lean();
