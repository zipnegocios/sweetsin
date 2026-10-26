import { eq, inArray } from "drizzle-orm";
import type { Product, ProductRepository } from "@workspace/domain/products";
import { db } from "../index";
import { productsTable } from "../schema";

export class DrizzleProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const [row] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
    return row ?? null;
  }

  /** Una sola consulta para varios ids (ids desconocidos simplemente no vuelven). */
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return db.select().from(productsTable).where(inArray(productsTable.id, ids));
  }

  async listAvailable(): Promise<Product[]> {
    return db.select().from(productsTable).where(eq(productsTable.available, true));
  }
}
