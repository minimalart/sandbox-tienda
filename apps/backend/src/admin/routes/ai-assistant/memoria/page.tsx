import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container } from '@medusajs/ui';
import { Memory } from '../components/memory';

const MemoryPage = () => (
  <Container className="p-0">
    <Memory />
  </Container>
);

export const config = defineRouteConfig({ label: 'Memoria', rank: 5 });

export default MemoryPage;
