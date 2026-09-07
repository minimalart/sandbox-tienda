# WhatsApp Flow de devoluciones (scaffold — gated)

Este documento deja lista la base para ofrecer la devolución como **WhatsApp Flow**
(formulario nativo multi-pantalla), como alternativa al flujo conversacional que ya
funciona (tools `wa_start_return` / `wa_request_return`).

> **Requisito bloqueante:** los WhatsApp Flows requieren un **Meta Business Portfolio
> verificado**. El número actual es de test ("Kapso Test Minimalart"), así que el Flow
> **no** está activo. Verificá la empresa antes de publicarlo. Hasta entonces, la
> devolución por WhatsApp usa el modo conversacional (ya operativo).

## Cómo encaja

1. El agente detecta intención de devolver → en vez de `wa_start_return`, **lanza el
   Flow** (mensaje interactivo `type: "flow"` vía `KapsoClient.sendMessage`).
2. El cliente completa las pantallas (elegir ítem → cantidad → motivo → confirmar).
3. Al enviar, WhatsApp manda al webhook un `interactive.nfm_reply.response_json`
   (el schema del webhook YA lo parsea — ver `lib/whatsapp/kapso-inbound.ts`).
4. Un handler nuevo en el webhook mapea ese `response_json` →
   `createOrderReturn(container, { order_id, items, return_shipping_option_id, note })`
   (`lib/returns/create-return.ts`, el MISMO helper del modo conversacional).

**Integración pendiente (cuando haya verificación):**
- Publicar el Flow en Kapso/Meta (dashboard o API de flows) y obtener su `flow_id`.
- Para datos dinámicos (los ítems reales del pedido) el Flow necesita `data_exchange`
  contra un endpoint del backend (patrón del proyecto llorente); un Flow **estático**
  alcanza para un intake simple (nº de pedido + ítem + motivo) pero no valida contra el
  pedido real.
- Agregar en `api/webhooks/kapso/route.ts` la rama que, si el `nfm_reply` corresponde al
  flow de devolución, llama `createOrderReturn`.

## Starter Flow JSON (estático, intake simple)

Punto de partida para publicar. Reemplazar/ampliar con `data_exchange` para selección
dinámica de ítems del pedido.

```json
{
  "version": "6.0",
  "screens": [
    {
      "id": "RETURN_INTAKE",
      "title": "Solicitar devolución",
      "terminal": true,
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "order_number",
            "label": "Número de pedido",
            "input-type": "number",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "item",
            "label": "Producto a devolver",
            "required": true
          },
          {
            "type": "Dropdown",
            "name": "reason",
            "label": "Motivo",
            "required": true,
            "data-source": [
              { "id": "changed_mind", "title": "Cambié de opinión" },
              { "id": "wrong_size", "title": "Talle/medida equivocada" },
              { "id": "damaged", "title": "Llegó dañado" },
              { "id": "defective", "title": "Producto defectuoso" },
              { "id": "not_as_expected", "title": "No era lo que esperaba" }
            ]
          },
          {
            "type": "TextArea",
            "name": "note",
            "label": "Comentario (opcional)",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Enviar solicitud",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "order_number": "${form.order_number}",
                "item": "${form.item}",
                "reason": "${form.reason}",
                "note": "${form.note}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

> El JSON exacto y su versión dependen de lo que acepte Kapso/Meta al publicar; ajustar
> según el validador del dashboard. Para una experiencia real (elegir el ítem exacto del
> pedido), migrar a un Flow **dinámico** con `data_exchange`.
