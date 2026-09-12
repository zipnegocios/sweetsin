import { defineConfig } from "vitest/config";

// vitest no carga .env automáticamente (a diferencia de drizzle-kit) — los
// tests de integración necesitan DATABASE_URL en process.env antes de que
// se importe ../index (que revienta si falta).
process.loadEnvFile();

export default defineConfig({
  test: {
    environment: "node",
  },
});
