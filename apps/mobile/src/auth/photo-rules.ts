export type PhotoOutcome = "ok" | "tooLarge" | "error";

/** 413 = foto pesada (se reintenta con otra toma); el resto de fallos es red o servidor. */
export function classifyPhotoResponse(status: number): PhotoOutcome {
  if (status >= 200 && status < 300) return "ok";
  return status === 413 ? "tooLarge" : "error";
}
