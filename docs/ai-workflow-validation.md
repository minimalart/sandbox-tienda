# Permisos MCP y resultados de workflows

Los servidores externos usan `trust_read_only_hints: false` por defecto. Un administrador puede habilitar **Confiar en las anotaciones de lectura** al editar el servidor. Solo una herramienta sin parámetro `action`, con `read_only_hint: true` y servidor confiable, pasa a lectura automática. Los permisos explícitos `auto`, `ask` y `prohibited` siguen teniendo prioridad; el perfil del agente también limita los workflows automáticos. Cambiar la URL invalida el catálogo descubierto.

La migración `Migration20260913090000AiAssistant` agrega el campo sin habilitar confianza en servidores existentes. Debe aplicarse antes de ejecutar esta versión. No modifica filas de permisos. Revertir la migración elimina únicamente el nuevo campo; los permisos del administrador permanecen.

Cada paso necesita un contrato de resultado. Receta y Campaña comercial tienen contratos incorporados, aplicados también a sus definiciones anteriores. Los workflows personalizados deben definir `result_contract` desde el editor o la API antes de ejecutarse; si falta, el motor se detiene antes de llamar al modelo. Un ejemplo:

```json
{
  "result_contract": {
    "ingredients": { "type": "strings", "minItems": 4 },
    "steps": { "type": "strings", "minItems": 3 },
    "source_urls": { "type": "strings", "minItems": 1 }
  }
}
```

Los tipos disponibles son `string` (no vacío), `strings` (lista de textos no vacíos) y `boolean`, que admite `equals`. Los campos son obligatorios. El modelo recibe el contrato junto con instrucciones para devolver un único `<result>{JSON}</result>`. Una pregunta, JSON inválido, varios resultados o datos incompletos producen un bloqueo:

```json
{
  "status": "blocked",
  "code": "permissions_blocked",
  "reason": "Bloqueado por permisos: la política requiere confirmación humana.",
  "missing_fields": []
}
```

El workflow queda en `needs_input`, conserva la causa en `state.__blocked` y no entrega ese bloqueo como datos al siguiente agente. Al reanudar conserva el input y los pasos paralelos ya completados, y vuelve a comprobar permisos. Los errores de ejecución quedan en `failed`. Solo un `on_error: "continue"` explícito permite seguir con un paso fallido, que permanece identificado en checklist y resumen.

Se conservan las alternativas existentes: investigación de receta basada en conocimiento general con `note: "sin búsqueda web"`, y promoción `highlight_only` sin ID. Una búsqueda efectivamente rechazada por permisos detiene el paso: el sistema no se concede autorización ni presenta esa búsqueda como realizada. Los contratos comprueban estructura y mínimos; no certifican por sí solos la veracidad de cada afirmación del modelo. La validación persistida del borrador y el enriquecimiento de banner/landing siguen aplicándose.

Los logs guardan herramienta, acción, modo, causa y resultado `permissions_blocked`. Los eventos de respuesta del modelo se distinguen del estado del paso validado; el log de una corrida indica **Turno finalizado**, sin equipararlo a tarea completada.

## Validación local

Desde `apps/backend`, con Node 24:

```powershell
node --experimental-test-module-mocks --experimental-transform-types --import ./test-register.mjs --test integration-tests/ai-workflow.test.ts
node --experimental-transform-types --import ./test-register.mjs --test src/modules/ai-assistant/ai/workflow-result.test.ts src/modules/ai-assistant/ai/policy.test.ts src/modules/ai-assistant/ai/run-events.test.ts
```

- 15 escenarios de integración con almacenamiento vacío, sin políticas adicionales: confianza ausente/deshabilitada/habilitada, permisos explícitos, perfil restringido, búsqueda rechazada, pregunta suelta, datos faltantes, alternativa declarada, contrato ausente y reanudación.
- 20 pruebas de contratos, políticas y proyección de eventos.
- Regresiones de los loops de chat/headless/WhatsApp y nombres del registry, ejecutadas con los mismos adaptadores de infraestructura simulados.
- Proyecto generado con `ai-assistant` y perfil sin la extensión, usando el composer con `allowDirty`, `skipInstall` y `noStart`. La integración también se ejecutó sobre los archivos del proyecto generado, sin `node_modules`, base de datos ni permisos heredados.
- Payload, hashes y migraciones verificados con `node packages/project-composer/src/verify-components.js ai-assistant`.

Estas pruebas usan modelo, persistencia y adaptadores de artefactos simulados; no prueban un proveedor MCP real ni el arranque completo de Medusa. No se aplicaron migraciones ni se desplegó. El typecheck global encuentra dependencias locales ausentes (incluido `@medusajs/core-flows`); el chequeo del Admin encuentra dos errores en `tool-permission-toggle.tsx`, fuera del diff. La sintaxis de los componentes modificados fue verificada; faltan pruebas visuales en ambos idiomas y temas. El composer tampoco copió `AGENTS.md` ni la skill guard a los proyectos generados; se registra como limitación de composición, fuera de esta corrección.

El nombre de la migración incluye el módulo para evitar colisiones globales. Si una instalación ya ejecutó el nombre anterior Migration20260913090000, la nueva ejecución es idempotente: ADD COLUMN IF NOT EXISTS conserva el campo y sus valores. No se modifica el historial de migraciones existente.
