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

  // Ref callback: regista o elemento e liga a roda do rato ao scroll horizontal
  const attachTrack = (id: string) => (el: HTMLDivElement | null) => {
    scrollRefs.current[id] = el;
    if (!el || el.dataset.wheelBound) return;
    el.dataset.wheelBound = '1';
    el.addEventListener('wheel', (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      // Só traduz a roda vertical (rato); gestos horizontais do trackpad seguem nativos
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }, { passive: false });
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
              {section.viewAllLink && (
                <a
                  href={section.viewAllLink}
                  className="text-sm text-accent hover:underline font-medium"
                >
                  {section.viewAllLabel || 'Ver todos →'}
                </a>
              )}
            </div>

            <div className="relative group">
              <div
                ref={attachTrack(section.id)}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x pb-2"
              >
                {section.products.map((product) => (
                  <div
                    key={product.id}
                    className="shrink-0 w-[170px] sm:w-[220px] md:w-[240px] snap-start"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>

              {/* Setas overlay — navegação por cursor (desktop) */}
              <button
                onClick={() => scroll(section.id, -1)}
                aria-label={`Anterior: ${section.title}`}
                className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 border border-border rounded-full shadow-md hover:bg-muted transition-opacity opacity-0 group-hover:opacity-100 z-10"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll(section.id, 1)}
                aria-label={`Seguinte: ${section.title}`}
                className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 border border-border rounded-full shadow-md hover:bg-muted transition-opacity opacity-0 group-hover:opacity-100 z-10"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
