<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Preferencias

Siete pestañas de preferencias: comercio, sucursales, tienda, IA, fiscal, mínimo de compra y acceso.

## Cada pestaña tiene su propio alcance

La franja de tienda va DENTRO de cada pestaña y no arriba de las siete, y no es una decisión de layout: las siete no están en el mismo estado. Una barra que promete por siete pantallas sólo puede decir la verdad si las siete se comportan igual, y no es el caso.

Comercio es de la INSTANCIA. Las demás son por tienda, y ahí el selector decide cuál se está editando.

Antes de cambiar algo, mirá el badge de la franja de esa pestaña. Un badge gris significa que lo de abajo NO pertenece a la tienda elegida, aunque el nombre de la tienda esté ahí arriba.

## Comercio no se puede separar por tienda

País, moneda e idioma son de la instancia porque un país pertenece a UNA sola región en Medusa. No existe "la región de Norte": si dos tiendas venden en Argentina, comparten región.

Por eso Comercio muestra al lado una card de sólo lectura con contra qué región, moneda y canales opera la tienda elegida. Lo que se aplique arriba le cambia la moneda a las tiendas de abajo, y hay derecho a ver cuáles antes de confirmar.

## Sucursales

Con el modo multi-sucursal prendido, la tienda resuelve la sucursal del cliente por su dirección y usa el canal, el stock y los medios de pago de esa sucursal. Apagado, la tienda funciona con un único canal, que es el comportamiento estándar.

El escáner de códigos se prende acá, y es lo único que usa el canal de venta presencial. Por eso el nombre de ese canal se configura en esta misma pestaña.

## El nombre del canal presencial no renombra nada

Guardarlo acá NO crea ni renombra ningún canal: el script de setup hay que correrlo igual, por línea de comandos. Lo que cambia es que el nombre deja de vivir en el historial de una terminal.

Y hay una consecuencia que muerde después: si lo editás DESPUÉS de haber corrido el script, la próxima corrida va a CREAR UN CANAL NUEVO en vez de actualizar el viejo, porque la búsqueda es por nombre exacto. Quedan dos canales presenciales y el escáner apunta a uno solo.

## IA: lo que se edita acá es el valor efectivo

La card de IA guarda en la base, por tienda. Las doce variables de entorno que aparecen abajo, en el bloque de sólo-entorno, NO son el valor efectivo: son la SEMILLA del default de esa card.

O sea que cambiar una de esas variables en el entorno no mueve nada en una tienda que ya guardó su configuración. Sirven para que una instalación nueva arranque con valores sensatos.

Seis de las doce las edita otra extensión, no ésta: los modelos y parámetros de chat los administra el Asistente IA, y el modelo de texto y sus reintentos, la extensión de Landings con IA. El bloque de abajo nombra al dueño de cada una, uno por uno.

La aprobación de las memorias auto-capturadas tiene la polaridad al revés de las otras: arranca en activa, y sólo un valor explícito la apaga. Es a propósito, para que una memoria capturada sola no entre como aprobada por descuido.

## Fiscal: el certificado de la instancia y el de cada tienda

Lo que se carga en esta pestaña —identidad fiscal, entorno de ARCA, certificado y clave privada— es de la INSTANCIA. Cada tienda puede cargar los suyos en Credenciales por tienda, y esos TIENEN PRIORIDAD.

Si cambiaste el certificado acá y una tienda sigue consultando con la identidad vieja, mirá si esa tienda tiene credenciales propias cargadas.

Los cuatro interruptores son independientes entre sí: consultar constancias, generar el PDF automáticamente, copiar los datos fiscales a la empresa consultada y mantener el historial. Apagar el historial deja sólo la versión vigente de cada constancia.

## El mínimo de compra es un historial, no un campo

Los cambios son sólo de alta: cada cambio crea un registro nuevo con su vigencia, y el histórico queda auditable. No se edita ni se borra el anterior.

El mínimo vigente es el que corresponde a la fecha de hoy, que no siempre es el último cargado: un registro con fecha futura no rige todavía, y uno con fecha de fin vencida ya no rige aunque sea el más reciente de la lista.

## Acceso: la página de contraseña, sitio por sitio

Mientras esté activa, el sitio no se puede navegar sin ingresar la contraseña. Es para una tienda que todavía no abrió al público.

Hay una fila por sitio: la tienda principal y cada tienda que ya esté lista. A diferencia del resto de las cards de esta pantalla, que guardan al togglear, acá hay texto libre, así que cada fila tiene su propio botón de guardar y manda el interruptor y la contraseña juntos.

La contraseña va entre 4 y 6 caracteres, sin espacios. Quien la acierta mantiene el acceso 24 horas. Los cambios pueden tardar hasta un minuto en verse en la tienda, por el cache de configuración: si probaste y todavía te pide la vieja, esperá antes de volver a tocarla.
