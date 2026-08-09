import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isMotionOk } from '@/lib/animations';
import { useCart } from '@/lib/cart';

export default function Preorder() {
  const containerRef = useRef<HTMLElement>(null);
  const { totalQty, openCheckout } = useCart();

  function handleStartOrder() {
    if (totalQty === 0) {
      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    openCheckout();
  }

  useLayoutEffect(() => {
    if (!isMotionOk()) return;
    
    const ctx = gsap.context(() => {
      // fromTo, not from: a ScrollTrigger refresh re-records the element's
      // current values as the end state, which with `from` bakes in opacity 0
      // and leaves the steps permanently invisible.
      gsap.fromTo(
        '.preorder-step',
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 70%',
            once: true,
          },
        },
      );
    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <section 
      id="preorder" 
      ref={containerRef}
      className="relative bg-cream py-[80px] md:py-[120px] px-6 overflow-hidden"
    >
      {/* Subtle red tint top edge */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(230,57,70,0.06) 0%, transparent 60%)' }}
      />
      
      <div className="relative z-10 max-w-[1000px] mx-auto text-center">
        <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">
          Skip the queue
        </p>
        <h2 className="font-serif text-[clamp(36px,5vw,64px)] font-black text-navy leading-[0.95] mb-6">
          Ready to <span className="text-sin-red italic">sin?</span>
        </h2>
        <p className="text-[16px] text-navy/55 max-w-md mx-auto mb-16">
          Preorder for pickup. No queue, no waiting — just the good stuff.
        </p>
        
        <div className="flex flex-col md:flex-row justify-center gap-10 md:gap-0 mb-16 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[1px] bg-navy/15 z-0" />
          
          <div className="preorder-step flex-1 relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 bg-white border border-navy/10 rounded-full flex items-center justify-center font-serif font-black text-xl text-sin-red mb-4 relative shadow-sm">
              1
              <div className="md:hidden absolute top-[56px] w-[1px] h-10 bg-navy/15" />
            </div>
            <h3 className="font-medium text-[15px] text-navy mb-1">Choose your sins</h3>
            <p className="text-[12px] text-navy/45">Pick items from the menu</p>
          </div>
          
          <div className="preorder-step flex-1 relative z-10 flex flex-col items-center mt-6 md:mt-0">
            <div className="w-14 h-14 bg-white border border-navy/10 rounded-full flex items-center justify-center font-serif font-black text-xl text-sin-red mb-4 relative shadow-sm">
              2
              <div className="md:hidden absolute top-[56px] w-[1px] h-10 bg-navy/15" />
            </div>
            <h3 className="font-medium text-[15px] text-navy mb-1">Pay securely</h3>
            <p className="text-[12px] text-navy/45">Stripe checkout, under 2 min</p>
          </div>
          
          <div className="preorder-step flex-1 relative z-10 flex flex-col items-center mt-6 md:mt-0">
            <div className="w-14 h-14 bg-white border border-navy/10 rounded-full flex items-center justify-center font-serif font-black text-xl text-sin-red mb-4 shadow-sm">
              3
            </div>
            <h3 className="font-medium text-[15px] text-navy mb-1">Pick up & enjoy</h3>
            <p className="text-[12px] text-navy/45">Fresh, ready at the trailer</p>
          </div>
        </div>
        
        <button
          onClick={handleStartOrder}
          className="bg-sin-red text-white px-10 py-5 rounded-full font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-all shadow-[0_8px_32px_rgba(230,57,70,0.25)] hover:shadow-[0_12px_40px_rgba(230,57,70,0.35)] hover:-translate-y-1 inline-flex items-center gap-3"
        >
          Start your order
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        
        <p className="mt-8 font-mono text-[9px] text-navy/35 tracking-[0.1em] uppercase">
          A small processing fee applies, passed directly from Stripe.
        </p>
      </div>
    </section>
  );
}
