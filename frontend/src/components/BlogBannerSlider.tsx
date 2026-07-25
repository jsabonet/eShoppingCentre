'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, User, Clock } from 'lucide-react';

interface BlogPostBanner {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  author: string;
  date: string;
  category: string;
  readTime: string;
}

interface BlogBannerSliderProps {
  posts: BlogPostBanner[];
}

export default function BlogBannerSlider({ posts }: BlogBannerSliderProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % posts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [posts.length]);

  const goTo = (index: number) => setCurrent(index);
  const prev = () => setCurrent(c => (c - 1 + posts.length) % posts.length);
  const next = () => setCurrent(c => (c + 1) % posts.length);

  if (posts.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden bg-card border-b border-border">
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="min-w-full relative block aspect-[2.5/1] md:aspect-[3/1]"
          >
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent flex items-center">
              <div className="px-6 md:px-16 max-w-2xl">
                {/* Category badge */}
                <span className="inline-block px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full mb-3 uppercase tracking-wide">
                  {post.category}
                </span>
                <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white mb-3 drop-shadow-lg line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-sm md:text-base text-white/90 mb-4 drop-shadow-md line-clamp-2 max-w-xl">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-4 text-xs md:text-sm text-white/80">
                  <span className="flex items-center gap-1.5">
                    <User size={14} /> {post.author}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} /> {post.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} /> {post.readTime}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Navigation Arrows */}
      {posts.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
            aria-label="Post anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
            aria-label="Próximo post"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots */}
      {posts.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {posts.map((_, index) => (
            <button
              key={index}
              onClick={(e) => { e.preventDefault(); goTo(index); }}
              className={`w-2.5 h-2.5 rounded-full transition-colors shadow-md ${
                index === current ? 'bg-accent scale-110' : 'bg-white/70 hover:bg-white/90'
              }`}
              aria-label={`Ir para post ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
