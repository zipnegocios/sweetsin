/** Día y franja horaria de una parada, en hora de Adelaida. */
export function formatStopSchedule(
  stop: { startTime: Date; endTime: Date },
  locale: "en" | "es",
): { day: string; timeRange: string } {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "Australia/Adelaide" }).format(
    stop.startTime,
  );
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  });

  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    timeRange: `${timeFormatter.format(stop.startTime)} – ${timeFormatter.format(stop.endTime)}`,
  };
}
