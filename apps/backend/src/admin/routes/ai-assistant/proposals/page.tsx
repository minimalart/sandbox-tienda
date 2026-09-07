import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container } from '@medusajs/ui';
import { Proposals } from '../components/proposals';

const ProposalsPage = () => (
  <Container className="p-0">
    <Proposals />
  </Container>
);

export const config = defineRouteConfig({ label: 'Propuestas', rank: 1 });

export default ProposalsPage;
