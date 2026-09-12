import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { MenuGrid } from "./menu-grid";

export async function Menu() {
  const products = await listAvailableProducts(new DrizzleProductRepository());
  return <MenuGrid products={products} />;
}
