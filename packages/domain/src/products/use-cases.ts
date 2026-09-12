import type { ProductRepository } from "./ports";
import type { Product } from "./entities";

export function listAvailableProducts(repo: ProductRepository): Promise<Product[]> {
  return repo.listAvailable();
}

export async function getProductBySlug(repo: ProductRepository, slug: string): Promise<Product> {
  const product = await repo.findBySlug(slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  return product;
}
