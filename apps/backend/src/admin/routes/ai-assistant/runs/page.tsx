import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { Runs } from '../components/runs';

const RunsPage = () => (
  <Container className="p-0">
    <div className="flex items-center gap-2 px-6 py-4">
      <Heading level="h1">Logs</Heading>
      <ExtensionVersion extension="ai-assistant" />
    </div>
    <div className="px-6 pb-6">
      <Runs />
    </div>
  </Container>
);

export const config = defineRouteConfig({ label: 'Logs', rank: 3 });

export default RunsPage;
