"use client";

import { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useLocale, useTranslations } from "next-intl";
import { isMotionOk } from "@/lib/animations";

export function BrandStory() {
  const t = useTranslations("brandStory");
  const locale = useLocale();
  const containerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) return;

    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "lines" });

        gsap.fromTo(
          split.lines,
          { clipPath: "inset(0 0 100% 0)", y: 24, opacity: 0 },
          {
            clipPath: "inset(0 0 0% 0)",
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: containerRef.current, start: "top 75%", once: true },
          },
        );
      }

      gsap.to(".story-image", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: { trigger: containerRef.current, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="story" ref={containerRef} className="bg-cream text-navy py-[80px] md:py-[120px] px-6 md:px-12 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 items-center">
        <div className="order-2 md:order-1 flex flex-col justify-center">
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-6">{t("eyebrow")}</p>

          {/* key={locale}: mismo motivo que en Hero — SplitText muta este <h2> a mano. */}
          <h2 key={locale} ref={headlineRef} className="font-serif text-[clamp(28px,4vw,48px)] font-bold leading-[1.05] mb-8">
            {t("headlineLine1")}
            <br />
            {t("headlineLine2")}
            <br />
            {t("headlineLine3Prefix")}
            <span className="text-sin-red italic">{t("headlineLine3Highlight")}</span>
            {t("headlineLine3Suffix")}
          </h2>

          <p className="text-[15px] leading-[1.7] text-navy/70 max-w-md">{t("body")}</p>
        </div>

        <div className="order-1 md:order-2 w-full aspect-[4/3] md:aspect-[3/4] relative rounded-2xl overflow-hidden bg-navy-mid flex items-center justify-center group story-image-wrapper">
          <div className="story-image absolute inset-[-10%] w-[120%] h-[120%] bg-navy-light/50 flex flex-col items-center justify-center">
            <div className="w-full h-full bg-[linear-gradient(45deg,rgba(15,27,61,0.8),rgba(15,27,61,0.2))] absolute inset-0 z-10" />
            <span className="relative z-20 text-white/10 group-hover:scale-110 transition-transform duration-700">
              <svg width="96" height="96" viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="10" width="52" height="22" rx="3" />
                <path d="M54 22 L62 22 L62 28 L54 28 Z" />
                <path d="M54 22 L58 14 L62 14 L62 22" />
                <rect x="8" y="14" width="10" height="8" rx="1.5" />
                <rect x="22" y="14" width="10" height="8" rx="1.5" />
                <rect x="36" y="14" width="10" height="8" rx="1.5" />
                <rect x="57" y="17" width="3" height="4" rx="1" />
                <circle cx="14" cy="32" r="5" />
                <circle cx="14" cy="32" r="2" />
                <circle cx="46" cy="32" r="5" />
                <circle cx="46" cy="32" r="2" />
                <circle cx="58" cy="32" r="4" />
                <circle cx="58" cy="32" r="1.5" />
                <path d="M20 10 L20 5 L44 5 L44 10" />
                <path d="M20 5 L32 2 L44 5" />
              </svg>
            </span>
            <span className="relative z-20 font-mono text-[10px] tracking-[0.15em] text-white/30 uppercase mt-4">
              {t("imageCaption")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
