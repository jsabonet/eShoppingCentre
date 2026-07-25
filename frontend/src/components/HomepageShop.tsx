"use client";

import ProductCard from './ProductCard';
import type { Product } from '../data/marketplace';

export interface ProductSection {
  id: string;
  title: string;
  titleIcon?: string;
  products: Product[];
  viewAllLink?: string;
  viewAllLabel?: string;
  bgClass?: string;
}

interface HomepageShopProps {
  sections: ProductSection[];
}

export default function HomepageShop({ sections }: HomepageShopProps) {
  return (
    <>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={`py-12 px-4 ${section.bgClass || ''}`}
        >
          <div className="max-w-[1500px] mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {section.titleIcon && <span className="text-accent">{section.titleIcon}</span>}
                {section.title}
              </h2>
              {section.viewAllLink && (
                <a
                  href={section.viewAllLink}
                  className="text-sm text-accent hover:underline font-medium"
                >
                  {section.viewAllLabel || 'Ver todos →'}
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {section.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
