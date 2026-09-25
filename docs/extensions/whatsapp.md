<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# WhatsApp (Kapso)

Manda notificaciones por WhatsApp y atiende conversaciones a través de Kapso, con plantillas de Meta.

## Quién es quién

El número, las plantillas y su aprobación son de META. Kapso es el intermediario que expone ese número como API y hospeda la bandeja. Esta pantalla sólo guarda con qué cuenta de Kapso y con qué número se opera, y cómo se llaman las plantillas que Meta ya aprobó.

Nada de lo que se guarda acá crea ni aprueba una plantilla por sí solo: si Meta no la aprobó, el envío se rechaza aunque el nombre esté bien escrito.

Las credenciales se guardan cifradas y tienen efecto en el mensaje siguiente, sin reiniciar el backend.

## Sin ID de número no se envía nada, y no hay error

El identificador del número de teléfono de Meta es el que emite los mensajes. Sin él no sale ninguna notificación: todo queda logueado y la operación se da por terminada sin error visible.

Es la falla más difícil de detectar de esta extensión, porque desde el admin todo parece haber funcionado.

El identificador de la cuenta de WhatsApp Business hace falta SÓLO para crear y editar plantillas desde el admin. El envío de mensajes no lo usa, así que se puede operar sin él.

## El nombre de plantilla vacío es el interruptor de apagado

En el grupo de carritos y pedidos, dejar el nombre de una plantilla vacío NO es un campo sin completar: es la forma de apagar el WhatsApp de ese aviso. El email correspondiente se sigue mandando igual.

Es deliberado y aplica a los tres pasos de carrito abandonado y a los tres avisos de suscripciones. Si tuvieran un valor por defecto, la tienda empezaría a mandar plantillas que Meta nunca aprobó y todos esos mensajes se rechazarían.

Las plantillas de recuperación de carrito son de categoría promocional para Meta: son más caras que las transaccionales, requieren consentimiento y tienen límites de envío por usuario. Las de pedido y envío son transaccionales.

## El idioma tiene que coincidir exactamente

El código de idioma tiene que ser el mismo que el de la plantilla aprobada, carácter por carácter. Para Meta, "es" y "es_AR" son DOS plantillas distintas.

Un idioma que no coincide es la segunda causa de mensajes que no llegan, después del nombre mal escrito, y desde el admin las dos se ven igual.

## Apagar el bot, y despublicar el recorrido: son DOS palancas

Son distintas, y confundirlas deja el número contestando cuando se lo creía apagado.

**El bot contesta**, arriba de todo en Ajustes, apaga las RESPUESTAS del número: todo mensaje que entre se guarda y queda en la bandeja para que lo lleve una persona. No toca el recorrido publicado, que vuelve a atender en cuanto se prenda. Las notificaciones que dispara la tienda —confirmación de pedido, seguimiento, carrito abandonado— salen igual: ésas se apagan una por una en Plantillas.

Tampoco despierta conversaciones. Un recorrido puede tener pasos con plazo, y cuando el plazo vence el bot vuelve a escribir sin que el cliente haya dicho nada. Con el interruptor apagado eso no pasa, y el plazo queda como está: los recorridos en curso quedan PAUSADOS donde estaban y siguen en cuanto se prenda, no se cancelan.

**Despublicar el recorrido**, desde Recorridos o desde el editor, saca el grafo de encima del número pero NO apaga el bot: el turno vuelve al menú de siempre y al asistente, que siguen contestando. Sirve para volver al comportamiento anterior, no para conseguir silencio.

Para probar un recorrido sin que ningún cliente lo vea está Probar, dentro del editor: corre el mismo motor que atiende en producción, en el navegador y contra el grafo del canvas —guardado o no—, y consulta el catálogo de verdad para mostrar las tarjetas que saldrían. No manda un solo mensaje.

Despublicar deja una copia en borrador y conserva la versión en el historial. La que atendió clientes no se vuelve a editar nunca: la traza de esas conversaciones guarda su id, y pisarle el grafo la dejaría apuntando a un dibujo que nunca corrió.

## El catálogo que atiende el bot

El bot ofrece productos de los canales de venta que se le habiliten. Con varios canales busca en todos, pero un pedido pertenece a UNO solo: se usa el primero que tenga todos los productos del carrito.

La consecuencia es que un carrito armado con productos de dos canales distintos no se puede cerrar. Si el bot arma el carrito y después no puede confirmar el pedido, esto es lo primero que hay que mirar.

La región define moneda y precios de lo que arma el bot. Si no hay una fijada se deduce del país, y si esa deducción falla el bot no puede cotizar.

Meta rechaza el carrusel COMPLETO si no puede decodificar una sola imagen. Por eso hay una imagen de reemplazo: con ella, los productos sin foto usable entran igual; sin ella, el bot cae a la lista de texto.

## Cuando una persona toma la conversación

El bot no responde mientras una persona está atendiendo. Ese estado se llama handoff y no hace falta cerrarlo a mano.

Si nadie lo cierra, la conversación vuelve al bot sola pasadas las horas configuradas. Es una red de seguridad, no el camino normal: sirve para que una conversación olvidada no quede muda para siempre.

## La bandeja embebida

La bandeja se muestra dentro de un iframe del admin. La URL que se carga es un token de un solo propósito: la API key nunca viaja al navegador.

El paso que más se olvida es el de los orígenes permitidos. Sin el dominio del admin en esa lista el iframe no carga, y el síntoma es una bandeja en blanco sin ningún mensaje de error.

1. En el dashboard de Kapso, entrar a Project y después a Inbox Embeds, y crear un embed con alcance de proyecto.
2. En Allowed origins, agregar el dominio de este admin, con comodín si corresponde.
3. Copiar la URL del embed y pegarla en el campo de URL del inbox embebido.
4. Recargar esta pantalla.

## Webhooks

El secreto de firma valida el HMAC de cada evento entrante. Vacío, la firma NO se verifica y se acepta cualquier cosa que llegue a esa ruta: dejalo puesto en producción.

El token de verificación es otra cosa: es el desafío de alta estilo Meta. Sin él, Kapso no puede dar de alta la suscripción, así que el síntoma es que nunca llega ningún evento.

## Medición por tienda y del asesor

El número se resuelve por tienda a partir de las credenciales de tienda, y la tienda viaja en los datos de cada notificación. Las plantillas acompañan a la cuenta, no a la tienda.

El embudo del asesor se cuenta por SESIÓN, no por mensaje: lo que interesa es cuántas conversaciones llegaron a cada paso.

Cambiar el vocabulario del filtrado guiado obliga a re-sincronizar Typesense: los atributos por los que el asesor pregunta se derivan al indexar, así que hasta la próxima indexación el cambio no se ve.
