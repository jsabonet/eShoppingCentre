import { PageSkeleton } from '@/src/components/Skeletons';

export default function Loading() {
  return <PageSkeleton title={false} grid="products" itemCount={8} />;
}
