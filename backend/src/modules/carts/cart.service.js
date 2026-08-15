import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as productRepository from '../products/product.repository.js';
import * as repository from './cart.repository.js';

const error = (status, code, message, details) =>
  new AppError(status, code, message, details);
const productMap = (products) =>
  Object.fromEntries(products.map((product) => [String(product._id), product]));
const availabilityError = (product, quantity) => {
  if (
    !product?.buyerVisible ||
    !['ACTIVE', 'OUT_OF_STOCK'].includes(product.status)
  )
    return error(
      409,
      ERROR_CODES.PRODUCT_UNAVAILABLE,
      'Product is unavailable',
    );
  if (product.status !== 'ACTIVE' || product.stock < 1)
    return error(
      409,
      ERROR_CODES.PRODUCT_OUT_OF_STOCK,
      'Product is out of stock',
    );
  if (quantity > product.stock)
    return error(
      409,
      ERROR_CODES.INSUFFICIENT_STOCK,
      'Requested quantity exceeds stock',
      {
        requested: quantity,
        available: product.stock,
      },
    );
};

export const hydrate = async (cart, session) => {
  const storedItems = cart?.items || [];
  const products = storedItems.length
    ? await productRepository.findBuyerCartProducts(
        storedItems.map((item) => item.productId),
        session,
      )
    : [];
  const productsById = productMap(products);
  const items = storedItems.map((item) => {
    const product = productsById[String(item.productId)];
    const price = product?.price ?? null;
    const seller = product?.seller
      ? {
          id: String(product.sellerId),
          displayName: product.seller.displayName,
        }
      : null;
    const productDto = {
      // Expose the public product uuid to clients, not the internal ObjectId.
      id: product?.uuid ?? null,
      title: product?.title ?? null,
      primaryImage: product?.primaryImage ?? null,
      price,
      stock: product?.stock ?? 0,
      // An AUCTION listing must never be purchasable via the cart/checkout —
      // surface it as unavailable so isPurchasable/the cart UI reject it (defense
      // in depth; findBuyerCartProducts already excludes auctions from add/sync).
      status:
        product?.listingType === 'AUCTION'
          ? 'UNAVAILABLE'
          : (product?.status ?? 'UNAVAILABLE'),
      seller,
    };
    return {
      id: String(item._id),
      productId: productDto.id,
      quantity: item.quantity,
      product: productDto,
      itemSubtotal: price === null ? 0 : price * item.quantity,
    };
  });
  return {
    id: cart?._id ? String(cart._id) : null,
    items,
    subtotal: items.reduce((sum, item) => sum + item.itemSubtotal, 0),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
};

export const get = async (userId) =>
  hydrate(await repository.findByUser(userId));

// Resolve a public product uuid to its internal ObjectId (throws 409 if the
// product no longer exists — treated as unavailable from the buyer's view).
const resolveProductId = async (productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId)
    throw error(409, ERROR_CODES.PRODUCT_UNAVAILABLE, 'Product is unavailable');
  return productId;
};

/**
 * Change a line's quantity.
 * - accumulate=true ("add to cart"): add to the existing quantity, capped at stock.
 * - accumulate=false ("set quantity"): replace the quantity outright.
 * requireExisting rejects the op when the line isn't already in the cart.
 */
const mutateQuantity = (
  userId,
  productUuid,
  quantity,
  { requireExisting = false, accumulate = false } = {},
) =>
  repository.transaction(async (session) => {
    const productId = String(await resolveProductId(productUuid));
    const cart = await repository.findByUser(userId, session);
    const items = cart?.items || [];
    const index = items.findIndex(
      (item) => String(item.productId) === productId,
    );
    // Adding to an existing line stacks onto what's already reserved.
    const existingQty = index >= 0 ? items[index].quantity : 0;
    const desiredQty = accumulate ? existingQty + quantity : quantity;

    const products = await productRepository.findBuyerCartProducts(
      [productId],
      session,
    );
    const product = products[0];
    // Validate the final quantity so "add" can't exceed available stock.
    const unavailable = availabilityError(product, desiredQty);
    if (unavailable) throw unavailable;

    if (requireExisting && index < 0)
      throw error(404, ERROR_CODES.CART_ITEM_NOT_FOUND, 'Cart item not found');
    const next = items.map((item) => ({
      _id: item._id,
      productId: item.productId,
      quantity: item.quantity,
    }));
    if (index < 0) next.push({ productId, quantity: desiredQty });
    else next[index].quantity = desiredQty;
    return hydrate(await repository.setItems(userId, next, session), session);
  });

