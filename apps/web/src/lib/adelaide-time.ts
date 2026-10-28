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

/** Día calendario de Adelaida ("YYYY-MM-DD") que contiene el instante `date`. */
export function adelaideDayKey(date: Date): string {
  return wallClock(date).slice(0, 10);
}

/** Rango [inicio, fin] (fin inclusivo, al ms) del día "YYYY-MM-DD" en hora de Adelaida. */
export function adelaideDayRange(day: string): { start: Date; end: Date } {
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return {
    start: parseAdelaideLocal(`${day}T00:00`),
    end: new Date(parseAdelaideLocal(`${next}T00:00`).getTime() - 1),
  };
}

export function formatAdelaide(date: Date, locale: string): string {
  return date.toLocaleString(locale, { timeZone: "Australia/Adelaide", dateStyle: "medium", timeStyle: "short" });
}
