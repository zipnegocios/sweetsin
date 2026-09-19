import path from "node:path";
import { defineConfig } from "vitest/config";

// Igual que packages/db: vitest no carga .env automáticamente, y las
// rutas /api/mobile que hacen auth contra Postgres necesitan DATABASE_URL
// en process.env antes de que se importe @workspace/db/repositories.
process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
