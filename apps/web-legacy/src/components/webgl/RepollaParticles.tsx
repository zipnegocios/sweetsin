import { useEffect, useRef, useState } from 'react';
import { isMotionOk } from '@/lib/animations';

function hasWebGLSupport(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

export default function RepollaParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [webglOk, setWebglOk] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWebglOk(hasWebGLSupport());
  }, []);

  useEffect(() => {
    if (!mounted || !webglOk || !canvasRef.current || !isMotionOk()) return;
    
    // Only run if not mobile roughly
    if (window.innerWidth < 768) return;

    let animationFrameId: number;
    let cleanup: () => void;

    import('three').then((THREE) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      if (!parent) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, parent.clientWidth / parent.clientHeight, 0.1, 1000);
      camera.position.z = 50;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch {
        return; // WebGL unavailable — silently skip
      }
      renderer.setSize(parent.clientWidth, parent.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const particleCount = 400;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const speeds = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
        speeds[i] = Math.random() * 0.02 + 0.01;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

      // Soft rose (sin-red-light) — keeps the glow inside the red/navy bicolor
      const material = new THREE.PointsMaterial({
        color: 0xFF5C6A,
        size: 2,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      let mouse = { x: 0, y: 0 };
      let targetMouse = { x: 0, y: 0 };

      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        targetMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      };

      window.addEventListener('mousemove', handleMouseMove);

      const clock = new THREE.Clock();

      let isVisible = false;
      const observer = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
      }, { threshold: 0.1 });
      
      observer.observe(canvas);

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        
        if (!isVisible) return;

        const time = clock.getElapsedTime();
        const positions = particles.geometry.attributes.position.array as Float32Array;
        const speeds = particles.geometry.attributes.speed.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const iy = i * 3 + 1;
          
          // Slow organic smoke/vapor movement
          positions[iy] += speeds[i];
          positions[ix] += Math.sin(time * 0.5 + i) * 0.02;
          
          // Reset if it floats too high
          if (positions[iy] > 50) {
            positions[iy] = -50;
            positions[ix] = (Math.random() - 0.5) * 100;
          }
        }

        particles.geometry.attributes.position.needsUpdate = true;

        // Subtle mouse parallax
        mouse.x += (targetMouse.x - mouse.x) * 0.02;
        mouse.y += (targetMouse.y - mouse.y) * 0.02;
        
        particles.rotation.y = mouse.x * 0.05;
        particles.rotation.x = -mouse.y * 0.05;

        renderer.render(scene, camera);
      };

      animate();
      
      cleanup = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        observer.disconnect();
        cancelAnimationFrame(animationFrameId);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [mounted, webglOk]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen hidden md:block" 
      style={{ zIndex: 10 }}
    />
  );
}
