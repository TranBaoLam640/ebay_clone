import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    ePID: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    identifiers: {
      mpn: { type: String, trim: true },
      upc: { type: String, trim: true },
      ean: { type: String, trim: true },
    },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

schema.index({ name: 'text', brand: 'text', model: 'text', ePID: 'text' });

export const CatalogProduct = mongoose.model('CatalogProduct', schema);
