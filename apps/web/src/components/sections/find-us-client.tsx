"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { useLocale, useTranslations } from "next-intl";
import { LocationMap } from "@/components/ui/location-map";

function formatStopSchedule(stop: TrailerStop, locale: "en" | "es"): { day: string; timeRange: string } {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "Australia/Adelaide" }).format(
    stop.startTime,
  );
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  });

  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    timeRange: `${timeFormatter.format(stop.startTime)} – ${timeFormatter.format(stop.endTime)}`,
  };
}

export function FindUsClient({ stops }: { stops: TrailerStop[] }) {
  const t = useTranslations("findUs");
  const locale = useLocale();
  const [selectedStop, setSelectedStop] = useState<TrailerStop | null>(stops[0] ?? null);

  return (
    <section id="find-us" className="bg-sweet-white py-[80px] md:py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">{t("eyebrow")}</p>
          <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-black text-navy leading-[1.0] mb-6">
            {t("headline")}
          </h2>
          <p className="text-[15px] text-navy/50 max-w-md leading-[1.7] mb-10">{t("subhead")}</p>

          {stops.length === 0 ? (
            <p className="text-navy/50 text-sm font-mono mb-12">{t("noStops")}</p>
          ) : (
            <div className="space-y-2 mb-12">
              {stops.map((stop) => {
                const schedule = formatStopSchedule(stop, locale);
                return (
                  <button
                    key={stop.id}
                    onClick={() => setSelectedStop(stop)}
                    className={`w-full flex justify-between items-center py-4 border-b transition-colors text-left ${
                      selectedStop?.id === stop.id ? "border-sin-red/30" : "border-navy/[0.07] hover:border-navy/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          stop.status === "active" ? "bg-sin-red animate-pulse" : "bg-navy/20"
                        }`}
                      />
                      <div>
                        <span
                          className={`block text-sm font-medium ${
                            selectedStop?.id === stop.id ? "text-sin-red" : "text-navy"
                          }`}
                        >
                          {schedule.day}
                        </span>
                        <span className="block text-xs text-navy/40 mt-1">{schedule.timeRange}</span>
                      </div>
                    </div>
                    <div className="text-sm text-navy/70 text-right max-w-[150px] md:max-w-none">{stop.location}</div>
                  </button>
                );
              })}
            </div>
          )}

          <NewsletterForm />
        </div>

        <div className="flex flex-col gap-6">
          <div className="w-full h-[300px] md:h-[400px] bg-cream rounded-2xl relative overflow-hidden border border-navy/[0.08]">
            {selectedStop ? (
              <>
                <LocationMap
                  lat={selectedStop.lat}
                  lng={selectedStop.lng}
                  label={selectedStop.location}
                  className="absolute inset-0"
                />
                <div className="absolute bottom-4 left-4 pointer-events-none">
                  <span className="font-mono text-[9px] tracking-widest text-white px-2 py-1 bg-black/50 rounded backdrop-blur-sm uppercase">
                    {selectedStop.location}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest">
                {t("mapUnavailable")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <a
                key={i}
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-cream-dark relative rounded-xl overflow-hidden group border border-navy/[0.07] flex items-center justify-center hover:border-sin-red/30 transition-colors"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-navy/25 group-hover:text-sin-red/60 transition-colors"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsletterForm() {
  const t = useTranslations("findUs");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const successIconRef = useRef<HTMLSpanElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRef.current?.value) return;

    setStatus("submitting");
    setTimeout(() => {
      setStatus("success");
      if (successIconRef.current) {
        gsap.fromTo(
          successIconRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" },
        );
      }
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-sm">
      {status === "success" ? (
        <div className="flex items-center gap-3 text-sin-red bg-sin-red/10 border border-sin-red/20 px-6 py-4 rounded-full">
          <span ref={successIconRef} className="flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-medium">{t("newsletterSuccess")}</span>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="email"
            placeholder={t("newsletterPlaceholder")}
            required
            disabled={status === "submitting"}
            className="w-full bg-white border border-navy/12 rounded-full px-6 py-4 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors pr-16 disabled:opacity-50 shadow-sm"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-sin-red text-white rounded-full flex items-center justify-center hover:bg-sin-red-light transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}
