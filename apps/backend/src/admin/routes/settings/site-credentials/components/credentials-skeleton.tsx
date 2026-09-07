import { Container } from '@medusajs/ui';
import { Skeleton } from '../../../../components/common/skeleton';

export const CredentialsSkeleton = () => <Container className="divide-y p-0" aria-label="Cargando integraciones">
  {[0, 1, 2, 3, 4].map(row => <div key={row} className="flex items-center gap-3 px-6 py-4"><Skeleton className="h-10 w-10 rounded-lg" /><Skeleton className="h-4 w-40 rounded" /><Skeleton className="ml-auto h-5 w-24 rounded" /></div>)}
</Container>;
