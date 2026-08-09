import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    
    const nav = navRef.current;
    if (!nav) return;

    const trigger = ScrollTrigger.create({
      start: '80px top',
      onEnter: () => nav.classList.add('is-scrolled'),
      onLeaveBack: () => nav.classList.remove('is-scrolled'),
    });

    // Only kill this component's own trigger. Killing every ScrollTrigger on the
    // page would freeze other sections' entry tweens at their `from` state.
    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <nav 
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 py-6 transition-all duration-400 ease-out"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      <style>{`
        nav.is-scrolled {
          background-color: rgba(253, 250, 247, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 1px 0 rgba(15,27,61,0.07);
          padding-top: 1rem;
          padding-bottom: 1rem;
        }
      `}</style>
      
      <Link href="/" className="flex items-center">
        <img
          src="/logo-flat.png"
          alt="Sweet Sin"
          className="h-12 w-auto rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
          style={{ imageRendering: 'auto' }}
        />
      </Link>
      
      <ul className="hidden md:flex gap-8 text-xs font-mono tracking-widest text-navy/50 uppercase">
        <li><a href="#menu" className="hover:text-sin-red transition-colors">Menu</a></li>
        <li><a href="#events" className="hover:text-sin-red transition-colors">Events</a></li>
        <li><a href="#find-us" className="hover:text-sin-red transition-colors">Find Us</a></li>
      </ul>
      
      <a 
        href="#preorder"
        className="hidden md:inline-flex bg-sin-red text-white text-xs font-medium uppercase tracking-wider px-6 py-3 rounded-full hover:bg-sin-red-light hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(230,57,70,0.3)]"
      >
        Order Now
      </a>
      
      {/* Mobile: "Order Now" pill instead of dead hamburger — nav handled by bottom tab bar */}
      <a
        href="#preorder"
        className="md:hidden bg-sin-red text-white text-[11px] font-medium uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-sin-red-light transition-colors shadow-[0_4px_12px_rgba(230,57,70,0.30)]"
      >
        Order
      </a>
    </nav>
  );
}
