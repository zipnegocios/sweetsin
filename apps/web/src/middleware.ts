import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { authConfig } from "./auth.config";

// Instancia de Auth.js construida solo con authConfig (edge-safe, sin
// providers ni callbacks con acceso a DB) — el middleware corre en el Edge
// Runtime, que no soporta el módulo `crypto` de Node que usa `pg`. No se
// importa `./auth` (la versión completa con DrizzleUserRepository) acá.
const { auth } = NextAuth(authConfig);

const handleI18nRouting = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminRoute = /^\/(en|es)?\/?admin(\/|$)/.test(pathname);

  if (isAdminRoute) {
    const role = req.auth?.user?.role;
    if (!req.auth || role !== "admin") {
      const locale = pathname.startsWith("/es") ? "es" : "en";
      const loginUrl = new URL(`${locale === "en" ? "" : "/es"}/login`, req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return handleI18nRouting(req);
});

export const config = {
  // Todo menos /api, /trpc, /_next, /_vercel y archivos con extensión (favicon.ico, etc.)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
