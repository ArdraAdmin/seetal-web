export const CATALOG_BRANDS = ["Seetal", "Sarvah", "SHMP", "Sh Lakshmi", "Nesto"] as const;

export type CatalogBrand = (typeof CATALOG_BRANDS)[number];
