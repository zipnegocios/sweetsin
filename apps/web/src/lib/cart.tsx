import { createContext, useContext, useState, ReactNode } from 'react';
import { products, WHATSAPP_URL } from './data';
import { getLineTotal } from './pricing';

export interface CartItem {
  productId: string;
  qty: number;
}

export interface CheckoutDetails {
  fulfillment: 'pickup' | 'self-delivery' | 'courier';
  fulfillmentFee: number;
  address?: { line1: string; suburb: string };
  contact: { name: string; phone: string; email: string };
}

interface CartContextValue {
  items: CartItem[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  totalQty: number;
  totalPrice: number;
  totalSavings: number;
  sendToWhatsApp: (details: CheckoutDetails) => void;
  checkoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const FULFILLMENT_LABEL: Record<CheckoutDetails['fulfillment'], string> = {
  pickup: 'Pickup at the trailer',
  'self-delivery': 'Delivery by Sweet Sin',
  courier: 'Courier delivery',
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const add = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId, qty: 1 }];
    });
  };

  const remove = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(i => i.productId !== productId);
      return prev.map(i => i.productId === productId ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const setQty = (productId: string, qty: number) => {
    setItems(prev => {
      if (qty <= 0) return prev.filter(i => i.productId !== productId);
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, qty } : i);
      }
      return [...prev, { productId, qty }];
    });
  };

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    if (!product) return sum;
    return sum + getLineTotal(product.price, i.qty);
  }, 0);

  const totalSavings = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    if (!product) return sum;
    return sum + (product.price * i.qty - getLineTotal(product.price, i.qty));
  }, 0);

  const sendToWhatsApp = (details: CheckoutDetails) => {
    const lines = items.map(i => {
      const product = products.find(p => p.id === i.productId);
      const lineTotal = product ? getLineTotal(product.price, i.qty) : 0;
      return `• ${i.qty}x ${product?.name} — $${lineTotal.toFixed(2)}`;
    });
    const grandTotal = totalPrice + details.fulfillmentFee;
    const fulfillmentLine = `Fulfillment: ${FULFILLMENT_LABEL[details.fulfillment]}${
      details.fulfillmentFee > 0 ? ` (+$${details.fulfillmentFee.toFixed(2)})` : ''
    }`;
    const savingsLine = totalSavings > 0 ? `Volume savings: -$${totalSavings.toFixed(2)}` : null;
    const addressLine = details.address
      ? `Address: ${details.address.line1}, ${details.address.suburb}`
      : null;
    const text = [
      `Hi! I'd like to place an order with Sweet Sin 🍮`,
      '',
      ...lines,
      '',
      fulfillmentLine,
      savingsLine,
      addressLine,
      `Total: $${grandTotal.toFixed(2)}`,
      '',
      `Name: ${details.contact.name}`,
      `Phone: ${details.contact.phone}`,
      `Email: ${details.contact.email}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
    window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openCheckout = () => setCheckoutOpen(true);
  const closeCheckout = () => setCheckoutOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        clear,
        totalQty,
        totalPrice,
        totalSavings,
        sendToWhatsApp,
        checkoutOpen,
        openCheckout,
        closeCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
