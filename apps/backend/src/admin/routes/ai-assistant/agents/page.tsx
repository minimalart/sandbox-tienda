import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container } from '@medusajs/ui';
import { Agents } from '../components/agents';

const AgentsPage = () => (
  <Container className="p-0">
    <Agents />
  </Container>
);

export const config = defineRouteConfig({ label: 'Agentes', rank: 2 });

export default AgentsPage;
