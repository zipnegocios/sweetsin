import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RepollaParticles from '../webgl/RepollaParticles';
import { isMotionOk } from '@/lib/animations';

export default function Spotlight() {
  const containerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) return;
    
    const ctx = gsap.context(() => {
      // Parallax image
      gsap.to('.spotlight-img-inner', {
        yPercent: -15,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={containerRef}
      className="bg-cream text-navy overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[600px]">
        {/* Image Side (Top on mobile) */}
        <div className="relative w-full aspect-video md:aspect-auto bg-navy overflow-hidden group">
          <div className="spotlight-img-inner absolute inset-[-15%] w-[130%] h-[130%] bg-navy-mid flex items-center justify-center overflow-hidden">
            <img
              src="/products/p15.jpg"
              alt="La Repolla — Sweet Sin profiteroles with homemade arequipe"
              className="absolute inset-0 w-full h-full object-cover opacity-75"
              loading="eager"
              decoding="async"
            />
            {/* Navy tint overlay to keep legibility of particles */}
            <div className="absolute inset-0 bg-navy/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(255,92,106,0.18)_0%,transparent_65%)]" />
          </div>
          
          <RepollaParticles />
          
          {/* Mobile Fallback Glow */}
          <div className="md:hidden absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(255,92,106,0.28)_0%,transparent_65%)] animate-pulse" />
        </div>

        {/* Content Side */}
        <div className="flex flex-col justify-center px-8 md:px-16 py-16 md:py-24">
          <div className="inline-block bg-sin-red/10 border border-sin-red/25 text-sin-red font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-1.5 rounded-full w-fit mb-8">
            Featured Product
          </div>
          
          <h2 className="font-serif text-[clamp(32px,5vw,56px)] font-black leading-[1.0] text-navy mb-6">
            Adelaide hasn't tasted <span className="text-sin-red italic">anything</span> like it.
          </h2>
          
          <p className="text-[15px] leading-[1.7] text-navy/60 max-w-md mb-10">
            La Repolla is our profiterole — filled with homemade arequipe, dusted with something you didn't know you were missing. It converts. Every. Single. Time.
          </p>
          
          <div className="flex items-center gap-6">
            <a 
              href="#preorder"
              className="bg-navy text-white px-8 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-sin-red hover:shadow-[0_8px_32px_rgba(230,57,70,0.25)] transition-all"
            >
              Try it first
            </a>
            <span className="font-mono text-[20px] text-sin-red">$13</span>
          </div>
        </div>
      </div>
    </section>
  );
}
