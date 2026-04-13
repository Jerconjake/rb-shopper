import React from 'react';
import { Product } from '../types';

interface Props {
  product: Product;
  onAddToCart: (p: Product) => void;
}

export const ProductCard: React.FC<Props> = ({ product, onAddToCart }) => {
  const price = product.priceRange
    ? `$${(product.priceRange.minVariantPrice.amount / 100).toFixed(0)}`
    : '—';

  const hasImage = product.featuredImage?.url;

  return (
    <div className="rb-product-card" onClick={() => onAddToCart(product)}>
      {/* Image */}
      <div style={{
        width: '100%',
        aspectRatio: '3/4',
        background: hasImage ? 'var(--rb-raised)' : 'var(--rb-raised)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {hasImage ? (
          <img
            src={product.featuredImage!.url}
            alt={product.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.4s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '24px',
              color: 'var(--rb-cream-18)',
              letterSpacing: '1px',
            }}>
              RB
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 10px 8px' }}>
        <p style={{
          fontSize: '11.5px',
          fontFamily: "'Inter', sans-serif",
          color: 'var(--rb-cream)',
          lineHeight: 1.4,
          marginBottom: '4px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {product.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '15px',
            color: 'var(--rb-cream)',
            fontWeight: 400,
          }}>
            {price}
          </span>

          <button
            className="btn-add"
            onClick={e => { e.stopPropagation(); onAddToCart(product); }}
            style={{ flexGrow: 0, paddingLeft: '10px', paddingRight: '10px' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
