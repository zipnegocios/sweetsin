"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-store";
import { placeOrderAction } from "@/app/actions/checkout";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type Fulfillment = "pickup" | "self_delivery";
type Step = "fulfillment" | "address" | "contact" | "payment" | "confirmation";

const inputClass =
  "w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors";

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
): string {
  return components?.find((c) => c.types.includes(type))?.long_name ?? "";
}

export function CheckoutModal() {
  const t = useTranslations("cart");
  const { items, products, subtotalCents, savingsCents, clear, isCheckoutOpen, closeCheckout } = useCart();

  const [step, setStep] = useState<Step>("fulfillment");
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [address, setAddress] = useState({ line1: "", suburb: "" });
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [addressError, setAddressError] = useState("");
  const [contactError, setContactError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "address" || !addressInputRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    importLibrary("places").then(({ Autocomplete }) => {
      if (cancelled || !addressInputRef.current) return;
      const autocomplete = new Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address"],
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const streetNumber = getAddressComponent(place.address_components, "street_number");
        const route = getAddressComponent(place.address_components, "route");
        const suburb = getAddressComponent(place.address_components, "locality");
        setAddress({
          line1: [streetNumber, route].filter(Boolean).join(" ") || place.formatted_address || "",
          suburb,
        });
      });
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [step]);

  if (!isCheckoutOpen) return null;

  function reset() {
    setStep("fulfillment");
    setFulfillment(null);
    setAddress({ line1: "", suburb: "" });
    setContact({ name: "", phone: "", email: "" });
    setAddressError("");
    setContactError("");
    setIsPlacing(false);
    setClientSecret(null);
  }

  function handleClose() {
    closeCheckout();
    reset();
  }

  function chooseFulfillment(choice: Fulfillment) {
    setFulfillment(choice);
    setStep(choice === "pickup" ? "contact" : "address");
  }

  function submitAddress() {
    if (!address.line1.trim() || !address.suburb.trim()) {
      setAddressError(t("addressError"));
      return;
    }
    setAddressError("");
    setStep("contact");
  }

  function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      setContactError(t("contactError"));
      return;
    }
    setContactError("");
    setStep("payment");
  }

  function goBack() {
    if (step === "address") setStep("fulfillment");
    else if (step === "contact") setStep(fulfillment === "pickup" ? "fulfillment" : "address");
    else if (step === "payment") setStep("contact");
  }

  const orderItems = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const deliveryAddress =
    fulfillment === "self_delivery" ? `${address.line1}, ${address.suburb}` : undefined;

  async function payWithWhatsApp() {
    setIsPlacing(true);
    // Se abre la pestaña en blanco de forma síncrona, dentro del gesto de
    // click original — Chrome descarta la activación de usuario apenas hay
    // un await de por medio, y bloquea en silencio cualquier window.open
    // posterior. Se navega esta pestaña ya abierta una vez que la Server
    // Action resuelve, en vez de abrir una pestaña nueva en ese momento.
    const whatsappTab = window.open("", "_blank");
    try {
      const result = await placeOrderAction({
        fulfillmentType: fulfillment ?? "pickup",
        deliveryAddress,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        channel: "whatsapp",
        items: orderItems,
      });

      const lines = items.map((i) => {
        const product = products.find((p) => p.id === i.productId);
        return `• ${i.quantity}x ${product?.nameEn ?? ""}`;
      });
      const text = [
        `Hi! I'd like to place an order with Sweet Sin (order ${result.orderId})`,
        "",
        ...lines,
        "",
        `Total: $${(result.totalCents / 100).toFixed(2)}`,
        deliveryAddress ? `Address: ${deliveryAddress}` : "Pickup at the trailer",
        `Name: ${contact.name}`,
        `Phone: ${contact.phone}`,
      ].join("\n");

      const whatsappUrl = `https://wa.me/61433508831?text=${encodeURIComponent(text)}`;
      if (whatsappTab) {
        whatsappTab.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, "_blank");
      }
      clear();
      handleClose();
    } finally {
      setIsPlacing(false);
    }
  }

  async function startCardPayment() {
    setIsPlacing(true);
    try {
      const result = await placeOrderAction({
        fulfillmentType: fulfillment ?? "pickup",
        deliveryAddress,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        channel: "web",
        items: orderItems,
      });

      const response = await fetch("/api/checkout/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: result.orderId }),
      });
      const data = await response.json();
      if (data.clientSecret) setClientSecret(data.clientSecret);
    } finally {
      setIsPlacing(false);
    }
  }

  function finishConfirmation() {
    clear();
    handleClose();
  }

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-x-0 bottom-0 z-[195] bg-white rounded-t-3xl shadow-[0_-8px_48px_rgba(15,27,61,0.18)] max-h-[85vh] flex flex-col">
        <div className="w-12 h-1 bg-navy/15 rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="px-6 pb-8 overflow-y-auto">
          {step !== "fulfillment" && step !== "confirmation" && (
            <button
              onClick={goBack}
              className="font-mono text-[10px] uppercase tracking-wider text-navy/40 hover:text-sin-red transition-colors mb-4"
            >
              ← {t("backButton")}
            </button>
          )}

          {step === "fulfillment" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">{t("stepFulfillmentTitle")}</h3>
              <div className="space-y-3">
                <button
                  onClick={() => chooseFulfillment("pickup")}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">{t("fulfillmentPickup")}</p>
                  <p className="text-[13px] text-navy/50">{t("fulfillmentPickupFee")}</p>
                </button>
                <button
                  onClick={() => chooseFulfillment("self_delivery")}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">{t("fulfillmentDelivery")}</p>
                </button>
              </div>
            </div>
          )}

          {step === "address" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-4">{t("stepAddressTitle")}</h3>
              <div className="space-y-3 mb-4">
                <input
                  ref={addressInputRef}
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder={t("addressLine1Placeholder")}
                  autoComplete="off"
                  className={inputClass}
                />
                <input
                  value={address.suburb}
                  onChange={(e) => setAddress((a) => ({ ...a, suburb: e.target.value }))}
                  placeholder={t("addressSuburbPlaceholder")}
                  className={inputClass}
                />
              </div>
              {addressError && <p className="text-sin-red text-[12px] mb-4">{addressError}</p>}
              <button
                onClick={submitAddress}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("continueButton")}
              </button>
            </div>
          )}

          {step === "contact" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">{t("stepContactTitle")}</h3>
              <div className="space-y-3 mb-4">
                <input
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  placeholder={t("contactNamePlaceholder")}
                  className={inputClass}
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  placeholder={t("contactPhonePlaceholder")}
                  className={inputClass}
                />
                <input
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  placeholder={t("contactEmailPlaceholder")}
                  type="email"
                  className={inputClass}
                />
              </div>
              {contactError && <p className="text-sin-red text-[12px] mb-4">{contactError}</p>}
              <button
                onClick={submitContact}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("continueButton")}
              </button>
            </div>
          )}

          {step === "payment" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">{t("stepPaymentTitle")}</h3>
              {savingsCents > 0 && (
                <p className="text-[13px] text-sin-red font-medium mb-2">
                  {t("savings")} ${(savingsCents / 100).toFixed(2)}
                </p>
              )}
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">{t("total")}</span>
                <span className="font-serif font-bold text-navy text-xl">${(subtotalCents / 100).toFixed(2)}</span>
              </div>

              <button
                onClick={payWithWhatsApp}
                disabled={isPlacing}
                className="w-full bg-navy text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-navy-mid transition-colors mb-3 disabled:opacity-50"
              >
                {isPlacing ? t("processing") : t("payWithWhatsapp")}
              </button>

              <div className="border border-navy/10 rounded-2xl p-4 space-y-3">
                <p className="font-medium text-navy text-[14px]">{t("payWithCardTitle")}</p>
                {!stripePromise ? (
                  <p className="text-navy/40 text-[13px] font-mono">{t("payWithCardUnavailable")}</p>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCardForm onSuccess={() => setStep("confirmation")} />
                  </Elements>
                ) : (
                  <button
                    onClick={startCardPayment}
                    disabled={isPlacing}
                    className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
                  >
                    {isPlacing ? t("processing") : `${t("payButton")} $${(subtotalCents / 100).toFixed(2)}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "confirmation" && (
            <div className="text-center py-4">
              <h3 className="font-serif font-bold text-navy text-xl mb-2">{t("confirmationTitle")}</h3>
              <p className="text-navy/50 text-[14px] mb-6">{t("confirmationBody")}</p>
              <button
                onClick={finishConfirmation}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("doneButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StripeCardForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("cart");
  const stripe = useStripe();
  const elements = useElements();
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setIsConfirming(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setIsConfirming(false);
    if (!error) onSuccess();
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button
        onClick={handleConfirm}
        disabled={isConfirming || !stripe}
        className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
      >
        {isConfirming ? t("processing") : t("payButton")}
      </button>
    </div>
  );
}