export const add = (userId, input) =>
  mutateQuantity(userId, input.productId, input.quantity, { accumulate: true });
export const update = (userId, productId, input) =>
  mutateQuantity(userId, productId, input.quantity, { requireExisting: true });
export const remove = async (userId, productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId)
    throw error(404, ERROR_CODES.CART_ITEM_NOT_FOUND, 'Cart item not found');
  const cart = await repository.removeItem(userId, productId);
  if (!cart)
    throw error(404, ERROR_CODES.CART_ITEM_NOT_FOUND, 'Cart item not found');
  return hydrate(cart);
};
export const clear = async (userId) => hydrate(await repository.clear(userId));

export const sync = (userId, localItems) =>
  repository.transaction(async (session) => {
    const cart = await repository.findByUser(userId, session);
    // Local items arrive keyed by public uuid; resolve to internal ObjectIds so
    // they share one key space with the server cart (which stores ObjectIds).
    // Unresolvable uuids (deleted products) are dropped with a warning.
    const warnings = [];
    const uuidToId = await productRepository.resolveIdsByUuids([
      ...new Set(localItems.map((item) => item.productId)),
    ]);
    const normalized = {};
    for (const item of localItems) {
      const internalId = uuidToId.get(item.productId);
      if (!internalId) {
        warnings.push({
          code: 'PRODUCT_UNAVAILABLE',
          productId: item.productId,
          requested: item.quantity,
          final: 0,
        });
        continue;
      }
      const key = String(internalId);
      const previous = normalized[key];
      normalized[key] = Math.max(previous || 0, item.quantity);
      if (previous !== undefined)
        warnings.push({
          code: 'DUPLICATE_LOCAL_ITEM_NORMALIZED',
          productId: key,
          requested: item.quantity,
          final: normalized[key],
        });
    }
    const server = Object.fromEntries(
      (cart?.items || []).map((item) => [
        String(item.productId),
        item.quantity,
      ]),
    );
    const ids = [
      ...new Set([...Object.keys(server), ...Object.keys(normalized)]),
    ];
    const products = ids.length
      ? await productRepository.findBuyerCartProducts(ids, session)
      : [];
    const productsById = productMap(products);
    const merged = [];
    for (const productId of ids) {
      const product = productsById[productId];
      const local = normalized[productId];
      if (
        !product?.buyerVisible ||
        !['ACTIVE', 'OUT_OF_STOCK'].includes(product?.status)
      ) {
        warnings.push({
          code: 'PRODUCT_UNAVAILABLE',
          productId,
          requested: local ?? server[productId] ?? 0,
          final: 0,
        });
        continue;
      }
      if (product.status !== 'ACTIVE' || product.stock < 1) {
        warnings.push({
          code: 'PRODUCT_OUT_OF_STOCK',
          productId,
          requested: local ?? server[productId] ?? 0,
          final: 0,
        });
        continue;
      }
      const requested = Math.max(local || 0, server[productId] || 0);
      const final = Math.min(requested, product.stock);
      if (final < requested)
        warnings.push({
          code: 'QUANTITY_ADJUSTED',
          productId,
          requested,
          final,
        });
      if (final)
        merged.push({
          _id: cart?.items.find((item) => String(item.productId) === productId)
            ?._id,
          productId,
          quantity: final,
        });
    }
    merged.sort((a, b) => a.productId.localeCompare(b.productId));
    warnings.sort(
      (left, right) =>
        left.productId.localeCompare(right.productId) ||
        left.code.localeCompare(right.code),
    );
    return {
      ...(await hydrate(
        await repository.setItems(userId, merged, session),
        session,
      )),
      warnings,
    };
  });
