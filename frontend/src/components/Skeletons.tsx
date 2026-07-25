'use client';

/**
 * Skeleton components for loading states.
 * Reusable animated placeholders that match the shape of real content.
 */

/** A single product card skeleton (matches ProductCard dimensions). */
export function ProductCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
      {/* Image placeholder */}
      <div className="aspect-square bg-muted" />
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="h-3 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="flex items-center gap-2 pt-2">
          <div className="h-6 bg-muted rounded w-16" />
          <div className="h-4 bg-muted rounded w-12" />
        </div>
      </div>
    </div>
  );
}

/** Grid of product card skeletons. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A store card skeleton. */
export function StoreCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

/** Grid of store card skeletons. */
export function StoreGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StoreCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Blog post card skeleton. */
export function BlogCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-muted rounded w-1/4" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-5/6" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}

/** Page-level skeleton: title + grid. */
export function PageSkeleton({
  title = true,
  grid = 'products',
  itemCount = 8,
}: {
  title?: boolean;
  grid?: 'products' | 'stores' | 'blog';
  itemCount?: number;
}) {
  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      {title && (
        <div className="mb-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-64" />
        </div>
      )}
      {grid === 'products' && <ProductGridSkeleton count={itemCount} />}
      {grid === 'stores' && <StoreGridSkeleton count={itemCount} />}
      {grid === 'blog' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: itemCount }).map((_, i) => (
            <BlogCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
