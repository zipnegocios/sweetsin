import type { Locale } from "@workspace/domain/shared";

interface EmailContent {
  subject: string;
  text: string;
}

export function renderOrderConfirmation(
  order: { id: string; totalCents: number },
  locale: Locale,
): EmailContent {
  const total = `$${(order.totalCents / 100).toFixed(2)}`;

  if (locale === "es") {
    return {
      subject: "Sweet Sin — Confirmación de tu pedido",
      text: `¡Gracias por tu pedido!\n\nPedido: ${order.id}\nTotal: ${total}\n\nTe vemos pronto.\nSweet Sin`,
    };
  }

  return {
    subject: "Sweet Sin — Order confirmation",
    text: `Thanks for your order!\n\nOrder: ${order.id}\nTotal: ${total}\n\nSee you soon.\nSweet Sin`,
  };
}

export function renderEventQuoteReceipt(booking: { id: string }, locale: Locale): EmailContent {
  if (locale === "es") {
    return {
      subject: "Sweet Sin — Recibimos tu solicitud de cotización",
      text: `Recibimos tu solicitud de cotización para tu evento.\n\nSolicitud: ${booking.id}\n\nTe contactaremos pronto con los detalles.\nSweet Sin`,
    };
  }

  return {
    subject: "Sweet Sin — We received your event quote request",
    text: `We received your event quote request.\n\nRequest: ${booking.id}\n\nWe'll be in touch soon with the details.\nSweet Sin`,
  };
}
