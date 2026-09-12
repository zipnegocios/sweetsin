import type { Product } from "./entities";

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  listAvailable(): Promise<Product[]>;
}
