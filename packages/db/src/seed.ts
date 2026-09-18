// Carga inicial de contenido real para products y trailer_stops (ambas
// tablas están vacías en el Postgres compartido dev=prod). Idempotente:
// products usa upsert por slug; trailer_stops verifica existencia por
// location+startTime antes de insertar (no tiene una unique key natural).
//
// tsx no carga .env automáticamente (mismo gotcha que Vitest, ver
// vitest.config.ts) — y como los imports estáticos de un módulo ES se
// hoistean por encima de cualquier otra sentencia, poner
// `process.loadEnvFile()` arriba de un `import { db } from "./index"`
// estático no alcanza a correr antes de que ese import se evalúe (y
// reviente por falta de DATABASE_URL). Por eso "./index" y "./schema" se
// importan de forma dinámica, dentro de main().
process.loadEnvFile();

const ADELAIDE_UTC_OFFSET_HOURS = 9.5; // ACST — sin horario de verano, primer borrador

function adelaideTime(daysFromNow: number, hour: number, minute: number): Date {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + daysFromNow);
  return new Date(base.getTime() + (hour + minute / 60 - ADELAIDE_UTC_OFFSET_HOURS) * 60 * 60 * 1000);
}

function daysUntilWeekday(targetDay: number): number {
  const today = new Date().getUTCDay();
  return (targetDay - today + 7) % 7 || 7;
}

const PRODUCTS = [
  { slug: "gluttony", category: "sin" as const, nameEn: "Gluttony", nameEs: "Gula", descriptionEn: "More than you should. Exactly as much as you want.", descriptionEs: "Más de lo que deberías. Exactamente lo que quieres.", priceCents: 1300, imageUrl: "/products/p1.jpg", featured: false },
  { slug: "lust", category: "sin" as const, nameEn: "Lust", nameEs: "Lujuria", descriptionEn: "Impossible to resist. Impossible to have just one.", descriptionEs: "Imposible resistirse. Imposible comer solo uno.", priceCents: 1300, imageUrl: "/products/p2.jpg", featured: false },
  { slug: "wrath", category: "sin" as const, nameEn: "Wrath", nameEs: "Ira", descriptionEn: "Bold, aggressive, uncompromising in every bite.", descriptionEs: "Audaz, intenso, sin concesiones en cada bocado.", priceCents: 1300, imageUrl: "/products/p3.jpg", featured: false },
  { slug: "envy", category: "sin" as const, nameEn: "Envy", nameEs: "Envidia", descriptionEn: "The one everyone wishes was on their plate.", descriptionEs: "El que todos desean tener en su plato.", priceCents: 1300, imageUrl: "/products/p4.jpg", featured: false },
  { slug: "pride", category: "sin" as const, nameEn: "Pride", nameEs: "Soberbia", descriptionEn: "Our finest. No apologies necessary.", descriptionEs: "Nuestro mejor postre. Sin pedir disculpas.", priceCents: 1300, imageUrl: "/products/p5.jpg", featured: false },
  { slug: "greed", category: "sin" as const, nameEn: "Greed", nameEs: "Avaricia", descriptionEn: "Because one was never going to be enough.", descriptionEs: "Porque uno nunca iba a ser suficiente.", priceCents: 1300, imageUrl: "/products/p6.jpg", featured: false },
  { slug: "sloth", category: "sin" as const, nameEn: "Sloth", nameEs: "Pereza", descriptionEn: "The indulgence that demands you slow down.", descriptionEs: "El antojo que te obliga a ir despacio.", priceCents: 1300, imageUrl: "/products/p7.jpg", featured: false },
  { slug: "patience", category: "virtue" as const, nameEn: "Patience", nameEs: "Paciencia", descriptionEn: "Good things come to those who wait. These are worth it.", descriptionEs: "Las cosas buenas llegan para quien espera. Estos lo valen.", priceCents: 1100, imageUrl: "/products/p8.jpg", featured: false },
  { slug: "kindness", category: "virtue" as const, nameEn: "Kindness", nameEs: "Bondad", descriptionEn: "Sweet, gentle, made with care.", descriptionEs: "Dulce, suave, hecho con cariño.", priceCents: 1100, imageUrl: "/products/p9.jpg", featured: false },
  { slug: "humility", category: "virtue" as const, nameEn: "Humility", nameEs: "Humildad", descriptionEn: "Simple ingredients. Extraordinary result.", descriptionEs: "Ingredientes simples. Resultado extraordinario.", priceCents: 1100, imageUrl: "/products/p10.jpg", featured: false },
  { slug: "charity", category: "virtue" as const, nameEn: "Charity", nameEs: "Caridad", descriptionEn: "A little sweetness goes a long way.", descriptionEs: "Un poco de dulzura rinde mucho.", priceCents: 1100, imageUrl: "/products/p11.jpg", featured: false },
  { slug: "diligence", category: "virtue" as const, nameEn: "Diligence", nameEs: "Diligencia", descriptionEn: "Crafted with attention to every detail.", descriptionEs: "Elaborado con atención a cada detalle.", priceCents: 1100, imageUrl: "/products/p12.jpg", featured: false },
  { slug: "temperance", category: "virtue" as const, nameEn: "Temperance", nameEs: "Templanza", descriptionEn: "Balance never tasted this good.", descriptionEs: "El equilibrio nunca supo tan bien.", priceCents: 1100, imageUrl: "/products/p13.jpg", featured: false },
  { slug: "hope", category: "virtue" as const, nameEn: "Hope", nameEs: "Esperanza", descriptionEn: "The first bite of something wonderful.", descriptionEs: "El primer bocado de algo maravilloso.", priceCents: 1100, imageUrl: "/products/p14.jpg", featured: false },
  { slug: "la-repolla", category: "sin" as const, nameEn: "La Repolla", nameEs: "La Repolla", descriptionEn: "Filled with homemade arequipe, dusted with something you didn't know you were missing.", descriptionEs: "Relleno de arequipe casero, espolvoreado con algo que no sabías que te faltaba.", priceCents: 1300, imageUrl: "/products/p15.jpg", featured: true },
  { slug: "sweet-sin-coffee", category: "coffee" as const, nameEn: "Sweet Sin Coffee", nameEs: "Café Sweet Sin", descriptionEn: "Locally roasted, made fresh at the trailer.", descriptionEs: "Tostado localmente, preparado fresco en el trailer.", priceCents: 450, imageUrl: "/products/cafe.png", featured: false },
];

