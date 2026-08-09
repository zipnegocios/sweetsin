import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { useCart } from '@/lib/cart';
import { products } from '@/lib/data';

export default function CartBar() {
  const { items, add, remove, clear, totalQty, totalPrice, sendToWhatsApp } = useCart();
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
                  <p className="font-mono text-[12px] text-sin-red">${(product.price * item.qty).toFixed(2)}</p>
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

          <div className="border-t border-navy/10 pt-4 flex justify-between items-center mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
            <span className="font-serif font-bold text-navy text-xl">${totalPrice.toFixed(2)}</span>
          </div>

          <button
            onClick={() => { sendToWhatsApp(); setOpen(false); }}
            className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors shadow-[0_4px_20px_rgba(230,57,70,0.28)] flex items-center justify-center gap-3 mb-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Send order via WhatsApp
          </button>
          <p className="text-center font-mono text-[9px] text-navy/30 uppercase tracking-wider pb-2">
            We'll confirm pickup time with you
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
