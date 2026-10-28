"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { importLibrary } from "@googlemaps/js-api-loader";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";
import { createTrailerStopAction, updateTrailerStopAction, checkStopOverlapAction } from "@/app/actions/admin-trailer-stops";
import { parseAdelaideLocal, toAdelaideLocalInput } from "@/lib/adelaide-time";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { LocationPicker } from "@/components/admin/location-picker";

interface ProductOption {
  id: string;
  nameEn: string;
}

const DEFAULT_LAT = -34.9285;
const DEFAULT_LNG = 138.6007;

interface TemplateOption {
  id: string;
  name: string;
  items: { productId: string; quantity: number }[];
}

export function TrailerStopForm({
  products,
  stop,
  templates = [],
}: {
  products: ProductOption[];
  stop?: TrailerStop;
  templates?: TemplateOption[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [location, setLocation] = useState(stop?.location ?? "");
  const [lat, setLat] = useState(stop?.lat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(stop?.lng ?? DEFAULT_LNG);
  const [startTime, setStartTime] = useState(stop ? toAdelaideLocalInput(stop.startTime) : "");
  const [endTime, setEndTime] = useState(stop ? toAdelaideLocalInput(stop.endTime) : "");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [overlaps, setOverlaps] = useState<{ clientName: string; eventDate: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locationInputRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;

    importLibrary("places").then(({ Autocomplete }) => {
      if (cancelled || !locationInputRef.current) return;

      const autocomplete = new Autocomplete(locationInputRef.current, {
        fields: ["formatted_address", "geometry"],
        componentRestrictions: { country: "au" },
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        setLocation(place.formatted_address ?? locationInputRef.current!.value);
        setLat(place.geometry.location.lat());
        setLng(place.geometry.location.lng());
      });
    });

    return () => {
      cancelled = true;
    };
    // Intencionalmente mount-only: el autocompletado se ata al input una
    // sola vez, mismo patrón que LocationPicker.
  }, []);

  useEffect(() => {
    if (!startTime || !endTime) {
      setOverlaps([]);
      return;
    }
    const handle = setTimeout(async () => {
      const result = await checkStopOverlapAction(parseAdelaideLocal(startTime).toISOString(), parseAdelaideLocal(endTime).toISOString());
      setOverlaps(result);
    }, 500);
    return () => clearTimeout(handle);
  }, [startTime, endTime]);

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedProducts((prev) => {
      const next = { ...prev };
      if (checked) next[productId] = next[productId] ?? "10";
      else delete next[productId];
      return next;
    });
  }

  // Copia la plantilla al estado (editable después); "Ninguna" no lo toca.
  function applyTemplate(templateId: string) {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const available = new Set(products.map((p) => p.id));
    setSelectedProducts(
      Object.fromEntries(template.items.filter((i) => available.has(i.productId)).map((i) => [i.productId, String(i.quantity)])),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const stockItems = Object.entries(selectedProducts).map(([productId, raw]) => ({
      productId,
      maxStock: /^\d+$/.test(raw.trim()) ? Number(raw) : 0,
    }));
    if (!stop && stockItems.some((i) => i.maxStock < 1)) {
      setSubmitError(t("tplErrorQuantity"));
      return;
    }
    const start = parseAdelaideLocal(startTime);
    const end = parseAdelaideLocal(endTime);
    if (start >= end) {
      setSubmitError(t("stopFormInvalidRange"));
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const times = { startTime: start.toISOString(), endTime: end.toISOString() };
      if (stop) {
        await updateTrailerStopAction(stop.id, { location, lat, lng, ...times });
      } else {
        await createTrailerStopAction({
          location,
          lat,
          lng,
          ...times,
          products: stockItems,
        });
      }
      router.push(stop ? `/admin/trailer-stops/${stop.id}` : "/admin/trailer-stops");
      router.refresh();
    } catch {
      setSubmitError(t("stopFormSubmitError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <input
        ref={locationInputRef}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("stopFormLocation")}
        required
        className="w-full admin-input"
      />

      <div>
        <p className="text-[12px] text-navy/50 mb-2">{t("stopFormMapHint")}</p>
        <LocationPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} className="w-full h-64 rounded-xl overflow-hidden" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormStartTime")}</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full admin-input" />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormEndTime")}</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full admin-input" />
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="bg-sin-red/10 border border-sin-red/30 rounded-lg p-3 text-[13px] text-sin-red">
          {t("stopFormOverlapWarning")}: {overlaps.map((o) => o.clientName).join(", ")}
        </div>
      )}

      {!stop && (
      <div>
        {templates.length > 0 && (
          <div className="mb-3">
            <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormTemplate")}</label>
            <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)} className="admin-input">
              <option value="">{t("stopFormTemplateNone")}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-[11px] uppercase text-navy/40 mb-2">{t("stopFormProducts")}</p>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={product.id in selectedProducts}
                onChange={(e) => toggleProduct(product.id, e.target.checked)}
              />
              <span className="text-sm flex-1">{product.nameEn}</span>
              {product.id in selectedProducts && (
                <input
                  type="number"
                  min={1}
                  value={selectedProducts[product.id]}
                  onChange={(e) =>
                    setSelectedProducts((prev) => ({ ...prev, [product.id]: e.target.value }))
                  }
                  placeholder={t("stopFormMaxStock")}
                  className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {submitError && (
        <p role="alert" className="text-[13px] text-sin-red">
          {submitError}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="admin-btn disabled:opacity-50">
        {t(stop ? "stopFormSave" : "stopFormSubmit")}
      </button>
    </form>
  );
}