const TRAILER_STOPS = [
  { location: "Central Market, Adelaide CBD", lat: -34.9289, lng: 138.5999, weekday: 5, startHour: 16, endHour: 20 },
  { location: "Rundle Park, Adelaide", lat: -34.9235, lng: 138.6087, weekday: 6, startHour: 10, endHour: 15 },
  { location: "Prospect Farmers Market", lat: -34.8814, lng: 138.5931, weekday: 0, startHour: 9, endHour: 13 },
];

async function main() {
  const { db, pool } = await import("./index");
  const { productsTable, trailerStopsTable, settingsTable, usersTable } = await import("./schema");
  const { and, eq } = await import("drizzle-orm");
  const { hashPassword } = await import("@workspace/domain/users");

  for (const product of PRODUCTS) {
    await db
      .insert(productsTable)
      .values(product)
      .onConflictDoUpdate({ target: productsTable.slug, set: product });
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);

  let createdStops = 0;
  for (const stop of TRAILER_STOPS) {
    const daysUntil = daysUntilWeekday(stop.weekday);
    const startTime = adelaideTime(daysUntil, stop.startHour, 0);
    const endTime = adelaideTime(daysUntil, stop.endHour, 0);

    const [existing] = await db
      .select({ id: trailerStopsTable.id })
      .from(trailerStopsTable)
      .where(and(eq(trailerStopsTable.location, stop.location), eq(trailerStopsTable.startTime, startTime)));

    if (existing) continue;

    await db.insert(trailerStopsTable).values({
      location: stop.location,
      lat: stop.lat,
      lng: stop.lng,
      startTime,
      endTime,
      status: "scheduled",
    });
    createdStops++;
  }
  console.log(`Seeded ${createdStops} new trailer stop(s) (${TRAILER_STOPS.length - createdStops} already existed).`);

  await db.insert(settingsTable).values({ id: 1, deliveryFeeCents: 500 }).onConflictDoNothing();
  console.log("Ensured default settings row (delivery fee: 500 cents).");

  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await db
      .insert(usersTable)
      .values({ name: "Admin", email: adminEmail, role: "admin", passwordHash, isActive: true, preferredLocale: "en" })
      .onConflictDoUpdate({ target: usersTable.email, set: { passwordHash, isActive: true } });
    console.log(`Ensured admin user: ${adminEmail}.`);
  } else {
    console.log("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping admin seed.");
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
