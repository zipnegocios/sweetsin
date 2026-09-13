"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useCart } from "@/lib/cart-store";

export function CartDrawer() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, products, isDrawerOpen, closeDrawer, setQty, subtotalCents, savingsCents, openCheckout } = useCart();

  if (!isDrawerOpen) return null;

  return (
    <>
      <div onClick={closeDrawer} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-y-0 right-0 z-[195] w-full max-w-md bg-white shadow-[-8px_0_48px_rgba(15,27,61,0.18)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy/10">
          <h3 className="font-serif font-bold text-navy text-xl">{t("title")}</h3>
          <button onClick={closeDrawer} aria-label="Close" className="text-navy/40 hover:text-navy transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-navy/40 text-sm font-mono text-center mt-12">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                const name = locale === "en" ? product.nameEn : product.nameEs;

                return (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy">{name}</p>
                      <p className="text-xs text-navy/40 font-mono">${(product.priceCents / 100).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.productId, item.quantity - 1)}
                        className="w-7 h-7 rounded-full border border-navy/15 text-navy flex items-center justify-center hover:border-sin-red hover:text-sin-red transition-colors"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm text-navy w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.productId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-navy/10 space-y-3">
            {savingsCents > 0 && (
              <p className="text-[13px] text-sin-red font-medium">
                {t("savings")} ${(savingsCents / 100).toFixed(2)}
              </p>
            )}
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">{t("subtotal")}</span>
              <span className="font-serif font-bold text-navy text-xl">${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <button
              onClick={openCheckout}
              className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
            >
              {t("checkoutButton")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
