"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createTrailerStopAction, checkStopOverlapAction } from "@/app/actions/admin-trailer-stops";
import { LocationPicker } from "@/components/admin/location-picker";

interface ProductOption {
  id: string;
  nameEn: string;
}

const DEFAULT_LAT = -34.9285;
const DEFAULT_LNG = 138.6007;

export function TrailerStopForm({ products }: { products: ProductOption[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [overlaps, setOverlaps] = useState<{ clientName: string; eventDate: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!startTime || !endTime) {
      setOverlaps([]);
      return;
    }
    const handle = setTimeout(async () => {
      const result = await checkStopOverlapAction(new Date(startTime).toISOString(), new Date(endTime).toISOString());
      setOverlaps(result);
    }, 500);
    return () => clearTimeout(handle);
  }, [startTime, endTime]);

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedProducts((prev) => {
      const next = { ...prev };
      if (checked) next[productId] = next[productId] ?? 10;
      else delete next[productId];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createTrailerStopAction({
        location,
        lat,
        lng,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        products: Object.entries(selectedProducts).map(([productId, maxStock]) => ({ productId, maxStock })),
      });
      router.push("/admin/trailer-stops");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("stopFormLocation")}
        required
        className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
      />

      <div>
        <p className="text-[12px] text-navy/50 mb-2">{t("stopFormMapHint")}</p>
        <LocationPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} className="w-full h-64 rounded-xl overflow-hidden" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormStartTime")}</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormEndTime")}</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="bg-sin-red/10 border border-sin-red/30 rounded-lg p-3 text-[13px] text-sin-red">
          {t("stopFormOverlapWarning")}: {overlaps.map((o) => o.clientName).join(", ")}
        </div>
      )}

      <div>
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
                    setSelectedProducts((prev) => ({ ...prev, [product.id]: Number(e.target.value) }))
                  }
                  placeholder={t("stopFormMaxStock")}
                  className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("stopFormSubmit")}
      </button>
    </form>
  );
}
