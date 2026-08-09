import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

interface LocationMapProps {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let optionsSet = false;

function ensureOptionsSet() {
  if (!optionsSet && API_KEY) {
    setOptions({ key: API_KEY, v: 'weekly' });
    optionsSet = true;
  }
}

export default function LocationMap({ lat, lng, label, className }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!API_KEY || !containerRef.current) return;
    ensureOptionsSet();
    let cancelled = false;

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !containerRef.current) return;

        mapRef.current = new Map(containerRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        });

        markerRef.current = new Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: label,
          icon: {
            path: 'M18 0C8.059 0 0 8.059 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.059 27.941 0 18 0Z',
            fillColor: '#E63946',
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 1,
            anchor: new google.maps.Point(18, 44),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally mount-only: the effect below keeps position/label in
    // sync without re-creating the map instance.
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.panTo({ lat, lng });
    markerRef.current.setPosition({ lat, lng });
    markerRef.current.setTitle(label);
  }, [lat, lng, label]);

  if (!API_KEY || failed) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest">
          Map unavailable
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
