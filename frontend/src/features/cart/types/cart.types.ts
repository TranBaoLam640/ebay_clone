export interface CartItem {
  productId: string;
  title: string;
  /** Unit price in integer cents. */
  price: number;
  image: string | null;
  sellerName: string;
  quantity: number;
  stock: number;
}
