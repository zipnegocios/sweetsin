"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { useTranslations } from "next-intl";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

interface LocationMapProps {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0F1B3D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1B3D" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8fa3d6" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#253D78" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1A2F5F" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E63946" }, { weight: 0.4 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#E63946" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#B82B36" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#080E22" }] },
];

export function LocationMap({ lat, lng, label, className }: LocationMapProps) {
  const t = useTranslations("findUs");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !containerRef.current) return;

        mapRef.current = new Map(containerRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAP_STYLES,
        });

        markerRef.current = new Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: label,
          icon: {
            url: "/devil-icon.png",
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 38),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.panTo({ lat, lng });
    markerRef.current.setPosition({ lat, lng });
    markerRef.current.setTitle(label);
  }, [lat, lng, label]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || failed) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest">
          {t("mapUnavailable")}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
