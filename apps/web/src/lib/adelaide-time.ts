const TZ = "Australia/Adelaide";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function wallClock(date: Date): string {
  const p = Object.fromEntries(formatter.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Hora de pared de Adelaida (el instante `date`) como valor de datetime-local. */
export function toAdelaideLocalInput(date: Date): string {
  return wallClock(date);
}

/** "YYYY-MM-DDTHH:mm" interpretado en hora de Adelaida -> instante UTC. */
export function parseAdelaideLocal(value: string): Date {
  const asUtc = Date.parse(`${value}:00Z`);
  // El offset depende del instante: se estima y se corrige una vez (cubre cambios de DST).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const offset = Date.parse(`${wallClock(new Date(guess))}:00Z`) - guess;
    guess = asUtc - offset;
  }
  return new Date(guess);
}

export function formatAdelaide(date: Date, locale: string): string {
  return date.toLocaleString(locale, { timeZone: "Australia/Adelaide", dateStyle: "medium", timeStyle: "short" });
}
