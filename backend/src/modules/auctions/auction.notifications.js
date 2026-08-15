import { createNotification } from '../notifications/service.js';

/**
 * Notify a displaced leader they were outbid. The eventKey is keyed on the
 * post-commit auction version, so a bid retry or a re-read can never send the
 * same outbid notice twice (createUnique upserts on userId+eventKey).
 */
export const notifyOutbid = (userId, product, version) =>
  createNotification(userId, {
    type: 'AUCTION',
    title: 'You have been outbid',
    message: `You were outbid on "${product.title}".`,
    referenceType: 'PRODUCT',
    referenceId: product._id,
    eventType: 'AUCTION_OUTBID',
    eventKey: `outbid:${product._id}:${userId}:${version}`,
  });

/**
 * Notify the standing leader that someone bought the item outright. Only reachable
 * on a reserve listing, where Buy It Now stays open until a bid meets the reserve:
 * the leader never lost a bidding war, the item simply left the auction. Keyed on
 * the product, which can only be bought out once.
 */
export const notifyBoughtOut = (userId, product) =>
  createNotification(userId, {
    type: 'AUCTION',
    title: 'The auction ended early',
    message: `Another buyer used Buy It Now on "${product.title}" before the reserve price was met.`,
    referenceType: 'PRODUCT',
    referenceId: product._id,
    eventType: 'AUCTION_BOUGHT_OUT',
    eventKey: `boughtout:${product._id}:${userId}`,
  });

/**
 * Notify the winner once, with the final price. Keyed on the product so a
 * double close (sweep + lazy read racing) yields a single notification.
 */
export const notifyWon = (userId, product, finalPrice) =>
  createNotification(userId, {
    type: 'AUCTION',
    title: 'You won the auction',
    message: `You won "${product.title}" for ${finalPrice.toLocaleString('vi-VN')}₫. Complete your payment to finish.`,
    referenceType: 'PRODUCT',
    referenceId: product._id,
    eventType: 'AUCTION_WON',
    eventKey: `won:${product._id}:${userId}`,
  });
