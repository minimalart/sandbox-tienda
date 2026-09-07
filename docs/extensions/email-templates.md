<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Emails (SendGrid)

Las plantillas de los mails que manda la tienda, su marca y a quién le llegan los avisos internos.

## Sólo una plantilla PUBLICADA reemplaza a la del código

Cada mail que sale tiene una plantilla escrita en el código. Lo que se edita en esta extensión es un reemplazo opcional que vive en la base.

El reemplazo se busca por CLAVE, y tiene que coincidir exactamente con la del template de código. Una clave distinta no reemplaza nada: crea una plantilla que no se va a usar nunca, y desde el listado se ve igual de publicada que las demás.

Una plantilla en borrador tampoco reemplaza nada. Es el modo de trabajar una plantilla sin afectar a nadie, pero también es la forma más común de editar durante media hora y no ver ningún cambio en el mail que llega.

Si la consulta a la base falla, el mail sale igual con la plantilla del código. Degrada, no rompe.

## La plantilla de la tienda gana sobre la global

Una plantilla sin tienda es GLOBAL: la usan todas las tiendas que no tengan la suya. Una plantilla de la tienda pisa a la global para esa tienda y no toca a las demás.

La consecuencia práctica es que una plantilla creada sin tienda le cambia el texto a TODAS. Cuando el objetivo era personalizar una sola, hay que crearla con la tienda puesta.

## Sin clave de SendGrid los mails se escriben en la consola

El provider de notificaciones se registra SIEMPRE. Sin la clave de la API no falla al arrancar ni al enviar: escribe el mail en los logs del backend y da la operación por terminada.

Desde el admin todo se ve exactamente igual que si hubiera salido. Es la falla más difícil de detectar de esta extensión, y por eso conviene confirmarla con un envío de prueba y no con la pantalla.

La clave y el remitente son opciones de arranque del provider: se leen antes de que exista la base, así que no se pueden editar desde el admin y cambiarlas pide reiniciar. Un remitente por tienda además exige un remitente verificado por tienda en SendGrid, que es trabajo fuera del código.

## Los avisos internos tienen dos capas

El destinatario de las notificaciones internas —pedidos nuevos, alertas— se resuelve en dos pasos. Primero, el email de notificación cargado en la configuración de emails, que es POR TIENDA. Si no hay ninguno, el email de avisos de esta pantalla, que es el respaldo de toda la instalación.

Vacío en los dos lugares significa que no se manda ningún aviso interno. No hay error: los mails al cliente siguen saliendo normalmente y los internos simplemente no existen.

## Los IDs de plantilla de SendGrid son otra cosa

Los mails de invitación a una empresa y a una cuenta corporativa no usan las plantillas de esta extensión: usan plantillas DINÁMICAS de SendGrid, identificadas por un ID de la cuenta.

Si el ID no existe en la cuenta, SendGrid rechaza el envío y la invitación se crea igual. Desde el admin la invitación queda pendiente, como si la persona no la hubiera aceptado todavía, cuando en realidad nunca le llegó.

## Los iconos son imágenes hospedadas

Los clientes de correo no soportan SVG ni la mayoría del CSS, así que los iconos del timeline y del kit son PNG servidos desde una carpeta pública. La base se carga en esta pantalla, sin barra final.

Vacía, los mails se mandan igual, sin iconos. Es una degradación limpia y también la explicación de por qué un mail se ve pelado sin que nada haya fallado.

El logo del kit sale de otra variable, que pertenece a Media Library. Un proyecto instalado sin esa extensión no la va a tener configurada y el logo sale vacío: el template omite la imagen y el mail se manda igual.

## Cómo se escriben las plantillas

El contenido se escribe en HTML con Handlebars. Los valores entre llaves dobles se escapan como HTML, así que un dato inyectado no puede romper la maqueta; las llaves triples inyectan HTML de confianza a propósito.

Hay bucles y condicionales, que es lo que permite listar los ítems de un pedido en el mismo template.

Los datos de ejemplo se usan para la vista previa y el envío de prueba, y sólo para eso: no viajan a ningún mail real.

## La marca se cachea un minuto

El logo, los colores y el nombre del remitente que ve el cliente salen de la configuración de emails y son por tienda.

Ese branding se cachea por tienda durante un minuto. Un cambio de logo o de color puede tardar hasta ese minuto en verse en los mails que salen, y no es un guardado que falló.
