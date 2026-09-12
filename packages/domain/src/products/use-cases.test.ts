import { describe, it, expect } from "vitest";
import { listAvailableProducts, getProductBySlug } from "./use-cases";
import type { Product } from "./entities";
import type { ProductRepository } from "./ports";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "gluttony",
    category: "sin",
    nameEn: "Gluttony",
    nameEs: "Gula",
    descriptionEn: "More than you should.",
    descriptionEs: "Más de lo que deberías.",
    priceCents: 1300,
    imageUrl: null,
    featured: false,
    available: true,
    ...overrides,
  };
}

function fakeRepo(products: Product[]): ProductRepository {
  return {
    async findById(id) {
      return products.find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug) {
      return products.find((p) => p.slug === slug) ?? null;
    },
    async listAvailable() {
      return products.filter((p) => p.available);
    },
  };
}

describe("listAvailableProducts", () => {
  it("returns only available products", async () => {
    const repo = fakeRepo([fakeProduct({ id: "p1", available: true }), fakeProduct({ id: "p2", available: false })]);
    const result = await listAvailableProducts(repo);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});

describe("getProductBySlug", () => {
  it("returns the matching product", async () => {
    const repo = fakeRepo([fakeProduct({ slug: "gluttony" })]);
    const result = await getProductBySlug(repo, "gluttony");
    expect(result.slug).toBe("gluttony");
  });

  it("throws when the product does not exist", async () => {
    const repo = fakeRepo([]);
    await expect(getProductBySlug(repo, "missing")).rejects.toThrow("Product not found: missing");
  });
});
