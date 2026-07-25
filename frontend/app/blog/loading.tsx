import { PageSkeleton } from '@/src/components/Skeletons';

export default function Loading() {
  return <PageSkeleton grid="blog" itemCount={9} />;
}
