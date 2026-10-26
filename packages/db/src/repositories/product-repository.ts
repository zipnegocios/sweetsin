import { eq } from "drizzle-orm";
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

  async listAvailable(): Promise<Product[]> {
    return db.select().from(productsTable).where(eq(productsTable.available, true));
  }
}
