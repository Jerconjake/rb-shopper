import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
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
    <div className="rb-product-card">
      {/* Image */}
      <div style={{
        height: '140px',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', opacity: 0.3 }}>
            <span style={{ fontSize: '28px' }}>✦</span>
          </div>
        )}
        {inStock > 0 && (
          <span style={{
            position: 'absolute',
            top: '8px', right: '8px',
            background: 'rgba(8,8,8,0.8)',
            color: '#9caa8e',
            fontSize: '9px',
            letterSpacing: '1px',
            padding: '3px 7px',
            fontFamily: "'Inter', sans-serif",
          }}>
            IN STOCK
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{
          fontSize: '12px',
          fontFamily: "'Inter', sans-serif",
          color: '#f0ece4',
          lineHeight: 1.4,
          fontWeight: 400,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {product.title}
        </p>

        {product.vendor && (
          <p style={{ fontSize: '10px', color: 'rgba(240,236,228,0.3)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {product.vendor}
          </p>
        )}

        <p style={{
          fontSize: '13px',
          color: '#c4a26e',
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 500,
          marginTop: '4px',
        }}>
          {priceStr} CAD
        </p>

        {colours.size > 0 && (
          <p style={{ fontSize: '10px', color: 'rgba(240,236,228,0.3)', fontFamily: "'Inter', sans-serif" }}>
            {Array.from(colours).slice(0, 3).join(' · ')}{colours.size > 3 ? ` +${colours.size - 3}` : ''}
          </p>
        )}
        {sizes.size > 0 && (
          <p style={{ fontSize: '10px', color: 'rgba(240,236,228,0.25)', fontFamily: "'Inter', sans-serif" }}>
            {Array.from(sizes).slice(0, 4).join(' · ')}{sizes.size > 4 ? '…' : ''}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          <button
            className="btn-add-luxury"
            onClick={() => onAddToCart?.(product)}
          >
            Add
          </button>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon-luxury"
            title="View on store"
          >
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
};
