"use client";

import { useEffect, useRef, useState } from "react";

// navigator.connection y navigator.deviceMemory son extensiones de Chrome
// sin estandarizar — lib.dom.d.ts no las tipa, por eso la interfaz local
// en vez de un "as any" (que eslint-config-next bloquea como error).
interface NavigatorWithExtras extends Navigator {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

export function HeroParticles() {
  const [mounted, setMounted] = useState(false);
  const [useWebGL, setUseWebGL] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const nav = navigator as NavigatorWithExtras;
      const isGoodConnection = !nav.connection?.saveData;
      const isGoodMemory = !(nav.deviceMemory !== undefined && nav.deviceMemory < 2);

      if (gl && isGoodConnection && isGoodMemory && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setUseWebGL(true);
      }
    } catch (e) {
      console.warn("WebGL not available or disabled", e);
    }
  }, []);

  if (!mounted || !useWebGL) return null;

  return <ThreeJSImpl />;
}

function ThreeJSImpl() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    import("three").then((THREE) => {
      if (!canvasRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 100;

      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const isMobile = width < 768;
      const particleCount = isMobile ? (navigator.hardwareConcurrency <= 4 ? 500 : 800) : 2000;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const originalPositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * 20;

        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius + 10;
        const z = (Math.random() - 0.5) * 10;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xe63946,
        size: isMobile ? 1.5 : 2,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      const targetPositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        targetPositions[i * 3] = (Math.random() - 0.5) * 180;
        targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 180;
        targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }

      let progress = 0;
      const mouse = new THREE.Vector2(0, 0);
      const targetMouse = new THREE.Vector2(0, 0);

      const handleMouseMove = (e: MouseEvent) => {
        if (isMobile) return;
        targetMouse.x = (e.clientX / width) * 2 - 1;
        targetMouse.y = -(e.clientY / height) * 2 + 1;
      };

      window.addEventListener("mousemove", handleMouseMove);

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", handleResize);

      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const time = clock.getElapsedTime();
        const positions = particles.geometry.attributes.position.array as Float32Array;

        if (progress < 1) {
          progress += 0.01;
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = originalPositions[i * 3] + (targetPositions[i * 3] - originalPositions[i * 3]) * easeProgress;
            positions[i * 3 + 1] = originalPositions[i * 3 + 1] + (targetPositions[i * 3 + 1] - originalPositions[i * 3 + 1]) * easeProgress;
            positions[i * 3 + 2] = originalPositions[i * 3 + 2] + (targetPositions[i * 3 + 2] - originalPositions[i * 3 + 2]) * easeProgress;
          }

          material.opacity = 0.6 - 0.45 * easeProgress;
        } else {
          for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;

            positions[ix] += Math.sin(time + targetPositions[iy] * 0.1) * 0.05;
            positions[iy] += Math.cos(time + targetPositions[ix] * 0.1) * 0.05;
          }
        }

        if (!isMobile) {
          mouse.x += (targetMouse.x - mouse.x) * 0.05;
          mouse.y += (targetMouse.y - mouse.y) * 0.05;

          particles.rotation.y = mouse.x * 0.1;
          particles.rotation.x = -mouse.y * 0.1;
        }

        particles.geometry.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animationFrameId);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    });
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
