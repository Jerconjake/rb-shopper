export interface Variant {
  id: string;
  title: string;
  sku: string;
  price: string;
  available: boolean;
  qty: number;
  options: Array<{ name: string; value: string }>;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  tags: string[];
  productType: string;
  image: string | null;
  url: string;
  minPrice: string;
  maxPrice: string;
  variants: Variant[];
}

export interface CartItem {
  cartId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  price: string;
  qty: number;
  image: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'handoff';
  text: string;
  products?: Product[];
  timestamp: number;
}
