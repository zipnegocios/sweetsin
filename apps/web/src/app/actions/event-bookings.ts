"use server";

import { z } from "zod";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository, DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";

const eventQuoteSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  type: z.enum(["corporate", "wedding", "festival", "other"]),
  date: z.string().trim().min(1),
  guests: z.coerce.number().int().min(20),
  message: z.string().trim().min(1),
  locale: z.enum(["en", "es"]),
});

export interface EventQuoteFormState {
  status: "idle" | "success" | "error";
}

// Ubicación y horario exactos no se piden en este formulario (igual que el
// legacy, que tampoco los pedía) — se guardan como placeholder de "día
// completo, a confirmar" hasta que Oscar cierre esos detalles al cotizar
// (Fase 5). No afecta a `findOverlapping`: solo mira reservas `confirmed`,
// y esto entra como `quote_requested`.
export async function requestEventQuoteAction(
  _prevState: EventQuoteFormState,
  formData: FormData,
): Promise<EventQuoteFormState> {
  const parsed = eventQuoteSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    date: formData.get("date"),
    guests: formData.get("guests"),
    message: formData.get("message"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const eventDate = new Date(`${parsed.data.date}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) {
    return { status: "error" };
  }

  const endOfDay = new Date(`${parsed.data.date}T23:59:59`);

  try {
    const booking = await requestEventQuote(new DrizzleEventBookingRepository(), {
      clientName: parsed.data.name,
      clientCompany: parsed.data.company ?? null,
      clientEmail: parsed.data.email,
      clientPhone: parsed.data.phone,
      eventType: parsed.data.type,
      eventDate,
      startTime: eventDate,
      endTime: endOfDay,
      location: "TBD",
      estimatedGuests: parsed.data.guests,
      notes: parsed.data.message,
    });

    await notifyEventQuoteReceipt(booking, parsed.data.locale);

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}

async function notifyEventQuoteReceipt(
  booking: { id: string; clientEmail: string },
  pageLocale: "en" | "es",
): Promise<void> {
  const emailLogs = new DrizzleEmailLogRepository();
  let locale: "en" | "es" = pageLocale;

  try {
    const session = await auth();
    locale = session?.user.preferredLocale ?? pageLocale;
    await new SmtpNotificationAdapter().sendEventQuoteRequestReceipt(booking, locale);
    await emailLogs.create({ to: booking.clientEmail, type: "event_quote_receipt", locale, status: "sent", errorMessage: null });
  } catch (err) {
    try {
      await emailLogs.create({
        to: booking.clientEmail,
        type: "event_quote_receipt",
        locale,
        status: err instanceof SmtpNotConfiguredError ? "blocked" : "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // El log de un fallo de envío es best-effort — si el propio insert
      // falla, no debe romper el flujo de cotización por un problema de logging.
    }
  }
}
