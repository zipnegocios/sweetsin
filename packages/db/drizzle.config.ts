import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Ruta relativa con forward slashes: en Windows, path.join produce
  // backslashes que el glob interno de drizzle-kit no matchea, y falla con
  // "No schema files found" aunque el archivo exista.
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
