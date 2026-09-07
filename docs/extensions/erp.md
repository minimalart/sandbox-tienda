<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# ERP

Integra un sistema de gestión externo: trae stock y catálogo a Medusa y le notifica cada venta cobrada.

## Tres flujos y una llave que los apaga a todos

El sync de STOCK va del ERP a Medusa: por cada SKU, la cantidad del ERP se escribe en la stock location que corresponda. El ERP es la fuente de verdad.

El sync de CATÁLOGO también va del ERP a Medusa, y trae precios, y opcionalmente categorías, marcas y campos del producto.

La notificación de VENTAS va al revés: cuando corresponde, se emite en el ERP el documento configurado. CUÁNDO corresponde se elige: al cobrarse el pedido, o al crearse el fulfillment.

Los tres cuelgan de la llave general de integración activa. Apagada, no se sincroniza nada y no se encola ninguna venta, aunque los tres interruptores de abajo estén prendidos.

## Cuándo se notifica la venta: al cobrar o al despachar

Son excluyentes: una venta se notifica UNA vez. Por defecto se notifica al cobrarse el pedido, que es el comportamiento de siempre.

La otra opción es notificar al crearse el fulfillment. Es para la operativa donde la mercadería vive repartida entre depósitos y hay que consolidarla a mano en el ERP antes de facturar: facturar al cobrar emitiría el comprobante desde un depósito que todavía no tiene el pedido completo. Con esta opción, el fulfillment ES la confirmación de que la transferencia ya ocurrió.

Elegirla obliga a designar un DEPÓSITO FACTURADOR, que sale del mapeo de depósitos. Desde ese momento el fulfillment sólo se puede crear desde la ubicación de ese depósito, y tiene que cubrir el pedido completo: el ERP emite una factura por pedido, y un despacho parcial la partiría en dos. Los dos rechazos son mensajes claros en el admin, no errores silenciosos.

El depósito facturador se puede cambiar para UN pedido desde su pantalla, sin tocar la configuración de la tienda. Se puede cambiar hasta que la venta se notifique: después, el comprobante ya salió con el anterior.

## El auto-fulfillment de un carrier NO factura

Esto es lo más importante de la opción anterior. Los carriers con auto-fulfillment prendido crean el fulfillment SOLOS, apenas se cobra, y sin elegir ubicación. Si eso disparara la facturación, el comprobante saldría a los segundos del checkout desde el depósito que el sistema eligiera — exactamente lo que esta opción existe para evitar.

Por eso sólo factura el fulfillment que crea una persona desde el admin y que pasó las validaciones de depósito y de pedido completo. Un fulfillment automático se despacha normal pero no emite comprobante, y queda anotado por qué.

La consecuencia práctica: si una tienda usa auto-fulfillment de carrier, esta opción no le sirve.

## El comprobante llega después, y por eso se pregunta varias veces

El ERP no devuelve el comprobante al recibir la venta: inserta el pedido y factura por su cuenta, que puede ser en un lote horas más tarde. Así que el comprobante se busca preguntando de nuevo, con espera creciente.

"Todavía no facturado" NO es un error, y tiene su propia paciencia: alrededor de un día de ventana, contra la hora que se le da a un envío fallido. Con la paciencia corta, una venta perfectamente sana terminaría marcada como fallida sólo porque el ERP factura por lote.

Cuando llega, se guardan los datos fiscales y el PDF, se le avisa al cliente por email con un link, y queda para descargar desde la pantalla del pedido y desde Mi cuenta. Si los datos llegan pero el PDF no, se guarda igual lo que hay: el número de comprobante ya no cambia, y el PDF se vuelve a pedir solo.

El PDF nunca se linkea directo. Se descarga a través del backend, que es quien tiene la credencial del ERP, y en la tienda sólo lo puede bajar el dueño del pedido.

## Después de facturar, el stock se vuelve a leer

Facturar es el momento en que el ERP descuenta de verdad, y si alguien consolidó la mercadería moviéndola entre depósitos, también cambió el reparto. Medusa no reproduce esos movimientos a propósito: vuelve a preguntar el stock de los artículos de ese pedido.

Es un refresco puntual, no una sincronización: si hay un sync completo corriendo, se saltea porque esa corrida va a leer los mismos artículos. Y si falla, no pasa nada grave — el sync de siempre lo arrastra.

## El outbox nunca bloquea el checkout

La venta no se manda al ERP durante el checkout. Se encola un evento y un job lo procesa aparte, así que un ERP caído no impide cobrar.

Cada evento pasa por estados visibles en Ventas: pendiente, procesando, enviada, fallida con reintento programado, dead letter cuando agotó los intentos, salteada por configuración y duplicada cuando el ERP responde que la venta ya existía.

Los errores no son todos iguales. Red y errores 5xx reintentan con espera creciente. Los de configuración o de datos —falta el tipo de documento, un SKU que no existe en el ERP, un ítem sin SKU— van a dead letter DIRECTO, sin gastar reintentos: no se arreglan solos, hay que corregir y reintentar a mano desde Ventas.

## El reintento después de un timeout puede duplicar el comprobante

Hay una notificación por orden y la clave es el pedido, así que el flujo es idempotente del lado de Medusa. Del lado del ERP depende del proveedor.

Zeus tiene idempotencia real: si el pedido ya existe responde 409 y el evento queda como duplicado, sin emitir nada nuevo.

