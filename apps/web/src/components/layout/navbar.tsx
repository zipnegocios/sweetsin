"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import "@/lib/animations";
import { useCart } from "@/lib/cart-store";

export function Navbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const { totalQty, openDrawer } = useCart();

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const trigger = ScrollTrigger.create({
      start: "80px top",
      onEnter: () => nav.classList.add("is-scrolled"),
      onLeaveBack: () => nav.classList.remove("is-scrolled"),
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const toggleLocale = () => {
    const next = locale === "en" ? "es" : "en";
    router.replace(pathname, { locale: next });
    router.refresh();
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 py-6 transition-all duration-400 ease-out"
      style={{ backgroundColor: "transparent" }}
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
          src="/isotipo.gif"
          alt="Sweet Sin"
          className="h-12 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        />
      </Link>

      <ul className="hidden md:flex items-center gap-8 text-xs font-mono tracking-widest text-navy/50 uppercase">
        <li>
          <a href="#menu" className="hover:text-sin-red transition-colors">{t("menu")}</a>
        </li>
        <li>
          <a href="#events" className="hover:text-sin-red transition-colors">{t("events")}</a>
        </li>
        <li>
          <a href="#find-us" className="hover:text-sin-red transition-colors">{t("findUs")}</a>
        </li>
        <li>
          <button
            onClick={toggleLocale}
            className="normal-case tracking-normal font-sans hover:text-sin-red transition-colors"
          >
            {tCommon("switchToLanguage")}
          </button>
        </li>
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLocale}
          className="md:hidden text-navy/50 text-[11px] font-mono uppercase tracking-widest"
        >
          {tCommon("switchToLanguage")}
        </button>
        <button
          onClick={openDrawer}
          className="relative w-10 h-10 flex items-center justify-center text-navy/70 hover:text-sin-red transition-colors"
          aria-label="Open cart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {totalQty > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-sin-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {totalQty}
            </span>
          )}
        </button>
        <a
          href="#menu"
          className="hidden md:inline-flex bg-sin-red text-white text-xs font-medium uppercase tracking-wider px-6 py-3 rounded-full hover:bg-sin-red-light hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(230,57,70,0.3)]"
        >
          {t("orderNow")}
        </a>
        <a
          href="#menu"
          className="md:hidden bg-sin-red text-white text-[11px] font-medium uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-sin-red-light transition-colors shadow-[0_4px_12px_rgba(230,57,70,0.30)]"
        >
          {t("orderNow")}
        </a>
      </div>
    </nav>
  );
}
