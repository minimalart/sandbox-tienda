import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import {
  AdminConfirmToolsSchema,
  AdminCreateMcpKeySchema,
  AdminCreateMemorySchema,
  AdminCreateThreadSchema,
  AdminDraftAgentSchema,
  AdminGenerateProposalsSchema,
  AdminMemoryFeedbackSchema,
  AdminSaveAgentSchema,
  AdminSaveMcpServerSchema,
  AdminSaveSkillSchema,
  AdminSaveToolPoliciesSchema,
  AdminSearchMemorySchema,
  AdminSendMessageSchema,
  AdminUpdateMemorySchema,
  AdminUploadDocumentSchema,
} from './validators';

export const adminAiAssistantMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/ai-assistant/threads',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateThreadSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/threads/:id/messages',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSendMessageSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/threads/:id/messages/stream',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSendMessageSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/threads/:id/confirm',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminConfirmToolsSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/tools',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveToolPoliciesSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/keys',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateMcpKeySchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/proposals/generate',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminGenerateProposalsSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/agents',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveAgentSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/agents/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveAgentSchema as any)],
  },
  {
    // Hermana de /agents (no bajo /agents/:id, para no chocar con su validación).
    matcher: '/admin/ai-assistant/draft-agent',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminDraftAgentSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/mcp-servers',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveMcpServerSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/mcp-servers/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveMcpServerSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/skills',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveSkillSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/skills/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSaveSkillSchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/memory',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateMemorySchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/memory/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateMemorySchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/memory/:id/feedback',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminMemoryFeedbackSchema as any)],
  },
  {
    // Después de `/memory/:id`: el matcher de :id también captura "search", así
    // que este corre último y su validador (search) es el que queda en validatedBody.
    matcher: '/admin/ai-assistant/memory/search',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminSearchMemorySchema as any)],
  },
  {
    matcher: '/admin/ai-assistant/agents/:id/documents',
    method: ['POST'],
    // El body lleva el archivo en base64 (~+33%): subimos el límite (default ~1mb).
    bodyParser: { sizeLimit: '15mb' },
    middlewares: [validateAndTransformBody(AdminUploadDocumentSchema as any)],
  },
];
