import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Posiciones fijas (no Math.random) para que el SSR y el cliente rendericen lo mismo.
const PARTICLES = [
  { l: "6%", s: 6, d: 15, delay: 0, o: 0.5 },
  { l: "16%", s: 4, d: 12, delay: 3, o: 0.4 },
  { l: "27%", s: 8, d: 18, delay: 6, o: 0.35 },
  { l: "38%", s: 5, d: 13, delay: 1, o: 0.55 },
  { l: "49%", s: 7, d: 17, delay: 8, o: 0.4 },
  { l: "60%", s: 4, d: 11, delay: 4, o: 0.5 },
  { l: "71%", s: 6, d: 16, delay: 9, o: 0.45 },
  { l: "82%", s: 5, d: 14, delay: 2, o: 0.5 },
  { l: "92%", s: 7, d: 19, delay: 7, o: 0.35 },
];

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-cream">
      {/* Panel de marca */}
      <section className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-navy via-navy-mid to-sweet-dark text-cream">
        <div aria-hidden="true" className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-sin-red/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-40 -right-24 size-[30rem] rounded-full bg-gold/15 blur-3xl" />
        <div aria-hidden="true" className="absolute inset-0">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="auth-particle absolute bottom-[-20px] rounded-full bg-gold"
              style={{ left: p.l, width: p.s, height: p.s, "--d": `${p.d}s`, "--delay": `${p.delay}s`, "--o": p.o } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="auth-float grid place-items-center size-44 rounded-[2.5rem] bg-cream shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-gold/50">
            <Image src="/devil-icon.png" alt="Sweet Sin" width={124} height={108} priority />
          </div>
          <h2 className="mt-10 font-serif font-bold text-5xl tracking-tight">
            Sweet <span className="text-sin-red-light">Sin</span>
          </h2>
          <span className="mt-4 h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="mt-4 font-serif italic text-xl text-gold-light">{t("tagline")}</p>
        </div>
      </section>

      {/* Formulario */}
      <section className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <Link
          href="/"
          className="absolute top-6 left-6 sm:left-12 text-[13px] text-navy/50 transition hover:text-sin-red hover:-translate-x-0.5"
        >
          ← {t("backToSite")}
        </Link>

        <div className="admin-enter mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <span className="grid place-items-center size-12 rounded-2xl bg-navy shadow-md">
              <Image src="/devil-icon.png" alt="Sweet Sin" width={34} height={30} priority />
            </span>
            <span className="font-serif font-bold text-2xl text-navy">
              Sweet <span className="text-sin-red">Sin</span>
            </span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
