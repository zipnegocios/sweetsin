"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "@workspace/domain/products";
import { getLineTotalCents } from "@workspace/domain/pricing";
import { getPickupStopsAction } from "@/app/actions/pickup-stops";
import {
  limitFor,
  stopAvailabilityFor,
  trimCartToAvailability,
  type CartTrimChange,
  type Fulfillment,
  type ProductAvailability,
} from "@/lib/cart-availability";
import type { PickupStop, PickupStopsData } from "@/lib/pickup-stops";
import { EMPTY_PUBLIC_CAPACITY, type PublicCapacityData } from "@/lib/capacity-public";

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
  /** Paradas de retiro elegibles y la elegida (`null` = delivery o sin parada, como antes). */
  /** Reglas públicas del motor de capacidad (vacías con el motor apagado). */
  capacity: PublicCapacityData;
  pickupStops: PickupStop[];
  selectedStop: PickupStop | null;
  selectStop: (stopId: string | null) => void;
  autoSoldOutEnabled: boolean;
  /** Tipo de entrega elegido en el checkout (`null` = aún no elegido; la parada elegida implica retiro). */
  fulfillment: Fulfillment | null;
  setFulfillment: (fulfillment: Fulfillment | null) => void;
  /** Máximo pedible de un producto en la parada elegida (Infinity sin límite o en delivery). */
  limitOf: (productId: string) => number;
  trimChanges: CartTrimChange[];
  dismissTrimChanges: () => void;
  /** Aplica el disponible que devolvió el servidor al rechazar el pedido por stock. */
  applyStockConflict: (available: ProductAvailability[]) => void;
  /** Vuelve a leer las paradas (p. ej. la elegida dejó de aceptar pedidos). */
  refreshPickupStops: () => Promise<void>;
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
const STOP_STORAGE_KEY = "sweet-sin-stop";

export function CartProvider({
  children,
  products,
  pickup,
  capacity = EMPTY_PUBLIC_CAPACITY,
}: {
  children: ReactNode;
  products: Product[];
  pickup: PickupStopsData;
  capacity?: PublicCapacityData;
}) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [pickupStops, setPickupStops] = useState(pickup.stops);
  const [stopId, setStopId] = useState<string | null>(null);
  const [trimChanges, setTrimChanges] = useState<CartTrimChange[]>([]);
  const [fulfillment, setFulfillmentState] = useState<Fulfillment | null>(null);

  const autoSoldOutEnabled = pickup.autoSoldOutEnabled;
  const selectedStop = pickupStops.find((s) => s.stopId === stopId) ?? null;
  const limitOf = (productId: string) =>
    limitFor(productId, stopAvailabilityFor(fulfillment, selectedStop?.availability ?? null), autoSoldOutEnabled);

  // Recorta sobre el estado más reciente (updater), no sobre `items` del render: así no
  // resucita un carrito recién vaciado con clear() en el mismo evento. setTrimChanges es
  // idempotente, por lo que es seguro aunque React invoque el updater dos veces.
  function retrim(availability: ProductAvailability[] | null, base?: CartLine[]) {
    setItems((prev) => {
      const result = trimCartToAvailability(base ?? prev, availability, autoSoldOutEnabled);
      setTrimChanges(result.changes);
      return result.lines;
    });
  }

  // La parada solo limita el carrito en retiro: elegir delivery lo libera; volver a retiro lo vuelve a ajustar.
  const setFulfillment = (next: Fulfillment | null) => {
    setFulfillmentState(next);
    retrim(stopAvailabilityFor(next, selectedStop?.availability ?? null));
  };

  useEffect(() => {
    let lines: CartLine[] = [];
    let storedStop: PickupStop | undefined;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) lines = JSON.parse(raw);
      const rawStop = window.localStorage.getItem(STOP_STORAGE_KEY);
      storedStop = pickup.stops.find((s) => s.stopId === rawStop);
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — el carrito simplemente arranca vacío.
    }
    // Una parada guardada que ya no es elegible se descarta; el carrito se ajusta a la que sigue vigente.
    setStopId(storedStop?.stopId ?? null);
    retrim(storedStop?.availability ?? null, lines);
    setHydrated(true);
    // Solo al montar: hidrata desde localStorage una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      if (stopId) window.localStorage.setItem(STOP_STORAGE_KEY, stopId);
      else window.localStorage.removeItem(STOP_STORAGE_KEY);
    } catch {
      // ver comentario del efecto de arriba
    }
  }, [items, stopId, hydrated]);

  const selectStop = (nextStopId: string | null) => {
    const next = pickupStops.find((s) => s.stopId === nextStopId) ?? null;
    setStopId(next?.stopId ?? null);
    retrim(stopAvailabilityFor(fulfillment, next?.availability ?? null));
  };

  const applyStockConflict = (available: ProductAvailability[]) => {
    if (!selectedStop) return;
    // `available` trae solo los productos pedidos que tienen fila; un pedido sin fila ya no se vende ahí.
    const merged = [
      ...selectedStop.availability.filter((a) => !items.some((i) => i.productId === a.productId)),
      ...available,
    ];
    setPickupStops((prev) => prev.map((s) => (s.stopId === selectedStop.stopId ? { ...s, availability: merged } : s)));
    retrim(stopAvailabilityFor(fulfillment, merged));
  };

  const refreshPickupStops = async () => {
    const fresh = await getPickupStopsAction();
    setPickupStops(fresh.stops);
    const next = fresh.stops.find((s) => s.stopId === stopId) ?? null;
    setStopId(next?.stopId ?? null);
    retrim(stopAvailabilityFor(fulfillment, next?.availability ?? null));
  };

  const add = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if ((existing?.quantity ?? 0) + 1 > limitOf(productId)) return prev;
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

  const setQty = (productId: string, requested: number) => {
    const quantity = Math.min(requested, limitOf(productId));
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
        capacity,
        pickupStops,
        selectedStop,
        selectStop,
        autoSoldOutEnabled,
        fulfillment,
        setFulfillment,
        limitOf,
        trimChanges,
        dismissTrimChanges: () => setTrimChanges([]),
        applyStockConflict,
        refreshPickupStops,
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