Bsale y Contabilium no tienen clave idempotente. Si aceptan el documento pero la respuesta se pierde —un timeout justo ahí—, el reintento puede emitirlo DOS VECES. Ante timeouts repetidos conviene revisar Ventas y cotejar contra el ERP antes de reintentar a mano.

## El stock se matchea por SKU, y los SKUs del ERP son cortos

El sync de stock cruza el código del ERP contra el SKU de la variante de Medusa. Los códigos de un ERP suelen ser cortos y numéricos, del estilo 36 o 100.

En una instalación con varias tiendas eso no es un detalle: sin acotar el sync a canales de venta, puede pisarle el stock a un producto de OTRA tienda que casualmente comparte el SKU. No falla nada; aparece stock equivocado en un producto que nadie tocó.

Sin ningún canal tildado se sincroniza todo el catálogo, que es lo correcto en una instalación de una sola tienda y lo peligroso en las demás.

## El mapeo de depósitos NO es un multiselect

Con el mapeo cargado, cada depósito del ERP escribe SU cantidad en la stock location que le corresponde, y el total de Medusa sale de la suma de los niveles. Es lo que necesita un negocio con sucursales.

Sin mapeo se cae al comportamiento simple: el total del ERP en una sola location.

Lo que no hay que hacer es pensarlo como una lista de locations donde publicar el total: escribir el TOTAL en varias locations MULTIPLICA el stock, y el error se ve como sobreventa, no como un error de configuración.

## Delta, watermark y barrido completo

El sync de catálogo normal es un delta: pide lo que cambió desde la última corrida, con unos minutos de solapamiento para no perderse nada que haya cambiado justo en el borde.

El barrido completo pide el catálogo ENTERO y reescribe todo lo que encuentre desactualizado: pueden ser miles de títulos de una. Es lo que hay que correr después de cambiar las reglas de normalización o de prender una opción que afecta a todo el catálogo, y no algo para disparar de un clic distraído. Los títulos editados a mano no se tocan.

El tope de cambio por corrida es una red de seguridad: si un delta pretende modificar más de ese porcentaje del catálogo, la corrida ABORTA sin escribir nada. Protege contra un watermark mal calculado, que es la forma de reescribir un catálogo entero sin querer.

La simulación corre todo el flujo y no escribe: es la manera de mirar los precios propuestos antes de dejar que toquen la tienda.

## Lo que está apagado por defecto, lo está por algo

Crear productos que faltan: prendido sobre un catálogo vacío puede crear miles de borradores para revisar a mano.

Forzar el orden del ERP en categorías existentes: reordenar una categoría re-rankea a TODOS sus hermanos, incluidos los que se armaron a mano.

Los campos de producto que el ERP puede sobrescribir: apagados, el ERP sólo toca precios y stock. Prender el título corrige también los productos que ya existen, siempre con el título normalizado y nunca con el crudo del ERP.

La marca del ERP reemplazando a la del producto sí viene prendida, y también por algo: el ERP trae una marca por artículo, así que conservar la anterior dejaría el producto en dos marcas para siempre.

## Una lista de precios sin grupo de clientes nace en borrador

Cada lista del ERP se mapea a una price list de Medusa, que se crea si no existe, y a un grupo de clientes.

Sin grupo, la price list se crea como BORRADOR a propósito: activarla sin una regla que diga a quién aplica se la aplicaría a todos los clientes, o sea que la lista mayorista pasaría a ser el precio de la tienda.

Los precios del ERP llegan finales, con impuesto incluido, y se guardan tal cual. La opción de precios con impuesto incluido de cada proveedor es para el camino inverso, el de la venta: divide para mandar netos.

## Credenciales y validación

Las credenciales son de sólo escritura: se guardan cifradas y no se vuelven a mostrar. Dejar el campo vacío CONSERVA la guardada, no la borra.

Validar conexión prueba las credenciales tipeadas sin guardarlas. Es el primer paso de cualquier diagnóstico, porque distingue el problema de credenciales del problema de datos: si valida, lo que falla es el mapeo.

## Las frecuencias no se cambian desde el admin

Los tres horarios —stock, catálogo y outbox— son el schedule de sus jobs, y Medusa los hornea al arrancar el proceso, antes de que exista la base. Un campo acá sería un control que no hace nada.

Se cambian en el entorno y piden volver a desplegar. El del outbox es el latido de la extensión: bajarle la frecuencia retrasa TODO lo que el ERP tiene que recibir, no una parte.

Para apagar un flujo no hay que tocar el cron: están los interruptores de esta pantalla.

## Puesta en marcha

El orden importa: cada paso confirma algo que el siguiente da por hecho, y el catálogo es lo último a propósito.

1. Elegir proveedor y país, y cargar las credenciales que pide ese proveedor.
2. Validar conexión antes de prender nada.
3. Completar los IDs de la cuenta del proveedor (sucursal o depósito, tipo de documento, forma de pago), que son los que hacen falta para notificar ventas.
4. Elegir la stock location destino, o cargar el mapeo de depósitos si hay sucursales.
5. Acotar el sync de stock a los canales de venta de esta tienda si la instalación tiene más de una.
6. Prender la integración y sólo el sync de stock, y correr una sincronización manual.
7. Revisar en Logs el detalle por SKU: actualizados contra no encontrados dice si los códigos del ERP coinciden con los SKUs de Medusa.
8. Prender la notificación de ventas y hacer una compra de prueba cobrada; verificar en Ventas que el evento quedó enviado y con la referencia del ERP.
9. Recién ahí configurar el catálogo, correr una simulación y comparar los precios propuestos con los del ERP antes de prenderlo.
