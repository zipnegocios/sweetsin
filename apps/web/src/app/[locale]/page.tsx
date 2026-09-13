import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { CartProvider } from "@/lib/cart-store";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CheckoutModal } from "@/components/cart/checkout-modal";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Hero } from "@/components/sections/hero";
import { BrandStory } from "@/components/sections/brand-story";
import { Menu } from "@/components/sections/menu";
import { Events } from "@/components/sections/events";
import { FindUs } from "@/components/sections/find-us";
import { Footer } from "@/components/sections/footer";

// El catálogo (Menu) y las paradas (FindUs) consultan Postgres en vivo —
// sin esto, generateStaticParams() del layout hace que next build intente
// pre-renderizar la página estáticamente, ejecutando esas queries contra
// la DB real *en build time* y congelando los datos hasta el próximo
// deploy. force-dynamic obliga a Next a renderizar en cada request real.
export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <CartProvider products={products}>
      <main className="w-full min-h-screen bg-sweet-dark text-cream selection:bg-sin-red selection:text-white pb-14 md:pb-0">
        <Navbar />
        <Hero />
        <BrandStory />
        <Menu products={products} />
        <Events />
        <FindUs />
        <Footer />
        <MobileNav />
      </main>
      <CartDrawer />
      <CheckoutModal />
    </CartProvider>
  );
}
