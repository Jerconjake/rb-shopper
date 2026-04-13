import React from 'react';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { Product } from '../types';

const TYPE_EMOJI: Record<string, string> = {
  Tops: '👚',
  Dresses: '👗',
  Pants: '👖',
  Skirts: '🩱',
  Outerwear: '🧥',
  Accessories: '👜',
  Shoes: '👠',
  Jewelry: '💍',
  Bags: '👛',
  Activewear: '🏃',
};

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const emoji = TYPE_EMOJI[product.productType] || '✨';
  // Shopify prices come back as minor units (e.g. "8900" = $89.00)
  const minP = parseFloat(product.minPrice) / 100;
  const maxP = parseFloat(product.maxPrice) / 100;
  const fmt = (n: number) => n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
  const priceStr = minP === maxP ? fmt(minP) : `${fmt(minP)}–${fmt(maxP)}`;

  const sizes = new Set<string>();
  const colours = new Set<string>();
  product.variants.forEach(v => {
    v.options.forEach(o => {
      if (o.name.toLowerCase().includes('size')) sizes.add(o.value);
      if (o.name.toLowerCase().includes('col')) colours.add(o.value);
    });
  });

  const inStock = product.variants.filter(v => v.available && (v.qty || 0) > 0).length;

  return (
    <div className="card bg-base-200 border border-base-300 w-44 flex-shrink-0 hover:border-primary transition-colors">
      {/* Image / Placeholder */}
      <div className="h-36 bg-base-300 rounded-t-xl flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-60">
            <span className="text-4xl">{emoji}</span>
            <span className="text-xs text-base-content/40">{product.productType}</span>
          </div>
        )}
      </div>

      <div className="card-body p-3 gap-1">
        <p className="text-sm font-semibold text-base-content leading-tight line-clamp-2">
          {product.title}
        </p>
        {product.vendor && (
          <p className="text-xs text-base-content/50">{product.vendor}</p>
        )}
        <p className="text-sm font-bold text-primary mt-1">{priceStr} CAD</p>

        {colours.size > 0 && (
          <p className="text-xs text-base-content/50 leading-tight">
            {Array.from(colours).slice(0, 3).join(' · ')}
            {colours.size > 3 && ` +${colours.size - 3}`}
          </p>
        )}
        {sizes.size > 0 && (
          <p className="text-xs text-base-content/50 leading-tight">
            {Array.from(sizes).slice(0, 4).join(', ')}
            {sizes.size > 4 && '…'}
          </p>
        )}

        <span className="text-xs text-success mt-0.5">{inStock} in stock</span>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2">
          <button
            className="btn btn-xs btn-primary flex-1 gap-1 text-xs"
            onClick={() => onAddToCart?.(product)}
          >
            <ShoppingCart size={10} />
            Add
          </button>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-xs btn-ghost btn-circle opacity-50 hover:opacity-100"
            title="View on store"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};
