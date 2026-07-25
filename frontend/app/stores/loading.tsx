import { PageSkeleton } from '@/src/components/Skeletons';

export default function Loading() {
  return <PageSkeleton grid="stores" itemCount={6} />;
}
