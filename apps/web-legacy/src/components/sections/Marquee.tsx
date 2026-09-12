import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { isMotionOk } from '@/lib/animations';

export default function Marquee() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  
  const text = "Obleas con Arequipe · Fresas con Crema · La Repolla · Arequipe Artesanal · Gluttony · Envy · Lust · Wrath · Pride · Greed · Sloth · ";

  useEffect(() => {
    if (!isMotionOk() || !trackRef.current) return;
    
    // We duplicate the content to ensure smooth loop
    const track = trackRef.current;
    
    const animation = gsap.to(track, {
      xPercent: -50,
      repeat: -1,
      duration: 25,
      ease: 'none',
    });

    const handleMouseEnter = () => gsap.to(animation, { timeScale: 2.5, duration: 0.5 });
    const handleMouseLeave = () => gsap.to(animation, { timeScale: 1, duration: 0.5 });

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      animation.kill();
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <section 
      ref={containerRef}
      className="w-full h-12 md:h-14 bg-navy overflow-hidden flex items-center select-none"
    >
      <div 
        ref={trackRef}
        className="whitespace-nowrap flex font-serif font-bold italic text-[15px] tracking-[0.02em] text-cream/75 animate-marquee"
        style={{ width: 'max-content' }}
      >
        <span className="pr-2">{text}</span>
        <span className="pr-2">{text}</span>
        <span className="pr-2">{text}</span>
        <span className="pr-2">{text}</span>
      </div>
    </section>
  );
}
