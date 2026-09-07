<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Cuentas corporativas

Empresas que se registran desde el storefront y operan con su grupo de clientes y su lista mayorista.

## Automática significa sin nadie mirando

El modo de activación decide qué pasa cuando una empresa se registra sola desde el storefront. Manual la deja pendiente hasta que alguien la aprueba desde el listado de corporativos. Automática la deja operando al instante, con su grupo de clientes y su lista mayorista ya aplicados.

Automática sin un proceso de validación de CUIT detrás significa precios mayoristas para cualquiera que complete un formulario. No hay una segunda barrera después: la aprobación ES la barrera.

El valor por defecto es manual, y cualquier valor que no sea exactamente el de activación automática cae a manual. Es a propósito: un valor raro en el entorno falla del lado seguro.

## El modo todavía se resuelve por instancia

El ajuste está declarado por tienda, pero el código que lo lee lo hace por el camino sincrónico, que hoy consulta la fila global y nunca la de una tienda. En la práctica, el modo de activación es de toda la instalación.

Está declarado por tienda igual y a propósito: el consumidor es una ruta del storefront que sí sabe de qué tienda viene el registro, así que el día que se le pase esa información el descriptor ya está bien y no hay que migrar el scope de una fila viva.

Mientras tanto, una tienda secundaria que no tenga valor propio cae en manual, que es el lado conservador.

## Guardar el descuento no reprecia nada

Los dos parámetros de la lista mayorista no hacen absolutamente nada al guardarse. Son la configuración de un script de instalación que hay que correr a mano; hasta que se corra, los precios no se mueven.

Es la confusión número uno de esta pantalla, y por eso está separada en su propia card: el modo de activación cambia el comportamiento ahora mismo, y estos dos esperan a que alguien ejecute el comando.

1. Fijar el descuento y el título de la lista en esta pantalla y guardar.
2. Correr el script create-wholesale-price-list con medusa exec, desde el backend.
3. Verificar en Precios que la lista quedó creada y activa sobre los grupos mayoristas.

## El título es la clave de idempotencia

El script no reconoce la lista por su contenido sino por su TÍTULO: si ya existe una lista con ese título, no hace nada y termina bien.

Ahí está el gotcha caro. Cambiar el título y volver a correr el script no actualiza la lista vieja: crea una NUEVA en paralelo, con la anterior todavía activa. Quedan dos listas de override sobre los mismos grupos de clientes, y cuál gana no es algo que se decida desde esta pantalla.

Cambiar el descuento y volver a correr el script tampoco reprecia la lista existente, por el mismo motivo: el título no cambió, así que el script se considera ya aplicado.

## El descuento es una fracción

No es un porcentaje: 0.2 es 20 por ciento de descuento sobre el precio actual. Escribir 20 no es un descuento del 20 por ciento, está fuera de rango.

El tope es 0.9 y no 1 por una razón concreta: con 1 la lista mayorista queda a precio cero, el script no tiene forma de saber que fue un error de tipeo, crea la lista, la deja activa, y recién se descubre con la primera orden.

## Hay una sola lista para toda la instalación

La lista mayorista no es por tienda. El script crea UNA lista y la ata a todos los grupos de clientes mayoristas que encuentre, de cuentas corporativas y de empresas B2B, sin filtrar por tienda.

El modo de activación sí es una política de la tienda, y por eso están en cards distintas aunque sean tres campos en la misma pantalla.

## Quién puede hacer qué, y las reglas del carrito

Gestionan la empresa, sus miembros y sus reglas sólo el propietario y el administrador. Compran el propietario, el administrador y el comprador. El observador ve y no hace ninguna de las dos cosas.

Las reglas se evalúan contra el carrito: monto mínimo, monto máximo, métodos de envío permitidos y medios de pago permitidos. Una regla que no se cumple devuelve una violación con su mensaje, y el checkout no avanza.

El grupo de clientes nativo es OPCIONAL: sirve para precios y promociones. La fuente de verdad de la organización es la cuenta corporativa, no el grupo.
