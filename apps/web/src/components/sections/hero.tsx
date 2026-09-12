"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useLocale, useTranslations } from "next-intl";
import { HeroParticles } from "@/components/webgl/hero-particles";
import { isMotionOk } from "@/lib/animations";

export function Hero() {
  const t = useTranslations("hero");
  const locale = useLocale();
  const containerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) {
      gsap.set([logoRef.current, headlineRef.current, subheadRef.current, ctasRef.current?.children], {
        opacity: 1,
        y: 0,
        clipPath: "none",
        yPercent: 0,
        scale: 1,
      });
      return;
    }

    const ctx = gsap.context(() => {
      if (!headlineRef.current) return;

      const split = new SplitText(headlineRef.current, { type: "chars,lines" });

      gsap.set(logoRef.current, { opacity: 0, scale: 0.6, y: 20 });
      gsap.set(split.chars, { yPercent: 110, clipPath: "inset(0 0 100% 0)" });
      gsap.set(subheadRef.current, { opacity: 0, y: 20 });
      if (ctasRef.current) gsap.set(ctasRef.current.children, { opacity: 0, y: 16 });

      const tl = gsap.timeline({ delay: 0.2 });

      tl.to(logoRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: "back.out(1.7)" })
        .to(
          split.chars,
          { yPercent: 0, clipPath: "inset(0 0 0% 0)", stagger: 0.025, duration: 1.1, ease: "power4.out" },
          "-=0.4",
        )
        .to(subheadRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.5");

      if (ctasRef.current) {
        tl.to(ctasRef.current.children, { opacity: 1, y: 0, stagger: 0.1, duration: 0.6 }, "-=0.4");
      }

      gsap.to(logoRef.current, { y: -12, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.2 });

      return () => split.revert();
    }, containerRef);

    return () => ctx.revert();
    // Corre solo al montar: el título vuelve a montarse limpio con key={locale}
    // en vez de re-disparar esta animación en cada cambio de idioma.
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full h-[100svh] bg-sweet-white flex flex-col items-center justify-center text-center px-6 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(230,57,70,0.07) 0%, transparent 70%)" }}
      />

      <HeroParticles />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center pt-16">
        <img
          ref={logoRef}
          src="/videologo.gif"
          alt="Sweet Sin mascot"
          className="w-36 h-36 md:w-48 md:h-48 object-contain rounded-full mb-4 drop-shadow-[0_20px_40px_rgba(230,57,70,0.4)]"
        />

        {/* key={locale}: SplitText muta el DOM de este <h1> a mano; sin la
            key, React reconciliaría el nuevo texto contra ese DOM ya
            modificado. Con la key, React lo desmonta y monta uno limpio. */}
        <h1
          key={locale}
          ref={headlineRef}
          className="font-serif font-black text-[clamp(40px,10vw,110px)] leading-[0.9] text-navy mb-6"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("headlinePrefix")}
          <span className="text-sin-red italic font-serif">{t("headlineHighlight")}</span>
          {t("headlineSuffix")}
        </h1>

        <p
          ref={subheadRef}
          className="font-serif font-light italic text-[clamp(16px,2vw,22px)] text-navy/55 max-w-xl mx-auto leading-relaxed mb-10 md:mb-14"
        >
          {t("subhead")}
        </p>

        <div ref={ctasRef} className="flex flex-col sm:flex-row items-center gap-4">
          <a
            href="#menu"
            className="bg-sin-red text-white px-8 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-sin-red-light transition-all shadow-[0_8px_32px_rgba(230,57,70,0.22)] hover:shadow-[0_12px_40px_rgba(230,57,70,0.35)] hover:-translate-y-1 w-full sm:w-auto"
          >
            {t("ctaMenu")}
          </a>

          <a
            href="#story"
            className="text-navy/60 px-8 py-4 text-sm tracking-wide hover:text-navy transition-colors flex items-center gap-2 group w-full sm:w-auto justify-center"
          >
            {t("ctaStory")} <span className="group-hover:translate-y-1 transition-transform">↓</span>
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.2em] text-navy/30 uppercase">
        {t("scrollHint")}
      </div>
    </section>
  );
}
