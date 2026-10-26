const SEPARADORES = /[\s\-.()]/g;

function enRango(digitos: string): string | null {
  if (!/^[1-9]/.test(digitos)) return null;
  // Quita el 0 troncal AU escrito tras el código de país (+61 (0)412…).
  const sinTroncal = /^610\d{9}$/.test(digitos) ? `61${digitos.slice(3)}` : digitos;
  return sinTroncal.length >= 6 && sinTroncal.length <= 15 ? sinTroncal : null;
}

/** Normaliza un teléfono a dígitos internacionales sin "+" (formato de wa.me), o null si no es válido. */
export function toWhatsAppNumber(raw: string): string | null {
  const limpio = raw.replace(SEPARADORES, "");

  if (limpio.startsWith("+")) {
    const resto = limpio.slice(1);
    return /^\d+$/.test(resto) ? enRango(resto) : null;
  }
  if (!/^\d+$/.test(limpio)) return null;

  if (limpio.startsWith("00")) return enRango(limpio.slice(2));
  // Móvil AU (04…) o fijo AU (02, 03, 07, 08): 0 + 9 dígitos.
  if (/^0[23478]\d{8}$/.test(limpio)) return `61${limpio.slice(1)}`;
  if (/^61\d{9}$/.test(limpio)) return limpio;
  return null;
}

export function whatsappUrl(raw: string): string | null {
  const numero = toWhatsAppNumber(raw);
  return numero ? `https://wa.me/${numero}` : null;
}
