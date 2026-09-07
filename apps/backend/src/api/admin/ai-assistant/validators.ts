import { z } from 'zod';
import { ALL_MEMORY_TYPES } from '../../../modules/ai-assistant/ai/memory';

const memoryTypeEnum = z.enum(ALL_MEMORY_TYPES as unknown as [string, ...string[]]);

export const AdminCreateThreadSchema = z.object({
  title: z.string().optional(),
});
export type AdminCreateThreadType = z.infer<typeof AdminCreateThreadSchema>;

/** Adjunto que manda el cliente (ya subido vía /admin/uploads). El `text` de un
 *  documento NO viene del cliente: lo extrae el server al recibirlo. */
export const AdminChatAttachmentSchema = z.object({
  kind: z.enum(['image', 'document']),
  url: z.string().min(1),
  file_id: z.string().nullable().optional(),
  filename: z.string().min(1),
  mime_type: z.string().min(1),
});
export type AdminChatAttachmentType = z.infer<typeof AdminChatAttachmentSchema>;

export const AdminSendMessageSchema = z
  .object({
    text: z.string().optional().default(''),
    model: z.string().optional(),
    skill: z.string().optional(),
    /** Mención `@agente` del composer: fija ese agente como activo para el turno. */
    agent_key: z.string().nullable().optional(),
    period: z
      .object({ from: z.string(), to: z.string() })
      .nullable()
      .optional(),
    attachments: z.array(AdminChatAttachmentSchema).max(10).optional(),
  })
  .refine(
    (d) => (d.text != null && d.text.trim().length > 0) || (d.attachments?.length ?? 0) > 0,
    { message: 'El mensaje no puede estar vacío', path: ['text'] },
  );
export type AdminSendMessageType = z.infer<typeof AdminSendMessageSchema>;

export const AdminConfirmToolsSchema = z.object({
  model: z.string().optional(),
  decisions: z.array(
    z.object({
      tool_call_id: z.string(),
      approved: z.boolean(),
    }),
  ),
});
export type AdminConfirmToolsType = z.infer<typeof AdminConfirmToolsSchema>;

export const AdminCreateMcpKeySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
});
export type AdminCreateMcpKeyType = z.infer<typeof AdminCreateMcpKeySchema>;

export const AdminSaveToolPoliciesSchema = z.object({
  policies: z.array(
    z.object({
      tool_name: z.string(),
      action: z.string(),
      resource: z.string().optional(),
      mode: z.enum(['auto', 'ask', 'prohibited']),
    }),
  ),
});
export type AdminSaveToolPoliciesType = z.infer<typeof AdminSaveToolPoliciesSchema>;

export const AdminGenerateProposalsSchema = z.object({
  agent_key: z.string().optional(),
  limit: z.number().int().positive().max(10).optional(),
});
export type AdminGenerateProposalsType = z.infer<typeof AdminGenerateProposalsSchema>;

export const AdminSaveAgentSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().nullable().optional(),
  instructions: z.string().min(1, 'Las instrucciones son obligatorias'),
  model: z.string().nullable().optional(),
  max_tokens: z.number().int().positive().nullable().optional(),
  reasoning_effort: z.enum(['minimal', 'low', 'medium', 'high']).nullable().optional(),
  enabled: z.boolean().optional(),
  is_orchestrator: z.boolean().optional(),
  rank: z.number().int().optional(),
  icon: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  allowed_tools: z
    .array(
      z.object({
        tool: z.string(),
        resources: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      }),
    )
    .nullable()
    .optional(),
  skills: z.array(z.string()).optional(),
  handoff_targets: z.array(z.string()).optional(),
  memory_types: z.array(z.string()).nullable().optional(),
});
export type AdminSaveAgentType = z.infer<typeof AdminSaveAgentSchema>;

export const AdminDraftAgentSchema = z.object({
  prompt: z.string().min(1, 'Describí el agente que querés crear'),
});
export type AdminDraftAgentType = z.infer<typeof AdminDraftAgentSchema>;

