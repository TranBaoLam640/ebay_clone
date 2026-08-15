/**
 * Bid increment table (VND), scaled from eBay's USD automatic-bidding table.
 * The minimum step between bids is picked from the current price bracket — small
 * steps at low prices, larger steps as the price climbs. Nobody chooses the
 * increment; the server derives it, and the buyer only ever enters a max bid.
 *
 * | Current price   | Increment |
 * |-----------------|-----------|
 * | < 100k          | 5k        |
 * | 100k – < 1M     | 20k       |
 * | 1M – < 10M      | 100k      |
 * | 10M – < 100M    | 500k      |
 * | >= 100M         | 1M        |
 */
export const bidIncrement = (currentBid) => {
  if (currentBid < 100_000) return 5_000;
  if (currentBid < 1_000_000) return 20_000;
  if (currentBid < 10_000_000) return 100_000;
  if (currentBid < 100_000_000) return 500_000;
  return 1_000_000;
};
