<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Correo Argentino

Cotiza tarifas con MiCorreo y da de alta los envíos contra paqar, con seguimiento.

## Son dos APIs distintas, con credenciales distintas

Correo no expone un solo servicio. paqar es el que da de ALTA los envíos y se autentica con la API key. MiCorreo es el que COTIZA y se autentica con usuario, contraseña y Customer ID. Son cuentas separadas y se piden por separado.

La consecuencia práctica: sin usuario, contraseña y Customer ID de MiCorreo, todo envío degrada a cero y el checkout muestra "Gratuito". No hay error, no hay alerta y la tienda vende con el flete regalado hasta que alguien mira una orden. Es la falla más cara de esta extensión.

Y hay una tercera forma de terminar en "Gratuito" que no se arregla con credenciales: que MiCorreo autentique bien pero devuelva la cotización VACÍA porque la cuenta no está activada comercialmente. Ahí no hay nada que tocar en esta pantalla; hay que pedirle a Correo la activación del acuerdo.

El usuario de MiCorreo es por INTEGRADOR, no por comerciante: la identidad del comercio viaja toda en el Customer ID. Dos tiendas del mismo backend comparten usuario y se diferencian por Customer ID.

La API key de paqar tiene además un efecto de arranque: el módulo se registra como proveedor de envío únicamente cuando esa clave está seteada. Si Correo no aparece en la lista de proveedores, el problema es ese y no la configuración de las opciones de envío.

Los hosts también están separados a propósito. El caso real es operar en prueba y cotizar en producción, porque el sandbox de MiCorreo suele no responder.

## El número de acuerdo es lo más delicado de esta pantalla

El acuerdo comercial viaja como header en CADA request a paqar, queda estampado en el fulfillment y el número de seguimiento propio se deriva de él.

Una tienda despachando contra el acuerdo de otra le factura el flete a un CUIT ajeno, y una colisión de números de seguimiento dentro de un mismo acuerdo es IRRECUPERABLE. Por eso es un ajuste por tienda y por eso también se puede cargar como credencial de tienda: en multitienda, verificá que el selector de arriba esté en la tienda correcta antes de guardarlo.

## Qué es de la tienda y qué de la instalación

Casi todo Correo es del COMERCIANTE: el acuerdo, la dirección de despacho, el remitente, el tipo de servicio contratado. En multitienda cada tienda tiene el suyo y por eso son ajustes por tienda.

Lo que NO varía por tienda es a qué servidor se le pega (modo de prueba, los dos hosts, los dos paths base), qué unidad de peso usa el catálogo —que es uno solo para toda la instancia— y los techos físicos que impone la API. Esos son de la instalación.

Cinco credenciales viven además en el catálogo de credenciales por tienda, y ese valor GANA sobre lo que se cargue acá. No es duplicación: son dos sistemas de cifrado con dos claves distintas, a propósito. Si cambiaste un valor acá y no pasó nada, mirá si esa tienda tiene su propia credencial cargada.

## Modo de prueba

Apunta las dos APIs al entorno de test de Correo. Los envíos creados ahí NO existen para Correo: sirven para integrar, no para despachar.

Es un ajuste de la instalación, no de la tienda: no hay forma de que una tienda opere en prueba y otra en producción sobre el mismo backend.

## Correo no maneja cajas

La API de Correo toma sólo el PRIMER elemento de la lista de bultos, así que cada pedido viaja como un único bulto consolidado.

No hay nada que configurar acá al respecto, a diferencia de Andreani, que sí arma varias cajas por envío. Lo único que se declara es el bulto consolidado: su categoría de mercadería y, si el producto no trae medidas, las de reemplazo.

## Productos sin medidas

Por defecto, un producto sin peso o sin dimensiones ABORTA la cotización con un error que lista los ofensores. Es deliberado: inventar un bulto es cotizar mal.

Las medidas de reemplazo son opt-in. Prendidas, esos productos cotizan igual con los valores cargados abajo. Si son más chicas que el bulto real, la diferencia la factura Correo después. Es una decisión comercial, no técnica.

El coeficiente de aforo convierte volumen en peso facturable, así que tocarlo cambia lo que se le cobra al comprador. El valor por defecto es de comunidad: Correo no lo publica. Pedilo por escrito antes de moverlo.

## El número de seguimiento propio

Dejalo apagado hasta que Correo confirme POR ESCRITO el formato pactado.

Lo que compra es idempotencia: un alta que hace timeout se reconoce como duplicada en vez de crear un segundo envío y pagar flete doble. Lo que arriesga es que un formato no pactado sea rechazado, y que una colisión dentro del acuerdo no tenga vuelta atrás.

## Puesta en marcha

Los tres primeros pasos son los que deciden si la tienda cotiza. Los de origen son los que deciden si el alta del envío se acepta: paqar VALIDA la dirección de origen, y valida el código postal contra la provincia.

1. Cargar la API key de paqar. La planilla de Correo trae la celda con el prefijo "Apikey " ya puesto: pegala igual, el módulo lo saca.
2. Cargar el número de acuerdo de ESTA tienda.
3. Cargar usuario, contraseña y Customer ID de MiCorreo. Sin los tres no hay cotización.
4. Completar la dirección de origen entera: código postal, calle, altura, localidad y provincia.
5. Completar el remitente. El nombre por defecto no bloquea el alta, pero un envío real con ese nombre es un problema operativo.
6. Con el modo de prueba prendido, usar el botón de probar conexión: pega contra Correo de verdad, autenticando en paqar y pidiendo una cotización de sonda en MiCorreo.
7. Cotizar en el checkout y verificar que el precio no sea cero.
8. Dar de alta un envío de prueba y confirmar que devuelve número de seguimiento.
9. Recién ahí apagar el modo de prueba.

## Seguimiento

La sincronización de tracking corre en un job programado. Su frecuencia se hornea al arrancar y no se puede reprogramar desde acá; lo que sí se configura es la ventana horaria, que lo restringe a las 8 a 21 hora argentina.

La URL pública de seguimiento no es una API: es la página que se le manda al comprador. Si está mal, el síntoma es un link roto, no una falla de integración.
