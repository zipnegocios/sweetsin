import { useState, useRef, useLayoutEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { useForm } from 'react-hook-form';
// Importing from this module also registers the ScrollTrigger plugin.
import { isMotionOk } from '@/lib/animations';

export default function Events() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) return;

    const ctx = gsap.context(() => {
      // Must be fromTo, not from: a ScrollTrigger refresh (which fires on its
      // own once images finish loading) re-records the element's *current*
      // values as the tween's end state. With `from`, that bakes in opacity 0
      // and the cards animate 0 -> 0, staying invisible forever.
      gsap.fromTo(
        '.event-card',
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 85%',
            once: true,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <section id="events" ref={containerRef} className="bg-sweet-white py-[80px] md:py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">
            For businesses & celebrations
          </p>
          <h2 className="font-serif text-[clamp(32px,5vw,48px)] font-black text-navy leading-[1.05] mb-4">
            Make it <span className="text-sin-red italic">sinful</span>.
          </h2>
          <p className="text-[15px] text-navy/45 max-w-lg mx-auto">
            Your event deserves a temptation people won't stop talking about.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <EventCard 
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2.5"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            }
            title="Corporate Events" 
            desc="Branded catering packages for offices, launches & team days. Minimum 20 pax." 
          />
          <EventCard 
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 L6 9 h12 Z"/>
                <path d="M6 9 L5 15 C5 18.5 8 21 12 21 C16 21 19 18.5 19 15 L18 9"/>
                <path d="M9 9 L7.5 4 M15 9 L16.5 4"/>
              </svg>
            }
            title="Weddings" 
            desc="Dessert stations & custom obleas towers. Unforgettable, guaranteed." 
          />
          <EventCard 
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9 L12 3 L21 9 V10 H3 V9Z"/>
                <line x1="3" y1="10" x2="3" y2="20"/>
                <line x1="21" y1="10" x2="21" y2="20"/>
                <line x1="3" y1="20" x2="21" y2="20"/>
                <line x1="8" y1="20" x2="8" y2="14"/>
                <line x1="16" y1="20" x2="16" y2="14"/>
                <rect x="8" y="14" width="8" height="6" rx="1"/>
              </svg>
            }
            title="Festivals & Markets" 
            desc="Full trailer setup for outdoor events across SA. Subject to availability." 
          />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <button 
            onClick={openModal}
            className="bg-sin-red text-white px-8 py-4 rounded-full text-sm font-bold tracking-wide hover:bg-sin-red-light transition-colors w-full md:w-auto shadow-[0_4px_20px_rgba(230,57,70,0.25)] flex items-center justify-center gap-2"
          >
            Get a quote
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          
          <a 
            href="https://wa.me/61433508831?text=Hola%21%20Me%20interesa%20Sweet%20Sin%20para%20un%20evento.%20%C2%BFPodr%C3%ADan%20darme%20m%C3%A1s%20informaci%C3%B3n%3F"
            target="_blank" rel="noreferrer"
            className="md:hidden border border-navy/20 text-navy px-8 py-4 rounded-full text-sm tracking-wide flex items-center justify-center gap-2 w-full"
          >
            WhatsApp: +61 433 508 831
          </a>
        </div>
      </div>

      <QuoteModal isOpen={isModalOpen} onClose={closeModal} />
    </section>
  );
}

function EventCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className="event-card bg-white rounded-[20px] p-8 shadow-[0_2px_20px_rgba(15,27,61,0.07)] hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] hover:-translate-y-1 transition-all duration-300 border border-navy/[0.05]">
      <div className="mb-6 bg-sin-red/[0.08] w-14 h-14 rounded-xl flex items-center justify-center border border-sin-red/[0.15] text-sin-red">
        {icon}
      </div>
      <h3 className="font-serif font-bold text-[20px] text-navy mb-3">{title}</h3>
      <p className="text-[14px] text-navy/50 leading-[1.7]">
        {desc}
      </p>
    </div>
  );
}

function QuoteModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, formState: { isSubmitting, isSubmitSuccessful } } = useForm();

  useLayoutEffect(() => {
    if (!isOpen) return;
    
    // Animation in
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(modalRef.current, 
      { scaleY: 0, opacity: 0, transformOrigin: 'center center' }, 
      { scaleY: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' }
    );
  }, [isOpen]);

  const handleClose = () => {
    // Animation out
    gsap.to(modalRef.current, { scaleY: 0, opacity: 0, duration: 0.3, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, onComplete: onClose });
  };

  const onSubmit = async (data: any) => {
    // Mock API call
    await new Promise(r => setTimeout(r, 1000));
    console.log("Quote requested:", data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div ref={overlayRef} className="absolute inset-0 modal-overlay" onClick={handleClose} />
      
      <div ref={modalRef} className="relative bg-white w-full max-w-lg rounded-3xl border border-navy/[0.08] p-6 md:p-10 shadow-[0_24px_80px_rgba(15,27,61,0.18)] overflow-y-auto max-h-[90vh]">
        <button onClick={handleClose} aria-label="Close quote form" className="absolute top-6 right-6 text-navy/30 hover:text-navy transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {isSubmitSuccessful ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-sin-red/10 text-sin-red rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h3 className="font-serif text-2xl text-navy mb-2">Request Sent</h3>
            <p className="text-navy/45 text-sm">We'll be in touch with your custom quote soon.</p>
            <button onClick={handleClose} className="mt-8 bg-navy/8 text-navy px-6 py-3 rounded-full text-sm hover:bg-navy/12 transition-colors">Close</button>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-3xl font-bold text-navy mb-2">Event Quote</h3>
            <p className="text-navy/45 text-sm mb-8">Fill out the details and we'll get back to you with a custom quote.</p>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="quote-name" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Name</label>
                  <input id="quote-name" required {...register("name")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="quote-company" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Company (Optional)</label>
                  <input id="quote-company" {...register("company")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="quote-type" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Event Type</label>
                  <select id="quote-type" required {...register("type")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors appearance-none">
                    <option value="">Select...</option>
                    <option value="corporate">Corporate Event</option>
                    <option value="wedding">Wedding</option>
                    <option value="festival">Festival / Market</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="quote-date" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Date</label>
                  <input id="quote-date" required type="date" {...register("date")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors [color-scheme:light]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quote-guests" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Estimated Guests</label>
                <input id="quote-guests" required type="number" min="20" {...register("guests")} placeholder="Min 20 pax" className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="quote-message" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">Message</label>
                <textarea id="quote-message" required {...register("message")} rows={3} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors resize-none placeholder:text-navy/30" placeholder="Tell us a bit about the event..." />
              </div>
              
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-sin-red text-white font-bold text-sm py-4 rounded-xl hover:bg-sin-red-light transition-colors mt-4 disabled:opacity-50 shadow-[0_4px_16px_rgba(230,57,70,0.25)]"
              >
                {isSubmitting ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
