import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container } from '@medusajs/ui';
import { Workflows } from '../components/workflows';

const WorkflowsPage = () => (
  <Container className="p-0">
    <Workflows />
  </Container>
);

export const config = defineRouteConfig({ label: 'Workflows', rank: 3 });

export default WorkflowsPage;
