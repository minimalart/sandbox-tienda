import { useTranslation } from 'react-i18next';

export const workflowMessages = {
  es: {
    contract: 'Contrato del resultado (JSON)',
    contractHelp:
      'Definí los campos obligatorios con type: string, strings o boolean. Las listas admiten minItems. Vacío usa el contrato incorporado, si existe.',
    contractInvalid: 'El contrato del resultado debe ser JSON válido.',
    trust: 'Confiar en las anotaciones de lectura',
    trustHelp:
      'Permite lecturas automáticas declaradas por este servidor. Los permisos explícitos conservan prioridad.',
    modelResponded: 'El modelo terminó de responder',
    turnEnded: 'Turno finalizado',
    permissionsBlocked: 'Bloqueado por permisos',
  },
  en: {
    contract: 'Result contract (JSON)',
    contractHelp:
      'Define required fields with type: string, strings or boolean. Lists support minItems. Leave blank to use the built-in contract, if available.',
    contractInvalid: 'The result contract must be valid JSON.',
    trust: 'Trust read-only annotations',
    trustHelp:
      'Allow automatic reads declared by this server. Explicit permissions still take precedence.',
    modelResponded: 'The model finished responding',
    turnEnded: 'Turn ended',
    permissionsBlocked: 'Blocked by permissions',
  },
};

export function useWorkflowTranslation() {
  const { i18n } = useTranslation();
  for (const language of ['es', 'en'] as const) {
    if (!i18n.hasResourceBundle(language, 'ai-workflow')) {
      i18n.addResourceBundle(language, 'ai-workflow', workflowMessages[language]);
    }
  }
  return i18n.getFixedT(null, 'ai-workflow');
}
