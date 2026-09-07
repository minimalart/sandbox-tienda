# Credenciales centralizadas

`/app/settings/site-credentials` lista las integraciones instaladas y abre sus detalles en un drawer. El hash identifica la integración y permite entrar desde la subpágina **Credenciales** de cada extensión. `#globales`, `#openrouter` y `#embeddings` muestran los servicios compartidos de IA.

El estado indica la presencia de credenciales, no una verificación remota de acceso. Los secretos mantienen los mecanismos existentes de cifrado, redacción, reemplazo y eliminación. ARCA, Andreani, Correo Argentino y Kapso conservan sus cuentas por tienda; los ajustes de alcance `instance` se identifican como compartidos en el drawer.

`credential-presentation.ts` clasifica los campos que pertenecen a esta pantalla. Las tarjetas de configuración y la tabla avanzada excluyen esos campos. Las extensiones sin credenciales muestran esa condición, sin inventar una conexión. Los servicios externos tienen logos locales y las extensiones internas usan la marca Mercatto.

## Configuración en tiempo de ejecución

Los interruptores de suscripciones y de Checkout Pro/API se resuelven desde App Settings. Las credenciales de MercadoPago, SendGrid, Typesense y Vimeo también se leen en tiempo de ejecución. Desactivar un checkout impide nuevas sesiones; la conciliación de pagos de suscripciones ya procesados conserva su camino independiente.

Se conserva la precedencia existente: configuración persistida, entorno heredado y valor por defecto. No se borran variables de instalaciones existentes. Las variables de infraestructura y arranque, incluyendo los horarios cron, siguen en el entorno. Los bloques azules de variables exclusivas del entorno se retiraron de las tarjetas de extensión.

## Validación

Las pruebas cubren la clasificación de campos, los proveedores globales únicos, la precedencia de los interruptores y la resolución de cuentas. Las pruebas de navegador usan la pantalla real con respuestas simuladas; no validan credenciales externas. Después de modificar fuentes incluidas en Project Composer, regenerar y verificar sus payloads.
