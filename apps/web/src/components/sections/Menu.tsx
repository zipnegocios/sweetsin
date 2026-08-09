import { useState, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { products, Product } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { getDiscountForQty, VOLUME_TIERS } from '@/lib/pricing';
import { isMotionOk } from '@/lib/animations';

type Filter = 'all' | 'sin' | 'virtue' | 'coffee';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  sin: 'Sins',
  virtue: 'Virtues',
  coffee: 'Coffee',
};

export default function Menu() {
  const [filter, setFilter] = useState<Filter>('all');
  const containerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const displayedProducts = products.filter(p => filter === 'all' || p.category === filter);

  // Scroll reveal
  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.menu-card',
        { y: 48, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.06, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: containerRef.current, start: 'top 78%', once: true },
        },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Filter transition
  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.menu-card',
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
      );
    }, gridRef);
    return () => ctx.revert();
  }, [filter]);

  return (
    <section
      id="menu"
      ref={containerRef}
      className="bg-cream py-[80px] md:py-[120px] px-6 md:px-12 w-full min-h-screen"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 md:mb-16 gap-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">
              Indulgence, classified
            </p>
            <h2 className="font-serif text-[clamp(28px,4vw,48px)] font-bold text-navy leading-[1.05]">
              The <span className="text-sin-red italic">Menu</span>
            </h2>
          </div>

          <div className="flex bg-navy/[0.06] p-1 rounded-full w-max">
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  filter === f ? 'bg-sin-red text-white shadow-lg' : 'text-navy/40 hover:text-navy'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Grid: 2 cols on mobile, 4 on desktop */}
        <div
          ref={gridRef}
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
        >
          {displayedProducts.map((product) => (
            <MenuCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuCard({ product }: { product: Product }) {
  const { add, setQty, items } = useCart();
  const inCart = items.find(i => i.productId === product.id);
  const tier = inCart ? getDiscountForQty(inCart.qty) : null;
  const nextTierIndex = (tier ? VOLUME_TIERS.indexOf(tier) : VOLUME_TIERS.length) - 1;
  const nextTier = nextTierIndex >= 0 ? VOLUME_TIERS[nextTierIndex] : null;

  return (
    <div className="menu-card bg-white border border-navy/[0.07] rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:border-sin-red/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] flex flex-col">
      {/* Image — square */}
      <div className="aspect-square bg-cream-dark relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cream to-cream-dark" />
        )}

        {/* Category badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-mono text-[8px] md:text-[9px] tracking-[0.12em] uppercase z-20 ${
          product.category === 'sin' ? 'bg-sin-red/90 text-white' : 'bg-navy/90 text-cream'
        }`}>
          {product.category}
        </div>

        {/* Cart count bubble */}
        {inCart && (
          <div className="absolute top-2 right-2 w-5 h-5 md:w-6 md:h-6 bg-sin-red rounded-full flex items-center justify-center z-20">
            <span className="text-white font-mono font-bold text-[10px]">{inCart.qty}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 md:p-5 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-serif font-bold text-[14px] md:text-[18px] text-navy leading-tight">{product.name}</h3>
          <p className="text-[11px] md:text-[13px] text-navy/45 leading-relaxed mt-1 hidden md:block">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${product.price}</span>
          {inCart ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={inCart.qty}
                onChange={(e) => setQty(product.id, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                aria-label={`${product.name} quantity`}
                className="w-12 text-center font-mono text-[12px] text-navy border border-navy/15 rounded-full py-1 focus:border-sin-red outline-none"
              />
              <button
                onClick={() => add(product.id)}
                aria-label={`Add another ${product.name} to order`}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light active:scale-95 transition-all shadow-[0_2px_8px_rgba(230,57,70,0.30)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => add(product.id)}
              aria-label={`Add ${product.name} to order`}
              className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light active:scale-95 transition-all shadow-[0_2px_8px_rgba(230,57,70,0.30)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>
        {inCart && (tier || nextTier) && (
          <p className="text-[10px] font-mono text-sin-red/80 leading-tight">
            {tier
              ? `${Math.round(tier.discountPct * 100)}% off applied${nextTier ? ` — ${Math.round(nextTier.discountPct * 100)}% off at ${nextTier.minQty}+` : ''}`
              : `${Math.round((nextTier as NonNullable<typeof nextTier>).discountPct * 100)}% off at ${(nextTier as NonNullable<typeof nextTier>).minQty}+`}
          </p>
        )}
      </div>
    </div>
  );
}
