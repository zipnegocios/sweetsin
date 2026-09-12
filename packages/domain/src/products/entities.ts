export type ProductCategory = "sin" | "virtue" | "coffee";

export interface Product {
  id: string;
  slug: string;
  category: ProductCategory;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  priceCents: number;
  imageUrl: string | null;
  featured: boolean;
  available: boolean;
}
