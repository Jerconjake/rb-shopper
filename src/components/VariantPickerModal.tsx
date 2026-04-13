import React, { useState, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { Product, Variant, CartItem } from '../types';

interface VariantPickerModalProps {
  product: Product | null;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

export const VariantPickerModal: React.FC<VariantPickerModalProps> = ({ product, onClose, onAdd }) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setSelectedSize(null);
    setSelectedColor(null);
    setQty(1);
    setAdded(false);
  }, [product?.id]);

  if (!product) return null;

  const sizes = Array.from(new Set<string>(
    product.variants.flatMap(v => v.options.filter(o => o.name.toLowerCase().includes('size')).map(o => o.value))
  ));
  const colours = Array.from(new Set<string>(
    product.variants.flatMap(v => v.options.filter(o => o.name.toLowerCase().includes('col')).map(o => o.value))
  ));

  const findVariant = (): Variant | null => {
    if (product.variants.length === 1) return product.variants[0];
    return product.variants.find(v => {
      const vSizes = v.options.filter(o => o.name.toLowerCase().includes('size')).map(o => o.value);
      const vColors = v.options.filter(o => o.name.toLowerCase().includes('col')).map(o => o.value);
      const sizeOk = sizes.length === 0 || selectedSize === null || vSizes.includes(selectedSize);
      const colorOk = colours.length === 0 || selectedColor === null || vColors.includes(selectedColor);
      return sizeOk && colorOk;
    }) ?? null;
  };

  const variant = findVariant();
  const price = variant ? parseFloat(variant.price) : parseFloat(product.minPrice);
  const canAdd =
    product.variants.length === 1 ||
    ((sizes.length === 0 || selectedSize !== null) && (colours.length === 0 || selectedColor !== null));

  const handleAdd = () => {
    if (!canAdd || !variant) return;
    const cartItem: CartItem = {
      cartId: `${product.id}-${variant.id}-${Date.now()}`,
      productId: product.id,
      variantId: variant.id,
      productTitle: product.title,
      variantTitle: variant.title !== 'Default Title' ? variant.title : '',
      price: variant.price,
      qty,
      image: product.image,
    };
    onAdd(cartItem);
    setAdded(true);
    setTimeout(() => onClose(), 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-base-100/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card bg-base-200 border border-base-300 w-full max-w-sm shadow-xl mb-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body p-5 gap-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-2">
              <p className="font-bold text-base-content leading-tight">{product.title}</p>
              <p className="text-primary font-bold text-lg mt-0.5">${price.toFixed(2)} CAD</p>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle opacity-60" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Colour picker */}
          {colours.length > 0 && (
            <div>
              <p className="text-xs text-base-content/60 mb-2 font-medium uppercase tracking-wide">
                Colour{selectedColor ? `: ${selectedColor}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {colours.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`btn btn-sm ${selectedColor === c ? 'btn-primary' : 'btn-outline btn-primary opacity-60'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size picker */}
          {sizes.length > 0 && (
            <div>
              <p className="text-xs text-base-content/60 mb-2 font-medium uppercase tracking-wide">
                Size{selectedSize ? `: ${selectedSize}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`btn btn-sm ${selectedSize === s ? 'btn-primary' : 'btn-outline btn-primary opacity-60'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty */}
          <div className="flex items-center gap-3">
            <p className="text-xs text-base-content/60 font-medium uppercase tracking-wide">Qty</p>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm btn-circle btn-ghost border border-base-300"
                onClick={() => setQty(q => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-base-content">{qty}</span>
              <button
                className="btn btn-sm btn-circle btn-ghost border border-base-300"
                onClick={() => setQty(q => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          {/* Add button */}
          <button
            className={`btn w-full gap-2 ${added ? 'btn-success' : 'btn-primary'}`}
            onClick={handleAdd}
            disabled={!canAdd || added}
          >
            <ShoppingCart size={16} />
            {added ? '✓ Added to cart!' : `Add to Cart · $${(price * qty).toFixed(2)}`}
          </button>

          {!canAdd && (
            <p className="text-xs text-center text-base-content/40">
              {sizes.length > 0 && selectedSize === null ? 'Pick a size' : ''}
              {colours.length > 0 && selectedColor === null ? (sizes.length > 0 && selectedSize === null ? ' & colour' : 'Pick a colour') : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
