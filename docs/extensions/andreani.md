<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Andreani

Cotiza y despacha con Andreani: contratos por servicio, etiquetas y seguimiento.

## El entorno de la API es lo primero que hay que mirar

El valor por defecto es Prueba (QA), y no se cambió a propósito: moverlo mandaría de un día para el otro a facturar contra el contrato real a toda instalación de prueba, demo o integración que hoy no configura nada.

La contracara es que una instalación PRODUCTIVA que nunca tocó este campo está cotizando y despachando contra QA. Los envíos no existen para Andreani y las etiquetas no valen. No hay error en ningún lado: el envío sale bien, la orden se marca despachada, y el paquete no lo retira nadie.

Es un ajuste de la INSTALACIÓN: dos tiendas del mismo backend no pueden pegarle a entornos distintos. Antes de operar en serio, entrá acá y elegilo explícitamente.

## Si una opción de envío aparece en cero

Andreani cotiza CADA servicio bajo su propio contrato. Sin el contrato correspondiente, la tarifa de ese servicio no aparece en la respuesta y la opción sale gratuita en el checkout.

Los tres contratos por servicio —domicilio, sucursal y punto de tercero— se dejan vacíos para usar el contrato base. Si sólo una de las opciones cotiza en cero, ese campo es el primer sospechoso.

Estos tres se leían antes del entorno del proceso, sin pasar por las credenciales de tienda: todas las tiendas cotizaban con el contrato de una sola. Si venís de una instalación vieja, revisá que cada tienda tenga el suyo.

El contrato base no es una etiqueta: es un número. Poner ahí el nombre de un servicio lo descarta el validador y se cotiza en cero.

## El usuario también enciende la extensión

Además de ser la credencial, la PRESENCIA del usuario en el entorno al arrancar es lo que registra el carrier en Medusa.

Cargarlo sólo en esta pantalla alcanza para cambiar con qué cuenta se opera, pero no para encender Andreani en una instancia que arrancó sin la variable de entorno. Si la extensión no aparece como proveedor de envío, el problema es de arranque y no de esta pantalla.

## Credenciales por tienda

Lo que se carga acá es la capa de INSTANCIA. Las credenciales por tienda —usuario, contraseña, contrato y código de cliente— viven en el catálogo de credenciales por tienda, cifradas aparte, y GANAN sobre estos valores.

Si cambiaste una credencial acá y esa tienda sigue operando igual que antes, tiene su propia credencial cargada.

## Modo de prueba heredado

Hoy no cambia nada. Sólo elegía el host cuando el entorno de la API estaba vacío, y ese campo siempre tiene valor.

Queda porque forma parte de las opciones del proveedor y de la huella de credenciales, pero el interruptor que de verdad decide contra qué API se opera es el entorno de la API.

## Origen, remitente y bultos

La dirección de origen y el nombre del remitente que se cargan acá son un RELLENO campo por campo: la sucursal de stock de la orden tiene precedencia y estos valores sólo tapan los huecos que ella deja. No la reemplazan.

A diferencia de Correo, Andreani sí arma varias cajas por envío. El armador elige entre las cajas ACTIVAS que estén cargadas en la pantalla de cajas; si no hay ninguna, usa las predeterminadas. Es la palanca para que los bultos se parezcan a lo que la tienda realmente despacha.

El armador de bultos es estricto por defecto: un producto sin peso o sin medidas aborta la etiqueta. Completar las dimensiones faltantes es opt-in y deja salir el envío con valores por defecto, con el riesgo de que Andreani reliquide la diferencia después.

El peso por defecto es por UNIDAD, no por bulto: el armador multiplica por la cantidad y después acota cada bulto entre 0,1 y 30 kg.

## Puesta en marcha

El orden importa: el entorno decide contra qué API se hacen las pruebas de los pasos siguientes.

1. Confirmar que el usuario de Andreani está en el entorno del backend al arrancar. Sin eso el carrier no se registra.
2. Elegir el entorno de la API. El default es Prueba (QA); una instalación productiva tiene que pasarlo a Producción explícitamente.
3. Cargar usuario, contraseña y contrato base.
4. Cargar los contratos por servicio que el acuerdo tenga separados. Vacío significa contrato base.
5. Completar el remitente y la dirección de origen, que se usan cuando la sucursal de stock no los tiene.
6. Cotizar en el checkout y verificar que ninguna opción salga gratuita.
7. Generar una etiqueta de prueba y confirmar el número de seguimiento.

## Fulfillment y seguimiento

El fulfillment automático crea el fulfillment nativo de Medusa apenas la orden se paga, pero NO genera la etiqueta: eso sigue siendo a pedido desde el admin. Es por tienda, porque el flujo operativo de cada una puede ser distinto.

La sincronización de tracking corre en un job programado cuya frecuencia se hornea al arrancar. Lo que sí se configura acá es la ventana horaria, y es de la instalación: el job recorre las ejecuciones de todas las tiendas en una sola pasada, así que no puede respetar dos horarios distintos.
