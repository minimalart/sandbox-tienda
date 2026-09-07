import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChatBubbleLeftRight } from '@medusajs/icons';
import { Badge, Container, Heading, Tabs } from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { CommentsList } from './components/comments-list';
import { CommentsSettings } from './components/comments-settings';

const CommentsPage = () => {
  return (
    <Container className="p-0">
      <div className="flex items-center gap-2 px-6 py-4">
        <Heading level="h1">Comentarios</Heading>
        <Badge size="2xsmall">v1.4.2</Badge>
      </div>
      <SiteScopeBar screen="comments" />
      <Tabs defaultValue="list">
        <div className="border-b border-ui-border-base px-6 pb-4 pt-1">
          <Tabs.List>
            <Tabs.Trigger value="list">Listado</Tabs.Trigger>
            <Tabs.Trigger value="config">Configuración</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="list">
          <CommentsList />
        </Tabs.Content>
        <Tabs.Content value="config" className="px-6 py-6">
          <CommentsSettings />
        </Tabs.Content>
      </Tabs>
    </Container>
  );
};

const CommentsIcon = () => <ChatBubbleLeftRight />;

export const config = defineRouteConfig({
  label: 'Comentarios',
  icon: CommentsIcon,
  rank: 80,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Comentarios',
};

export default CommentsPage;
