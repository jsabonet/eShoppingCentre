'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function HeroAnimated() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end center'],
  });

  const borderTopLeftRadius = useTransform(
    scrollYProgress,
    [0, 1],
    [24, 0],
    { clamp: true }
  );

  const borderTopRightRadius = useTransform(
    scrollYProgress,
    [0, 1],
    [24, 0],
    { clamp: true }
  );

  const borderBottomLeftRadius = useTransform(
    scrollYProgress,
    [0, 1],
    [24, 0],
    { clamp: true }
  );

  const borderBottomRightRadius = useTransform(
    scrollYProgress,
    [0, 1],
    [24, 0],
    { clamp: true }
  );

  const wrapperScale = useTransform(scrollYProgress, [0, 1], [0.92, 1], {
    clamp: true,
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1.5, 1], {
    clamp: true,
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, 80], {
    clamp: true,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-[80vh] md:h-[82vh] w-full overflow-hidden"
    >
      <motion.div
        className="h-[80vh] w-full flex items-center justify-center overflow-hidden"
      >
        <motion.div
          className="h-full flex"
          style={{
            scale: wrapperScale,
            transformOrigin: 'center',
            borderTopLeftRadius,
            borderTopRightRadius,
            borderBottomLeftRadius,
            borderBottomRightRadius,
            overflow: 'hidden',
            width: '100%',
            position: 'relative',
          }}
        >
          <motion.img
            src="https://cdn.b12.io/client_media/iKv1biKD/e81849f1-7e6d-11f1-b53d-0242ac110002-dfe1c530-0640-11f1-bb5e-0242ac110002-TncVTL5K1ut6MD2y7mdv8.jpg"
            alt="Luxury jewelry collection"
            className="w-full h-full md:h-auto object-cover"
            style={{ scale: imageScale }}
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

          <motion.div
            className="absolute bottom-[20%] left-0 p-8 md:p-12"
            style={{ y: textY }}
          >
            <h1 className="text-5xl md:text-6xl text-white mb-6" style={{ lineHeight: '1.1' }}>
              Modern fine jewelry for every day.
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 leading-relaxed max-w-2xl">
              Gold rings, minimalist necklaces, and everyday diamonds designed
              to live with you.
            </p>
            <a
              href="/index#categories"
              className="inline-block px-8 py-4 bg-accent text-primary font-semibold hover:bg-accent/90 transition-colors"
            >
              Shop Collection
            </a>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
