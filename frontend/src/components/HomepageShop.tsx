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
  const drag = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);
  const suppressClickUntil = useRef(0);

  const scroll = (id: string, dir: -1 | 1) => {
    const el = scrollRefs.current[id];
    if (el) {
      el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    }
  };

  // Arrastar com o cursor (rato ou touchpad) para percorrer o carrossel
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startLeft: e.currentTarget.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    if (!st.moved && Math.abs(dx) > 6) st.moved = true;
    if (st.moved) {
      e.currentTarget.scrollLeft = st.startLeft - dx;
    }
  };

  const endDrag = () => {
    if (drag.current?.moved) suppressClickUntil.current = Date.now() + 300;
    drag.current = null;
  };

  // Evita que o clique dispare (link/botão) logo após um arrasto
  const onCaptureClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      e.preventDefault();
      e.stopPropagation();
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
              {section.viewAllLink && (
                <a
                  href={section.viewAllLink}
                  className="text-sm text-accent hover:underline font-medium"
                >
                  {section.viewAllLabel || 'Ver todos →'}
                </a>
              )}
            </div>

            <div className="relative">
              <div
                ref={(el) => { scrollRefs.current[section.id] = el; }}
                onClickCapture={onCaptureClick}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
                onDragStart={(e) => e.preventDefault()}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x pb-2 select-none cursor-grab active:cursor-grabbing"
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
                className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 border border-border rounded-full shadow-md hover:bg-muted transition-colors z-10"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll(section.id, 1)}
                aria-label={`Seguinte: ${section.title}`}
                className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 border border-border rounded-full shadow-md hover:bg-muted transition-colors z-10"
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
