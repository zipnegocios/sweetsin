"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

function TabIcon({ id }: { id: string }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "menu":
      return (
        <svg {...props}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        </svg>
      );
    case "events":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M9 16l1.5 1.5L14 13" />
        </svg>
      );
    case "order":
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "find-us":
      return (
        <svg {...props}>
          <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNav() {
  const t = useTranslations("nav");
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [activeTab, setActiveTab] = useState("menu");

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // "order" apunta a #menu (no #preorder) hasta que Fase 3 tenga carrito/checkout real.
  const tabs = [
    { id: "menu", label: t("menu"), href: "#menu" },
    { id: "events", label: t("events"), href: "#events" },
    { id: "order", label: t("order"), href: "#menu" },
    { id: "find-us", label: t("findUs"), href: "#find-us" },
  ];

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 bg-sweet-dark/90 backdrop-blur-xl border-t border-white/10 transition-transform duration-300 ease-out flex justify-around items-center px-2 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          onClick={() => setActiveTab(tab.id)}
          className="flex flex-col items-center justify-center w-full h-full gap-1"
        >
          <span className={`transition-all ${activeTab === tab.id ? "scale-110 text-sin-red" : "opacity-50 text-white"}`}>
            <TabIcon id={tab.id} />
          </span>
          {activeTab === tab.id && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-sin-red">{tab.label}</span>
          )}
        </a>
      ))}
    </div>
  );
}
