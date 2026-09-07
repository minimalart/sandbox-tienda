export type ComponentStatus = 'ready' | 'embedded' | 'experimental' | 'deprecated';
export interface TemplateManifest { id: string; name: string; version: string; status: ComponentStatus; source: string }
export interface ExtensionManifest { id: string; name: string; version: string; status: ComponentStatus; required?: boolean; dependencies: string[] }
export interface ProjectSelection { template: TemplateManifest; extensions: ExtensionManifest[] }
export const catalog: { schema_version: number; templates: TemplateManifest[]; extensions: ExtensionManifest[] };
export function validateCatalog(): { valid: boolean; errors: string[] };
export function resolveProjectSelection(input: { template: string; extensions?: string[] }): ProjectSelection;
