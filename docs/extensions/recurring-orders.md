<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Compras recurrentes

Suscripciones multiproducto con autogestión, reserva de stock y cobro automático de Mercado Pago, conservando el link manual como respaldo.

## Cómo es un ciclo, de punta a punta

El motor proyecta demanda a 14 y 30 días. A 24 horas del cobro arma la canasta completa, cierra una cotización inmutable y reserva inventario. Recién entonces sincroniza el importe con Mercado Pago. Los planes manuales siguen generando un link de pago por entrega.

La autorización queda pausada entre ciclos y sólo se reactiva después de persistir cotización y reserva. Mercado Pago no permite editar la frecuencia de un preapproval existente: cambiar frecuencia u omitir una entrega crea una autorización reemplazante y pide confirmación; la anterior se cancela recién cuando la nueva quedó autorizada.

Si pasa el tiempo del recordatorio sin que pague, se le manda UNO solo. Si pasa la vida del link, el ciclo expira y cuenta como falla.

Los rechazos automáticos pasan a past_due y se reintentan con backoff. Un webhook duplicado no duplica cobros ni pedidos: el ciclo tiene claves idempotentes y locks por contrato y renovación.

## Tres capas, y la de abajo es la que se edita acá

Las cards de esta pantalla son la capa de la INSTALACIÓN: el piso que hereda todo el que no tenga algo más específico.

Arriba de eso está la configuración por canal de venta, que se edita en esta misma pantalla con el selector de alcance. Cinco de los siete valores se pueden pisar ahí: reintentos por ciclo, horas entre reintentos, fallas seguidas antes de cortar, vida del link y horas hasta el recordatorio.

Los dos que NO se pisan por canal son el interruptor general y los ciclos por corrida. El interruptor por tienda existe, pero es otro: vive en la configuración de esa tienda. Los ciclos por corrida son el tope de trabajo de UNA pasada del cron, que es global por definición.

Un canal sin configuración propia hereda la predeterminada. Al guardar estando parado en ese canal se le crea una específica, y desde ese momento deja de heredar.

## Una tienda con B2B tiene dos canales

La configuración efectiva de un canal se busca en tres escalones: la fila de ese canal exacto, después la de CUALQUIER otro canal de la MISMA tienda, y al final la global.

El escalón del medio existe por el caso B2B: una tienda con mayorista tiene dos canales de venta, y sin ese escalón el canal mayorista no matcheaba su propia configuración y caía a la global en silencio.

## Los valores nuevos no reescriben los ciclos en vuelo

Un ciclo que ya está esperando pago conserva el vencimiento que tiene persistido. Cambiar la vida del link no lo acorta ni lo alarga: el valor nuevo rige para los ciclos que se generen de acá en adelante.

Es la falla más cara de esta extensión porque el guardado sale bien y parece aplicado. Si acortaste el vencimiento para destrabar una cola de links viejos, no va a pasar nada hasta el próximo ciclo de cada suscripción.

## Dos combinaciones que se anulan solas

El recordatorio por encima de la vida del link no llega NUNCA: el ciclo expira antes de que toque mandarlo. No hay error; simplemente no se manda.

Las horas entre reintentos por debajo de la frecuencia del cron no aceleran nada: el reintento igual espera a la corrida siguiente. El número más chico no compra nada.

Las fallas seguidas antes de cortar son ciclos fallados o expirados EN FILA, y la racha se resetea con un ciclo bueno. Es la diferencia entre acompañar a un cliente con una tarjeta vencida y seguir mandándole mails para siempre.

## Apagar el motor no cancela nada

Con el interruptor general apagado, el motor no ejecuta renovaciones, no manda recordatorios y no expira links. Las suscripciones quedan CONGELADAS donde estén; no se cancelan ni se pierden.

Se evalúa al principio de cada corrida del cron, así que apagarlo tiene efecto en la corrida siguiente sin reiniciar nada.

Lo que sí hay que reiniciar es la FRECUENCIA del cron. Los dos schedules —el de renovaciones y el de métricas— los hornea Medusa al arrancar y no se pueden reprogramar desde el admin. Para frenar el motor está el interruptor, no el cron.

## Elegibilidad, ofertas y retención

Por defecto cualquier producto del catálogo ofrece suscribirse. Con productos seleccionados, entran los que matcheen alguna categoría, etiqueta o producto elegido: es la UNIÓN de los tres criterios, no la intersección. Elegir "seleccionados" sin ningún criterio deja a la tienda sin ningún producto suscribible.

Los descuentos por frecuencia se aplican solos en cada renovación sobre los precios vigentes. Las ofertas por producto pisan esa base para productos puntuales.

El descuento de retención es lo que se le ofrece al cliente cuando va a cancelar, por sus próximas N entregas. Vacío significa no ofrecer nada.

## Qué pasa si falta stock o cambió el precio

En V2 el stock es todo o nada: si una línea no está disponible se pausa el cobro, se libera cualquier reserva parcial y se reintenta cada seis horas durante 72 horas. Si no se recupera, se omite ese ciclo sin mover la cadencia. Los planes heredados manuales conservan su política anterior.

Con cambios de precio también hay dos: usar el precio vigente sin avisar, o avisar cuando la suba supera un umbral. Las dos usan el precio actual; la diferencia es si el cliente se entera.

Las dos se pueden dejar en Heredar para que las resuelva la capa de abajo.

Ojo con lo que se ve en el detalle de una suscripción: esos precios son el SNAPSHOT del alta, no lo que se va a cobrar en la próxima renovación. Es la otra cara de "las dos usan el precio actual" — la pantalla muestra con qué se suscribió el cliente, el cobro sale de la lista de precios vigente el día que el cron arma el ciclo.

## Los números del tablero son de ayer, no de ahora

Las series históricas leen snapshots diarios por canal. GMV recurrente, LTV y recuperación de pagos se calculan además desde los ciclos reales, para poder conciliarlos con pagos y pedidos aunque el snapshot se atrase.

"Recalcular" re-computa el rango visible sin esperar al cron. Es la salida cuando hace falta el número de hoy, o cuando el job no corrió.

Es un job DISTINTO del de renovaciones, con su propio horario: que el tablero esté atrasado no dice nada sobre si las renovaciones se están procesando.

## Puesta en marcha

Los tres primeros pasos deciden si alguien puede llegar a suscribirse. Los que siguen deciden qué pasa cuando la renovación falla.

1. Aplicar migraciones y ejecutar subscriptions:v2:health.
2. Ejecutar subscriptions:v2:migrate en dry-run; revisar conteos y recién después usar migrate:apply.
3. Crear un plan con alcances, frecuencias, precio y términos; publicarlo sólo después de usar la vista previa.
4. Configurar BACKEND_URL HTTPS, credenciales y secreto de webhook de Mercado Pago por tienda.
5. Habilitar V2 y storefront; validar manual_link antes de activar cobro automático.
6. Probar autorización, reserva, webhook duplicado, rechazo, cancelación y reembolso en sandbox.
7. Activar por canal y avanzar 5%, 25%, 50% y 100% sólo con audit limpio.
