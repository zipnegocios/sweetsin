import type { Product } from "@workspace/domain/products";
import { MenuGrid } from "./menu-grid";

export function Menu({ products }: { products: Product[] }) {
  return <MenuGrid products={products} />;
}
