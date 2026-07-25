"use client";

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '../data/marketplace';

interface BannerSliderProps {
  banners: Banner[];
}

export default function BannerSlider({ banners }: BannerSliderProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const goTo = (index: number) => setCurrent(index);
  const prev = () => setCurrent(c => (c - 1 + banners.length) % banners.length);
  const next = () => setCurrent(c => (c + 1) % banners.length);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => (
          <a
            key={banner.id}
            href={banner.link}
            className="min-w-full relative block aspect-[2.5/1] md:aspect-[3/1]"
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent flex items-center">
              <div className="px-6 md:px-16 max-w-2xl">
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg">
                  {banner.title}
                </h2>
                <p className="text-base md:text-lg text-white/95 mb-5 drop-shadow-md">
                  {banner.subtitle}
                </p>
                <span className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground text-base font-bold rounded-md transition-colors shadow-lg">
                  {banner.cta}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
        aria-label="Banner anterior"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
        aria-label="Próximo banner"
      >
        <ChevronRight size={24} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`w-3 h-3 rounded-full transition-colors shadow-md ${
              index === current ? 'bg-accent' : 'bg-white/70'
            }`}
            aria-label={`Ir para banner ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
