import { schedule } from '@/lib/data';
import { useRef, useState } from 'react';
import gsap from 'gsap';
import LocationMap from '@/components/ui/LocationMap';

const activeStop = schedule.find((slot) => slot.isActive) ?? schedule[0];

export default function FindUs() {
  return (
    <section id="find-us" className="bg-sweet-white py-[80px] md:py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        
        {/* Left Col: Schedule & Newsletter */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4 flex items-center gap-2">
            This week's schedule
          </p>
          <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-black text-navy leading-[1.0] mb-6">
            We show up where the cravings are.
          </h2>
          <p className="text-[15px] text-navy/50 max-w-md leading-[1.7] mb-10">
            The trailer moves. Follow us on Instagram or sign up for weekly location drops straight to your inbox.
          </p>
          
          <div className="space-y-2 mb-12">
            {schedule.map((slot) => (
              <div key={slot.id} className="flex justify-between items-center py-4 border-b border-navy/[0.07] group">
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${slot.isActive ? 'bg-sin-red animate-pulse' : 'bg-navy/20'}`} />
                  <div>
                    <span className="block text-sm font-medium text-navy">{slot.day}</span>
                    <span className="block text-xs text-navy/40 mt-1">{slot.timeRange}</span>
                  </div>
                </div>
                <div className="text-sm text-navy/70 text-right max-w-[150px] md:max-w-none">
                  {slot.location}
                </div>
              </div>
            ))}
          </div>
          
          <NewsletterForm />
        </div>
        
        {/* Right Col: Map & IG */}
        <div className="flex flex-col gap-6">
          <div className="w-full h-[300px] md:h-[400px] bg-cream rounded-2xl relative overflow-hidden border border-navy/[0.08]">
            <LocationMap
              lat={activeStop.lat}
              lng={activeStop.lng}
              label={activeStop.location}
              className="absolute inset-0 grayscale sepia brightness-75"
            />
            <div className="absolute bottom-4 left-4 pointer-events-none">
              <span className="font-mono text-[9px] tracking-widest text-white px-2 py-1 bg-black/50 rounded backdrop-blur-sm uppercase">
                {activeStop.location}
              </span>
            </div>
          </div>
          
          {/* Instagram Grid Placeholder */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map((i) => (
              <a key={i} href="#" className="aspect-square bg-cream-dark relative rounded-xl overflow-hidden group border border-navy/[0.07]">
                <div className={`absolute inset-0 bg-gradient-to-br from-cream to-cream-dark opacity-80`} />
                <div className="absolute inset-0 bg-sin-red/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.593c-.521-.464-10-8.894-10-13.093C2 5.045 4.478 3 7.5 3c1.922 0 3.743 1.042 4.5 2.5C12.757 4.042 14.578 3 16.5 3 19.522 3 22 5.045 22 8.5c0 4.199-9.479 12.629-10 13.093z"/>
                  </svg>
                  <span className="text-white text-xs font-medium mt-1">{(i * 123) % 400 + 50}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function NewsletterForm() {
  const [status, setStatus] = useState<'idle'|'submitting'|'success'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const successIconRef = useRef<HTMLSpanElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRef.current?.value) return;
    
    setStatus('submitting');
    setTimeout(() => {
      setStatus('success');
      if (successIconRef.current) {
        gsap.fromTo(successIconRef.current, 
          { scale: 0, opacity: 0 }, 
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }
        );
      }
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-sm">
      {status === 'success' ? (
        <div className="flex items-center gap-3 text-sin-red bg-sin-red/10 border border-sin-red/20 px-6 py-4 rounded-full">
          <span ref={successIconRef} className="flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <span className="text-sm font-medium">You're in. We'll see you soon.</span>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="email"
            placeholder="your@email.com"
            required
            disabled={status === 'submitting'}
            className="w-full bg-white border border-navy/12 rounded-full px-6 py-4 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors pr-16 disabled:opacity-50 shadow-sm"
          />
          <button 
            type="submit"
            disabled={status === 'submitting'}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-sin-red text-white rounded-full flex items-center justify-center hover:bg-sin-red-light transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}
