export type ProductCategory = "beat" | "service";

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  genre?: string;
  description: string;
  price: number;
  artwork?: string;
  audioPreview?: string;
  previewDuration?: number;
  deliverables: string[];
  badge?: string;
  stripeProductId?: string;
  stripePriceId?: string;
}

export interface StoreSettings {
  brandName: string;
  heroTitle: string;
  heroDescription: string;
  storeTitle: string;
  storeDescription: string;
  contactEmail: string;
  instagramUrl: string;
}
