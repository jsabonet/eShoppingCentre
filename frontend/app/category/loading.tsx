import { PageSkeleton } from '@/src/components/Skeletons';

export default function Loading() {
  return <PageSkeleton grid="products" itemCount={12} />;
}
