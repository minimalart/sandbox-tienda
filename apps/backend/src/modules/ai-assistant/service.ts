import { MedusaService } from '@medusajs/framework/utils';
import {
  ChatThread,
  ChatMessage,
  ToolPolicy,
  McpApiKey,
  McpServer,
  OAuthClient,
  OAuthCode,
  OAuthToken,
  Agent,
  Skill,
  Proposal,
  AgentRun,
  AgentStep,
  AgentMemory,
  MemoryDocument,
  WorkflowDefinition,
  WorkflowRun,
  Campaign,
} from './models';

/**
 * Servicio del módulo Asistente IA. `MedusaService` autogenera el CRUD de cada
 * modelo (listChatThreads, createChatThreads, listChatMessages, …). El loop
 * agéntico y el cliente de OpenRouter viven en `./ai/*` y usan este servicio
 * solo para persistir hilos/mensajes y leer/guardar overrides de permisos.
 */
export default class AiAssistantModuleService extends MedusaService({
  ChatThread,
  ChatMessage,
  ToolPolicy,
  McpApiKey,
  McpServer,
  OAuthClient,
  OAuthCode,
  OAuthToken,
  Agent,
  Skill,
  Proposal,
  AgentRun,
  AgentStep,
  AgentMemory,
  MemoryDocument,
  WorkflowDefinition,
  WorkflowRun,
  Campaign,
}) {}
