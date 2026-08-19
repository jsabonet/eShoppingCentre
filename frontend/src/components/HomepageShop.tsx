"use client";

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scroll = (id: string, dir: -1 | 1) => {
    const el = scrollRefs.current[id];
    if (el) {
      el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    }
  };

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
              <div className="flex items-center gap-2">
                {section.viewAllLink && (
                  <a
                    href={section.viewAllLink}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    {section.viewAllLabel || 'Ver todos →'}
                  </a>
                )}
                <button
                  onClick={() => scroll(section.id, -1)}
                  aria-label={`Anterior: ${section.title}`}
                  className="p-2 border border-border rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => scroll(section.id, 1)}
                  aria-label={`Seguinte: ${section.title}`}
                  className="p-2 border border-border rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div
              ref={(el) => { scrollRefs.current[section.id] = el; }}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
            >
              {section.products.map((product) => (
                <div
                  key={product.id}
                  className="shrink-0 w-[170px] sm:w-[220px] md:w-[240px]"
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
