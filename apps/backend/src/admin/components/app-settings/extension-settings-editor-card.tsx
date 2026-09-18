import { Button, Container, Heading, Text } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { findNamespace } from '../../../modules/app-settings/descriptors';

/** A settings group edited by a specialized editor instead of a raw JSON input. */
export function ExtensionSettingsEditorCard({ namespace, groups, title, description, href, action }: {
  namespace: string; groups: string[]; title: string; description: string; href: string; action: string;
}) {
  const navigate = useNavigate();
  const fields = findNamespace(namespace)?.settings.filter(setting => groups.includes(setting.group));
  if (!fields?.length) return null;
  return <Container>
    <div className="flex items-center justify-between gap-4">
      <div><Heading level="h2">{title}</Heading><Text className="mt-2 text-ui-fg-subtle">{description}</Text></div>
      <Button variant="secondary" size="small" onClick={() => navigate(href)}>{action}</Button>
    </div>
  </Container>;
}
