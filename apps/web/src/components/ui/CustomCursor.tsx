import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if pointer is fine
    const isFine = window.matchMedia('(pointer: fine)').matches;
    if (!isFine) return;
    
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const moveCursor = (e: MouseEvent) => {
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.08 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.25 });
    };

    const handleHoverIn = () => {
      gsap.to(dot, { scale: 0, duration: 0.2 });
      gsap.to(ring, { scale: 1.8, backgroundColor: 'rgba(230,57,70,0.15)', duration: 0.2 });
    };

    const handleHoverOut = () => {
      gsap.to(dot, { scale: 1, duration: 0.2 });
      gsap.to(ring, { scale: 1, backgroundColor: 'transparent', duration: 0.2 });
    };

    const handleMouseDown = () => {
      gsap.to(ring, { scaleX: 0.8, scaleY: 1.2, duration: 0.1 });
    };

    const handleMouseUp = () => {
      gsap.to(ring, { scaleX: 1.8, scaleY: 1.8, duration: 0.1 });
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const interactiveElements = document.querySelectorAll('a, button, [role="button"], input, select, textarea');
    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', handleHoverIn);
      el.addEventListener('mouseleave', handleHoverOut);
    });

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      interactiveElements.forEach((el) => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
    };
  }, []);

  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null;
  }

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
