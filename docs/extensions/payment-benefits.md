<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Beneficios de pago

Catálogo de medios de pago y cuotas sin interés sincronizado de MercadoPago, más los beneficios cargados a mano.

## Qué trae el sync y qué no

El sync le pega a la API PÚBLICA de MercadoPago y trae dos cosas: el catálogo de medios de pago del comercio y el máximo de cuotas sin interés de cada uno.

Todo lo demás se carga a mano en la pestaña Beneficios: descuentos, reintegros, promociones bancarias, topes, días de la semana. MercadoPago no los expone, así que no hay nada que sincronizar.

Es la confusión más cara de esta extensión porque no falla: el sync termina bien, dice cuántos ítems trajo, y las promos del banco siguen sin aparecer. No es un error del sync; es que nunca estuvieron en su alcance.

## El token no se configura acá

El sync reutiliza el access token de MercadoPago del checkout. Esa credencial la posee la extensión MercadoPago, que es quien cobra con ella, y allá tampoco es editable desde el admin: es opción de arranque de los dos providers de pago y la resuelve una función síncrona que está en el camino del cobro.

O sea que el token no baja a la base por ningún lado. Se configura en el entorno del backend, junto con el resto de las credenciales de MercadoPago.

Sin ese token el botón de sincronizar no falla en silencio: devuelve un error que nombra la variable que falta.

## El sync se dispara a mano

No hay job programado: el catálogo se actualiza cuando alguien aprieta el botón. La línea de "última sincronización" dice cuándo fue la última y con qué resultado.

Las métricas de arriba cuentan beneficios, no medios de pago: total, activos, próximos a vencer y errores de sincronización. El contador de errores en rojo es la señal de que la última corrida no terminó bien.

## Beneficios sincronizados y beneficios manuales

Un beneficio traído por el sync tiene sus datos oficiales de sólo lectura: no se pueden editar porque la próxima corrida los pisaría. Lo que sí se edita es la capa de decisión propia: visibilidad, prioridad, canales de venta y notas.

Un beneficio cargado a mano es editable entero. Los dos conviven en la misma lista y en el mismo orden de prioridad.

## Los beneficios se pueden acotar por tienda

Cada beneficio declara a qué canales de venta aplica. Un beneficio sin canales declarados se ve en TODAS las tiendas, que es el default.

En multitienda eso significa que el estado por descuido es "visible en todas": si una promo es de una sola tienda, hay que decirlo explícitamente.

## Puesta en marcha

El primer paso no se hace en esta pantalla, y es el único que puede bloquear todo lo demás.

1. Verificar que el access token de MercadoPago esté cargado en el entorno del backend. Es el mismo que usa el checkout.
2. Apretar Sincronizar Mercado Pago y verificar que el catálogo de medios de pago se llene.
3. Revisar el máximo de cuotas sin interés de cada medio contra lo que tiene pactado el comercio.
4. Cargar a mano, en la pestaña Beneficios, los descuentos y promociones bancarias que el comercio tenga vigentes.
5. Acotar por canal de venta los beneficios que sean de una sola tienda. Sin canales declarados se ven en todas.
6. Revisar la lista de próximos a vencer cada tanto: un beneficio vencido deja de mostrarse sin avisar.
