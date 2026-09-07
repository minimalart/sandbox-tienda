import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Chat } from '../components/chat';

// Sin padding alrededor: el chat ocupa todo el ancho y alto disponibles.
const ChatPage = () => <Chat />;

export const config = defineRouteConfig({ label: 'Chat', rank: 0 });

export default ChatPage;
