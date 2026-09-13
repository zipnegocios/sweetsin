"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "@workspace/domain/products";
import { getLineTotalCents } from "@workspace/domain/pricing";

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartContextValue {
  items: CartLine[];
  products: Product[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
  totalQty: number;
  subtotalCents: number;
  savingsCents: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sweet-sin-cart";

export function CartProvider({ children, products }: { children: ReactNode; products: Product[] }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — el carrito simplemente arranca vacío.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ver comentario del efecto de arriba
    }
  }, [items, hydrated]);

  const add = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const remove = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i));
    });
  };

  const setQty = (productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity } : i));
      return [...prev, { productId, quantity }];
    });
  };

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotalCents = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    if (!product) return sum;
    return sum + getLineTotalCents(product.priceCents, i.quantity, product.category);
  }, 0);

  const savingsCents = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    if (!product) return sum;
    const fullPriceCents = product.priceCents * i.quantity;
    return sum + (fullPriceCents - getLineTotalCents(product.priceCents, i.quantity, product.category));
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        products,
        add,
        remove,
        setQty,
        clear,
        totalQty,
        subtotalCents,
        savingsCents,
        isDrawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        isCheckoutOpen,
        openCheckout: () => setCheckoutOpen(true),
        closeCheckout: () => setCheckoutOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
