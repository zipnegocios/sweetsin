export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
}
