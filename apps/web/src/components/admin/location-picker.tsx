"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}

export function LocationPicker({ lat, lng, onChange, className }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: { lat, lng },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
        });

        const marker = new Marker({ position: { lat, lng }, map, draggable: true });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) onChangeRef.current(pos.lat(), pos.lng());
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          onChangeRef.current(e.latLng.lat(), e.latLng.lng());
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Intencionalmente mount-only, mismo patrón que LocationMap (Fase 2): el
    // mapa se crea una sola vez. lat/lng iniciales solo definen el centro y
    // la posición de arranque del marker — los cambios posteriores vienen
    // del propio usuario clickeando/arrastrando, no de props entrantes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || failed) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest border border-navy/12 rounded-2xl">
          Map unavailable
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
