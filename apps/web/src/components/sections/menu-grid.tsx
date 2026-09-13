"use client";

import { useState, useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import type { Product, ProductCategory } from "@workspace/domain/products";
import { useLocale, useTranslations } from "next-intl";
import { isMotionOk } from "@/lib/animations";
import { useCart } from "@/lib/cart-store";

type Filter = "all" | ProductCategory;

export function MenuGrid({ products }: { products: Product[] }) {
  const t = useTranslations("menu");
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const containerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filterLabels: Record<Filter, string> = {
    all: t("filterAll"),
    sin: t("filterSin"),
    virtue: t("filterVirtue"),
    coffee: t("filterCoffee"),
  };

  const displayedProducts = products.filter((p) => filter === "all" || p.category === filter);

  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".menu-card",
        { y: 48, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 78%", once: true },
        },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".menu-card",
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: "power2.out" },
      );
    }, gridRef);
    return () => ctx.revert();
  }, [filter]);

  return (
    <section id="menu" ref={containerRef} className="bg-cream py-[80px] md:py-[120px] px-6 md:px-12 w-full min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 md:mb-16 gap-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">{t("eyebrow")}</p>
            <h2 className="font-serif text-[clamp(28px,4vw,48px)] font-bold text-navy leading-[1.05]">
              {t("headlinePrefix")}
              <span className="text-sin-red italic">{t("headlineHighlight")}</span>
            </h2>
          </div>

          <div className="flex bg-navy/[0.06] p-1 rounded-full w-max">
            {(Object.keys(filterLabels) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  filter === f ? "bg-sin-red text-white shadow-lg" : "text-navy/40 hover:text-navy"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {displayedProducts.length === 0 ? (
          <p className="text-navy/50 text-sm font-mono">{t("emptyState")}</p>
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {displayedProducts.map((product) => (
              <MenuCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MenuCard({ product, locale }: { product: Product; locale: "en" | "es" }) {
  const name = locale === "en" ? product.nameEn : product.nameEs;
  const description = locale === "en" ? product.descriptionEn : product.descriptionEs;
  const price = (product.priceCents / 100).toFixed(2);
  const { items, add, remove } = useCart();
  const quantity = items.find((i) => i.productId === product.id)?.quantity ?? 0;

  return (
    <div className="menu-card bg-white border border-navy/[0.07] rounded-2xl overflow-hidden group transition-all duration-300 hover:border-sin-red/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] flex flex-col">
      <div className="aspect-square bg-cream-dark relative overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cream to-cream-dark" />
        )}

        <div
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-mono text-[8px] md:text-[9px] tracking-[0.12em] uppercase z-20 ${
            product.category === "sin" ? "bg-sin-red/90 text-white" : "bg-navy/90 text-cream"
          }`}
        >
          {product.category}
        </div>
      </div>

      <div className="p-3 md:p-5 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-serif font-bold text-[14px] md:text-[18px] text-navy leading-tight">{name}</h3>
          <p className="text-[11px] md:text-[13px] text-navy/45 leading-relaxed mt-1 hidden md:block">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${price}</span>

          {quantity === 0 ? (
            <button
              onClick={() => add(product.id)}
              className="w-8 h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
              aria-label={`Add ${name}`}
            >
              +
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => remove(product.id)}
                className="w-7 h-7 rounded-full border border-navy/15 text-navy flex items-center justify-center hover:border-sin-red hover:text-sin-red transition-colors"
                aria-label={`Remove one ${name}`}
              >
                −
              </button>
              <span className="font-mono text-[13px] text-navy w-4 text-center">{quantity}</span>
              <button
                onClick={() => add(product.id)}
                className="w-7 h-7 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
                aria-label={`Add one more ${name}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
