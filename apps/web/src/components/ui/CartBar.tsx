import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { useCart } from '@/lib/cart';
import { products } from '@/lib/data';
import { getLineTotal } from '@/lib/pricing';

export default function CartBar() {
  const { items, add, remove, clear, totalQty, totalPrice, totalSavings, openCheckout } = useCart();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevQty = useRef(0);

  // Animate bar in/out based on cart content
  useEffect(() => {
    if (!barRef.current) return;
    if (totalQty > 0) {
      gsap.fromTo(barRef.current,
        { y: 80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }
      );
    } else {
      gsap.to(barRef.current, { y: 80, opacity: 0, duration: 0.3 });
      setOpen(false);
    }
    prevQty.current = totalQty;
  }, [totalQty]);

  // Drawer open/close
  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return;
    if (open) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.fromTo(drawerRef.current, { y: '100%' }, { y: '0%', duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(drawerRef.current, { y: '100%', duration: 0.35, ease: 'power2.in' });
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.25 });
    }
  }, [open]);

  if (totalQty === 0) return null;

  const cartProducts = items.map(i => ({
    item: i,
    product: products.find(p => p.id === i.productId)!,
  }));

  return (
    <>
      {/* Drawer overlay */}
      <div
        ref={overlayRef}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[90] bg-navy/40 backdrop-blur-sm ${open ? 'pointer-events-auto' : 'pointer-events-none opacity-0'}`}
      />

      {/* Cart drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-[95] bg-white rounded-t-3xl shadow-[0_-8px_48px_rgba(15,27,61,0.18)] translate-y-full"
      >
        <div className="w-12 h-1 bg-navy/15 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-6 pb-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif font-bold text-navy text-xl">Your order</h3>
            <button
              onClick={() => { clear(); setOpen(false); }}
              className="font-mono text-[10px] uppercase tracking-wider text-navy/30 hover:text-sin-red transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {cartProducts.map(({ item, product }) => (
              <div key={item.productId} className="flex items-center gap-3">
                {product.image && (
                  <img src={product.image} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-semibold text-navy text-[14px] truncate">{product.name}</p>
                  <p className="font-mono text-[12px] text-sin-red">${getLineTotal(product.price, item.qty).toFixed(2)}</p>
                </div>
                {/* Qty controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => remove(item.productId)}
                    className="w-7 h-7 rounded-full border border-navy/15 text-navy flex items-center justify-center hover:border-sin-red hover:text-sin-red transition-colors text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="font-mono text-[13px] text-navy w-4 text-center">{item.qty}</span>
                  <button
                    onClick={() => add(item.productId)}
                    className="w-7 h-7 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalSavings > 0 && (
            <div className="flex justify-between items-center mb-1 text-sin-red">
              <span className="font-mono text-[10px] uppercase tracking-wider">Volume savings</span>
              <span className="font-mono text-[12px] font-semibold">-${totalSavings.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-navy/10 pt-4 flex justify-between items-center mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
            <span className="font-serif font-bold text-navy text-xl">${totalPrice.toFixed(2)}</span>
          </div>

          <button
            onClick={() => { openCheckout(); setOpen(false); }}
            className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors shadow-[0_4px_20px_rgba(230,57,70,0.28)] flex items-center justify-center gap-3 mb-2"
          >
            Checkout
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <p className="text-center font-mono text-[9px] text-navy/30 uppercase tracking-wider pb-2">
            Choose pickup, delivery, and how you'd like to pay
          </p>
        </div>

        {/* Safe area spacer for mobile */}
        <div className="h-safe-bottom" />
      </div>

      {/* Floating cart pill — sits above the mobile nav bar */}
      <div
        ref={barRef}
        className="fixed bottom-[72px] md:bottom-6 left-1/2 -translate-x-1/2 z-[89] opacity-0 translate-y-20"
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 bg-navy text-white pl-4 pr-5 py-3 rounded-full shadow-[0_8px_32px_rgba(15,27,61,0.35)] hover:bg-navy-mid transition-colors"
        >
          <span className="w-6 h-6 bg-sin-red rounded-full flex items-center justify-center font-mono font-bold text-[11px]">
            {totalQty}
          </span>
          <span className="font-medium text-[13px] tracking-wide">Your order</span>
          <span className="font-mono text-[13px] text-sin-red font-semibold">${totalPrice.toFixed(2)}</span>
        </button>
      </div>
    </>
  );
}
