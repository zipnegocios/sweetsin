import { schedule, type ScheduleEntry } from '@/lib/data';
import { useRef, useState } from 'react';
import gsap from 'gsap';
import LocationMap from '@/components/ui/LocationMap';

const activeStop = schedule.find((slot) => slot.isActive) ?? schedule[0];

export default function FindUs() {
  const [selectedStop, setSelectedStop] = useState<ScheduleEntry>(activeStop);

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
              <button
                key={slot.id}
                onClick={() => setSelectedStop(slot)}
                className={`w-full flex justify-between items-center py-4 border-b transition-colors text-left ${
                  selectedStop.id === slot.id ? 'border-sin-red/30' : 'border-navy/[0.07] hover:border-navy/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${slot.isActive ? 'bg-sin-red animate-pulse' : 'bg-navy/20'}`} />
                  <div>
                    <span className={`block text-sm font-medium ${selectedStop.id === slot.id ? 'text-sin-red' : 'text-navy'}`}>{slot.day}</span>
                    <span className="block text-xs text-navy/40 mt-1">{slot.timeRange}</span>
                  </div>
                </div>
                <div className="text-sm text-navy/70 text-right max-w-[150px] md:max-w-none">
                  {slot.location}
                </div>
              </button>
            ))}
          </div>
          
          <NewsletterForm />
        </div>
        
        {/* Right Col: Map & IG */}
        <div className="flex flex-col gap-6">
          <div className="w-full h-[300px] md:h-[400px] bg-cream rounded-2xl relative overflow-hidden border border-navy/[0.08]">
            <LocationMap
              lat={selectedStop.lat}
              lng={selectedStop.lng}
              label={selectedStop.location}
              className="absolute inset-0"
            />
            <div className="absolute bottom-4 left-4 pointer-events-none">
              <span className="font-mono text-[9px] tracking-widest text-white px-2 py-1 bg-black/50 rounded backdrop-blur-sm uppercase">
                {selectedStop.location}
              </span>
            </div>
          </div>
          
          {/* Instagram feed placeholder — reserves the layout until the real feed is wired up */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map((i) => (
              <a
                key={i}
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-cream-dark relative rounded-xl overflow-hidden group border border-navy/[0.07] flex items-center justify-center hover:border-sin-red/30 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-navy/25 group-hover:text-sin-red/60 transition-colors">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
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