export const AdminSaveMcpServerSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  url: z.string().url('URL inválida'),
  avatar_url: z.string().nullable().optional(),
  transport: z.enum(['http', 'sse']).optional(),
  auth_type: z.enum(['none', 'bearer', 'header', 'oauth']).optional(),
  auth_header_name: z.string().nullable().optional(),
  // Secreto en claro: SOLO de entrada (nunca se devuelve). Vacío en update = no se pisa.
  secret: z.string().nullable().optional(),
  oauth_client_id: z.string().nullable().optional(),
  oauth_client_secret: z.string().nullable().optional(),
  oauth_scope: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});
export type AdminSaveMcpServerType = z.infer<typeof AdminSaveMcpServerSchema>;

export const AdminSaveSkillSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  instructions: z.string().min(1, 'Las instrucciones son obligatorias'),
  enabled: z.boolean().optional(),
});
export type AdminSaveSkillType = z.infer<typeof AdminSaveSkillSchema>;

// ─── Memoria ──────────────────────────────────────────────────────────────────

export const AdminCreateMemorySchema = z.object({
  agent_key: z.string().nullable().optional(),
  memory_type: memoryTypeEnum,
  title: z.string().min(1, 'El título es obligatorio'),
  content: z.string().min(1, 'El contenido es obligatorio'),
  summary: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  importance_score: z.number().int().min(0).max(100).optional(),
  confidence_score: z.number().int().min(0).max(100).optional(),
});
export type AdminCreateMemoryType = z.infer<typeof AdminCreateMemorySchema>;

export const AdminUpdateMemorySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  memory_type: memoryTypeEnum.optional(),
  agent_key: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  importance_score: z.number().int().min(0).max(100).optional(),
  confidence_score: z.number().int().min(0).max(100).optional(),
  status: z.enum(['pending', 'active', 'archived']).optional(),
});
export type AdminUpdateMemoryType = z.infer<typeof AdminUpdateMemorySchema>;

export const AdminSearchMemorySchema = z.object({
  query: z.string().min(1, 'Ingresá qué querés buscar'),
  agent_key: z.string().nullable().optional(),
  memory_types: z.array(memoryTypeEnum).optional(),
  limit: z.number().int().positive().max(20).optional(),
});
export type AdminSearchMemoryType = z.infer<typeof AdminSearchMemorySchema>;

export const AdminMemoryFeedbackSchema = z.object({
  useful: z.boolean(),
});
export type AdminMemoryFeedbackType = z.infer<typeof AdminMemoryFeedbackSchema>;

// ─── Documentos (contexto por agente) ─────────────────────────────────────────

export const AdminUploadDocumentSchema = z.object({
  filename: z.string().min(1, 'Falta el nombre del archivo'),
  mimeType: z.string().min(1, 'Falta el tipo de archivo'),
  // Contenido en base64 (puede venir como data URL `data:...;base64,xxxx`).
  content: z.string().min(1, 'Falta el contenido del archivo'),
  title: z.string().nullable().optional(),
  agent_key: z.string().nullable().optional(),
});
export type AdminUploadDocumentType = z.infer<typeof AdminUploadDocumentSchema>;

// ─── Workflows ──────────────────────────────────────────────────────────────

const workflowStepSchema = z.object({
  key: z.string().min(1),
  agent_key: z.string().min(1),
  task: z.string().min(1),
  parallel_group: z.union([z.string(), z.number()]).nullable().optional(),
  requires_approval: z.boolean().optional(),
  output_key: z.string().optional(),
  label: z.string().optional(),
  // Sin estos dos, zod los DESCARTABA en silencio al guardar (admin o API) y el
  // workflow perdía los pasos condicionales y el on_error:'continue' de contenido.
  when: z.string().nullable().optional(),
  on_error: z.enum(['fail', 'continue']).nullable().optional(),
});

export const AdminSaveWorkflowSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  steps: z.array(workflowStepSchema).min(1, 'Agregá al menos un paso'),
  final_action: z.object({ type: z.string() }).nullable().optional(),
});
export type AdminSaveWorkflowType = z.infer<typeof AdminSaveWorkflowSchema>;

export const AdminResumeWorkflowSchema = z.object({
  approved: z.boolean(),
});
export type AdminResumeWorkflowType = z.infer<typeof AdminResumeWorkflowSchema>;
