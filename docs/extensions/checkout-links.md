<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Links de Venta

Carritos pre-armados que se comparten por link: el cliente entra y cae en un checkout ya cargado.

## Qué viaja adentro de un link

Un link guarda todo lo que hace falta para armarle el carrito a alguien: las variantes con su cantidad, el país y la región que fijan la moneda, el canal de ventas, el email o el cliente, la dirección de envío y los códigos de promoción.

El token es opaco y corto. No se puede adivinar ni derivar de la orden: el único modo de llegar al carrito es tener el link.

## Las cuatro razones por las que un link deja de funcionar

Un link resuelve o no resuelve, y cuando no resuelve el storefront no recibe ninguna pista de por qué. Las causas son cuatro: fue deshabilitado, se venció, era de un solo uso y ya se usó, o el token no existe.

Desde el lado del cliente las cuatro se ven idénticas. En el listado del admin, en cambio, cada una tiene su estado: deshabilitado, vencido, usado y activo. Es el primer lugar para mirar cuando alguien dice que el link no anda.

El vencimiento se evalúa en el momento de resolver, no con un job: un link vencido no cambia de estado en la base, simplemente deja de abrir.

## El dominio del link sale del entorno, no de esta pantalla

El link público se arma pegando el origen del storefront configurado en el backend delante de la ruta del token. Si no hay ninguno configurado, el link queda RELATIVO: se copia una ruta sin dominio, y compartida por WhatsApp no lleva a ningún lado.

Ese origen es infraestructura de la instalación, no configuración de esta extensión. Lo comparten media docena de extensiones más y el alias que se usa de respaldo lleva el prefijo que Next hornea en el build del storefront: guardarlo en la base cambiaría el link que GENERA el backend y no el dominio que SIRVE la página, o sea que se podrían emitir links a un host que el storefront no conoce.

Se configura junto con el dominio, en el panel de deploy, y ahí se queda.

## Uso único

Un link normal se puede abrir tantas veces como haga falta y lleva la cuenta de cuántas órdenes salieron de él. Uno de un solo uso pasa a estado usado con la primera orden y deja de resolver.

La marca de uso ocurre cuando se CONFIRMA la orden, no cuando se abre el link: alguien puede abrirlo, abandonar el carrito y volver más tarde.
