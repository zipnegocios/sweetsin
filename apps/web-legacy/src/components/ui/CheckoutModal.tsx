import { useEffect, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { useCart, type CheckoutDetails } from '@/lib/cart';
import { ensureGoogleMapsOptionsSet } from '@/lib/googleMaps';

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
): string {
  return components?.find((c) => c.types.includes(type))?.long_name ?? '';
}

type Fulfillment = CheckoutDetails['fulfillment'];
type Step = 'fulfillment' | 'address' | 'contact' | 'payment' | 'confirmation';

const SELF_DELIVERY_FEE = 5;
const COURIER_DELIVERY_FEE = 8.5;

const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  pickup: 'Pickup at the trailer',
  'self-delivery': 'Delivery by Sweet Sin',
  courier: 'Courier delivery',
};

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

interface AddressInfo {
  line1: string;
  suburb: string;
}

const inputClass =
  'w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors';

export default function CheckoutModal() {
  const { totalPrice, totalSavings, clear, checkoutOpen, closeCheckout, sendToWhatsApp } = useCart();

  const [step, setStep] = useState<Step>('fulfillment');
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [courierFeeLoading, setCourierFeeLoading] = useState(false);
  const [address, setAddress] = useState<AddressInfo>({ line1: '', suburb: '' });
  const [contact, setContact] = useState<ContactInfo>({ name: '', phone: '', email: '' });
  const [addressError, setAddressError] = useState('');
  const [contactError, setContactError] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'address' || !addressInputRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    importLibrary('places').then(({ Autocomplete }) => {
      if (cancelled || !addressInputRef.current) return;
      const autocomplete = new Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['address_components', 'formatted_address'],
      });
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const streetNumber = getAddressComponent(place.address_components, 'street_number');
        const route = getAddressComponent(place.address_components, 'route');
        const suburb = getAddressComponent(place.address_components, 'locality');
        setAddress({
          line1: [streetNumber, route].filter(Boolean).join(' ') || place.formatted_address || '',
          suburb,
        });
      });
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [step]);

  if (!checkoutOpen) return null;

  const fulfillmentFee =
    fulfillment === 'self-delivery' ? SELF_DELIVERY_FEE : fulfillment === 'courier' ? COURIER_DELIVERY_FEE : 0;
  const grandTotal = totalPrice + fulfillmentFee;

  function reset() {
    setStep('fulfillment');
    setFulfillment(null);
    setAddress({ line1: '', suburb: '' });
    setContact({ name: '', phone: '', email: '' });
    setAddressError('');
    setContactError('');
    setCourierFeeLoading(false);
    setCardLoading(false);
  }

  function handleClose() {
    closeCheckout();
    reset();
  }

  function chooseFulfillment(choice: Fulfillment) {
    setFulfillment(choice);
    if (choice === 'courier') {
      setCourierFeeLoading(true);
      setTimeout(() => setCourierFeeLoading(false), 800);
    }
    setStep(choice === 'pickup' ? 'contact' : 'address');
  }

  function submitAddress() {
    if (!address.line1.trim() || !address.suburb.trim()) {
      setAddressError('Please fill in both fields.');
      return;
    }
    setAddressError('');
    setStep('contact');
  }

  function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      setContactError('Please fill in all fields.');
      return;
    }
    setContactError('');
    setStep('payment');
  }

  function buildDetails(): CheckoutDetails {
    return {
      fulfillment: fulfillment ?? 'pickup',
      fulfillmentFee,
      address: fulfillment === 'pickup' ? undefined : address,
      contact,
    };
  }

  function payWithWhatsApp() {
    sendToWhatsApp(buildDetails());
    handleClose();
  }

  function payWithCard() {
    setCardLoading(true);
    setTimeout(() => {
      setCardLoading(false);
      setStep('confirmation');
    }, 1200);
  }

  function finishConfirmation() {
    clear();
    handleClose();
  }

  function goBack() {
    if (step === 'address') setStep('fulfillment');
    else if (step === 'contact') setStep(fulfillment === 'pickup' ? 'fulfillment' : 'address');
    else if (step === 'payment') setStep('contact');
  }

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-x-0 bottom-0 z-[195] bg-white rounded-t-3xl shadow-[0_-8px_48px_rgba(15,27,61,0.18)] max-h-[85vh] flex flex-col">
        <div className="w-12 h-1 bg-navy/15 rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="px-6 pb-8 overflow-y-auto">
          {step !== 'fulfillment' && step !== 'confirmation' && (
            <button
              onClick={goBack}
              className="font-mono text-[10px] uppercase tracking-wider text-navy/40 hover:text-sin-red transition-colors mb-4"
            >
              ← Back
            </button>
          )}

          {step === 'fulfillment' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">How do you want it?</h3>
              <div className="space-y-3">
                <button
                  onClick={() => chooseFulfillment('pickup')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Pickup at the trailer</p>
                  <p className="text-[13px] text-navy/50">Free</p>
                </button>
                <button
                  onClick={() => chooseFulfillment('self-delivery')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Delivery by Sweet Sin</p>
                  <p className="text-[13px] text-navy/50">${SELF_DELIVERY_FEE.toFixed(2)} flat fee</p>
                </button>
                <button
                  onClick={() => chooseFulfillment('courier')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Courier delivery</p>
                  <p className="text-[13px] text-navy/50">Calculated at next step</p>
                </button>
              </div>
            </div>
          )}

          {step === 'address' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Where to?</h3>
              {fulfillment === 'courier' && (
                <p className="text-[13px] text-navy/50 mb-4">
                  {courierFeeLoading
                    ? 'Calculating delivery fee…'
                    : `Delivery fee: $${COURIER_DELIVERY_FEE.toFixed(2)}`}
                </p>
              )}
              <div className="space-y-3 mb-4">
                <input
                  ref={addressInputRef}
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder="Start typing your address…"
                  autoComplete="off"
                  className={inputClass}
                />
                <input
                  value={address.suburb}
                  onChange={(e) => setAddress((a) => ({ ...a, suburb: e.target.value }))}
                  placeholder="Suburb"
                  className={inputClass}
                />
              </div>
              {addressError && <p className="text-sin-red text-[12px] mb-4">{addressError}</p>}
              <button
                onClick={submitAddress}
                disabled={fulfillment === 'courier' && courierFeeLoading}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'contact' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">Your details</h3>
              <div className="space-y-3 mb-4">
                <input
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Full name"
                  className={inputClass}
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone"
                  className={inputClass}
                />
                <input
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email"
                  type="email"
                  className={inputClass}
                />
              </div>
              {contactError && <p className="text-sin-red text-[12px] mb-4">{contactError}</p>}
              <button
                onClick={submitContact}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Pay</h3>
              {totalSavings > 0 && (
                <p className="text-[13px] text-sin-red font-medium mb-2">
                  You're saving ${totalSavings.toFixed(2)} with volume pricing
                </p>
              )}
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
                <span className="font-serif font-bold text-navy text-xl">${grandTotal.toFixed(2)}</span>
              </div>

              <button
                onClick={payWithWhatsApp}
                className="w-full bg-navy text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-navy-mid transition-colors mb-3"
              >
                Order via WhatsApp
              </button>

              <div className="border border-navy/10 rounded-2xl p-4 space-y-3">
                <p className="font-medium text-navy text-[14px]">Pay with card</p>
                <input
                  disabled
                  placeholder="4242 4242 4242 4242"
                  className="w-full bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                />
                <div className="flex gap-3">
                  <input
                    disabled
                    placeholder="MM / YY"
                    className="w-1/2 bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                  />
                  <input
                    disabled
                    placeholder="CVC"
                    className="w-1/2 bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                  />
                </div>
                <button
                  onClick={payWithCard}
                  disabled={cardLoading}
                  className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
                >
                  {cardLoading ? 'Processing…' : `Pay $${grandTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-sin-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E63946"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">You're in!</h3>
              <p className="text-navy/50 text-[14px] mb-6">
                {FULFILLMENT_LABEL[fulfillment ?? 'pickup']} · ${grandTotal.toFixed(2)}
              </p>
              <button
                onClick={finishConfirmation}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
