import { createContext, useContext, useState, ReactNode } from 'react';
import { products, WHATSAPP_URL } from './data';

export interface CartItem {
  productId: string;
  qty: number;
}

interface CartContextValue {
  items: CartItem[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  totalQty: number;
  totalPrice: number;
  sendToWhatsApp: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    return sum + (product?.price ?? 0) * i.qty;
  }, 0);

  const sendToWhatsApp = () => {
    const lines = items.map(i => {
      const product = products.find(p => p.id === i.productId);
      return `• ${i.qty}x ${product?.name} — $${((product?.price ?? 0) * i.qty).toFixed(2)}`;
    });
    const total = `Total: $${totalPrice.toFixed(2)}`;
    const text = `Hi! I'd like to place an order with Sweet Sin 🍮\n\n${lines.join('\n')}\n\n${total}\n\nWhen can I pick it up?`;
    window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <CartContext.Provider value={{ items, add, remove, clear, totalQty, totalPrice, sendToWhatsApp }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
