"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  OrdersIcon,
  TruckIcon,
  EventsIcon,
  CalendarIcon,
  MailIcon,
  StaffIcon,
  ChevronIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
} from "./admin-icons";

const ICONS = {
  orders: OrdersIcon,
  stops: TruckIcon,
  events: EventsIcon,
  calendar: CalendarIcon,
  emails: MailIcon,
  staff: StaffIcon,
};

export type AdminNavItem = { href: string; label: string; icon: keyof typeof ICONS };

type Labels = {
  collapse: string;
  expand: string;
  open: string;
  close: string;
  signOut: string;
};

const STORAGE_KEY = "sweet-sin-admin-sidebar-collapsed";
// Alto de cada ítem + separación: el indicador activo se desplaza por múltiplos de esto.
const ITEM_STEP = 48;

export function AdminSidebar({
  items,
  labels,
  signOutAction,
}: {
  items: AdminNavItem[];
  labels: Labels;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Evita que la preferencia guardada se anime como si el usuario la acabara de cambiar.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage puede fallar (modo privado) — el menú funciona igual, sin recordar el estado.
    }
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Cerrar el cajón móvil al navegar y con Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ver arriba
    }
  }

  const activeIndex = items.findIndex((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  // En el cajón móvil el menú siempre está expandido; "collapsed" solo aplica desde md.
  const hideLabel = collapsed ? "md:max-w-0 md:opacity-0" : "";
  const motion = ready ? "transition-all duration-300 ease-out" : "";

  return (
    <>
      {/* Barra superior móvil */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={labels.open}
          className="rounded-lg p-2 text-cream/80 transition active:scale-90 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <MenuIcon />
        </button>
        <span className="font-serif font-bold text-cream">
          Sweet <span className="text-sin-red-light">Sin</span>
        </span>
        <span className="w-9" aria-hidden="true" />
      </div>

      {/* Fondo del cajón móvil */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-20 h-screen w-72 shrink-0 flex flex-col bg-gradient-to-b from-navy via-navy to-sweet-dark text-cream shadow-[4px_0_24px_-12px_rgba(8,13,26,0.6)] ${
          ready ? "transition-[transform,width] duration-300 ease-out" : ""
        } ${drawerOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 ${
          collapsed ? "md:w-[76px]" : "md:w-64"
        }`}
      >
        {/* Marca */}
        <div className="flex items-center gap-3 px-4 h-20 shrink-0">
          <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-cream shadow-md ring-1 ring-gold/40 transition-transform duration-300 hover:rotate-[-6deg] hover:scale-105">
            <Image src="/devil-icon.png" alt="Sweet Sin" width={32} height={28} priority />
          </span>
          <span className={`overflow-hidden whitespace-nowrap ${motion} ${hideLabel}`}>
            <span className="block font-serif font-bold text-lg leading-none text-cream">
              Sweet <span className="text-sin-red-light">Sin</span>
            </span>
            <span className="block mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-light">Admin</span>
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={labels.close}
            className="md:hidden ml-auto rounded-lg p-2 text-cream/70 hover:bg-white/10 hover:text-white active:scale-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Botón de colapso (solo escritorio) */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? labels.expand : labels.collapse}
          aria-expanded={!collapsed}
          className="hidden md:grid absolute -right-3.5 top-[68px] size-7 place-items-center rounded-full border border-navy/10 bg-cream text-navy shadow-md transition duration-200 hover:scale-110 hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sin-red"
        >
          <ChevronIcon width={16} height={16} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>

        {/* Navegación */}
        <nav className="relative flex-1 px-3 pt-2">
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              style={{ transform: `translateY(${activeIndex * ITEM_STEP}px)` }}
              className="absolute left-3 right-3 top-2 h-11 rounded-xl bg-gradient-to-r from-sin-red to-sin-red-dark shadow-[0_6px_16px_-6px_rgba(230,57,70,0.7)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
          )}
          <ul className="relative flex flex-col gap-1">
            {items.map((item, i) => {
              const Icon = ICONS[item.icon];
              const active = i === activeIndex;
              return (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                      active ? "text-white" : "text-cream/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <Icon className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    <span className={`overflow-hidden whitespace-nowrap ${motion} ${hideLabel}`}>{item.label}</span>
                  </Link>
                  {collapsed && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 z-50 ml-4 hidden -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-lg bg-cream px-3 py-1.5 text-xs font-semibold text-navy opacity-0 shadow-lg transition duration-150 md:block group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Cerrar sesión */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <form action={signOutAction}>
            <button
              type="submit"
              className="group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-cream/65 transition duration-200 hover:bg-sin-red/15 hover:text-sin-red-light active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <LogoutIcon className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              <span className={`overflow-hidden whitespace-nowrap ${motion} ${hideLabel}`}>{labels.signOut}</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
