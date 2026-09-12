"use server";

import { z } from "zod";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";

const eventQuoteSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  type: z.enum(["corporate", "wedding", "festival", "other"]),
  date: z.string().trim().min(1),
  guests: z.coerce.number().int().min(20),
  message: z.string().trim().min(1),
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
    await requestEventQuote(new DrizzleEventBookingRepository(), {
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
    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}
