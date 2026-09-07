# Retirar variables de entorno del backend

La presencia de un campo en el panel no demuestra que se pueda borrar su variable.
Primero hay que desplegar los consumidores que leen la base y guardar el valor.
En Ajustes de extensiones, el origen debe ser **De la instancia** o **De esta tienda**;
**Entorno** significa que la variable todavía aporta el valor.

## Migración explícita, sin copiar secretos a mano

Desde el backend del entorno que se quiere limpiar:

```sh
pnpm settings:migrate-env
pnpm settings:migrate-env -- extension:typesense
pnpm settings:migrate-env -- --apply extension:typesense
```

Sin --apply sólo informa nombres. Con --apply valida, guarda usando el mismo
cifrado y control de revisión del panel, y vuelve a consultar el origen guardado.
Sin namespace recorre todos los instalados. No elimina variables ni imprime valores.
Los valores inválidos frenan la escritura antes del primer namespace. Una falla de
base posterior puede dejar namespaces anteriores guardados: el comando es reejecutable.

Sólo copia variables presentes; no materializa defaults ni pisa valores existentes,
incluso si otro operador guarda entre la simulación y la escritura. Una clave
existente indescifrable también se conserva: hay que repararla desde Integraciones.
La copia es a la capa GLOBAL que reemplaza al antiguo entorno. No replica cuentas
entre tiendas secundarias. Las configuraciones propias de cada tienda se conservan.

Después de desplegar, migrar y verificar las funciones afectadas, retirar por grupos.
Reiniciar todas las réplicas y comprobar nuevamente: un proceso viejo conserva su env.
No usar APP_SETTINGS_DISABLE=true durante la migración; ese interruptor omite la base.

## Familias cubiertas por la interfaz y sus lectores

- Typesense: conexión, colecciones y API keys; los cron siguen en entorno.
- Mercado Pago: habilitación, cuenta, public key y webhook.
- Videos: cuenta Vimeo y opciones del módulo.
- SendGrid: API key y remitente. ADMIN_EMAIL también tiene campo; conservarlo si
  se usa en setup, herramientas externas o como último recurso de alertas.
- Andreani y Correo Argentino: ajustes operativos y cuentas. Los schedule de jobs
  y CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS siguen siendo de arranque/inicialización.
- WhatsApp/Kapso: cuenta y ajustes declarados en el panel.
- GA4, B2B, flota propia y Catalogador: ajustes declarados en el panel.
- Landings y Banners: OPENROUTER_API_KEY y OPENROUTER_SITE_URL usan el propietario
  compartido Asistente IA; OPENROUTER_MODEL y LANDING_AI_MAX_RETRIES usan Landings.
  Ambos plugins consultan el lector del host en cada llamada, incluyendo reintentos 0.
- Gift Cards: GIFT_CARD_EXPERIENCE_ENABLED y SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY son
  de INSTANCIA y el plugin consulta la base. El interruptor comercial por tienda
  sigue en gift_card_settings. Un valor antiguo guardado sólo por tienda para estos
  dos campos no gobierna la instancia: guardarlo en la capa global antes de retirar env.
- ARCA: usa la cuenta GLOBAL de Minimalart para consultar los CUITs de todas las empresas.
  Certificado, clave privada y CUIT titular se administran en Integraciones → Globales.
  Los registros antiguos por tienda se conservan, pero ya no intervienen ni se promueven
  automáticamente a cuenta global. Guardar la cuenta correcta de Minimalart antes de retirar env.
  No cambia las claves PATH del entorno.

Estas garantías requieren publicar/instalar las versiones actualizadas de los plugins
junto con el runtime y desplegar el backend. Editar sólo el código del host no actualiza
un plugin publicado en otra instalación.

## Conservar: tienen consumidores fuera de los ajustes del panel

| Variables                                                                                          | Consumidor                                                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DATABASE\_\*, REDIS_URL, DISABLE_REDIS, WORKFLOW_ENGINE_REDIS, NODE_ENV, PORT, LOG_LEVEL, CORS     | Infraestructura y arranque                                             |
| JWT_SECRET, COOKIE_SECRET, CREDENTIAL_ENCRYPTION_KEY, APP_SETTINGS_ENC_KEY, GIFT_CARD_TOKEN_SECRET | Cifrado y autenticación; conservar claves usadas por datos anteriores  |
| APP_SETTINGS_DISABLE, APP_SETTINGS_TTL_MS                                                          | Recuperación y cache de la propia configuración                        |
| S3\_\*                                                                                             | Registro del proveedor de archivos                                     |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL                                        | Inicio de sesión con Google                                            |
| SENTRY\_\*                                                                                         | Instrumentación de arranque                                            |
| STRIPE\_\*                                                                                         | Proveedor de pagos de arranque                                         |
| STOREFRONT_URL, BACKEND_URL, MEDUSA_BASE_URL y URLs equivalentes                                   | Enlaces, OAuth y consumidores directos                                 |
| MEDUSA_API_KEY, MEDUSA_AUTH_TYPE, MEDUSA_API_KEY_BASE64                                            | Dependencia mcp-medusa/lib/medusa-client.js                            |
| VITE_GOOGLE_MAPS_API_KEY                                                                           | Build del mapa del admin                                               |
| GOOGLE_MAPS_API_KEY en storefront                                                                  | Mapas y direcciones del storefront                                     |
| _\_CRON, _\_SYNC_SCHEDULE                                                                          | Programación de jobs al arrancar                                       |
| ARCA_CERTIFICATE_PATH, ARCA_PRIVATE_KEY_PATH                                                       | Archivos locales legacy, si se utilizan                                |
| GITHUB_TOKEN                                                                                       | Instalación/publicación de paquetes y automatización, según despliegue |

Guardar GOOGLE_MAPS_API_KEY en Delivery sólo reemplaza la lectura de geocoding del
backend. No publica esa credencial privada a los navegadores ni reemplaza las claves
de build. Las variables del storefront deben evaluarse en su propio entorno.

ADMIN_PASSWORD sólo se necesita para crear el usuario inicial mediante setup/composer;
se puede retirar de un backend ya inicializado si no vuelve a ejecutar ese bootstrap.

## Nombres obsoletos

Sin consumidores efectivos propios en el código revisado:
SMTP_HOST, SMTP_PORT, SMTP_SECURE, TYPESENSE_API_KEY_SET,
ANDREANI_CACHE_PROVIDER, ANDREANI_TRACKING_INTERVAL, VIMEO_REDIRECT_URI.
KAPSO_CONFIG_ID se pasa como option, pero el proveedor no la usa.

MEDUSA_PUBLISHABLE_API_KEY no reemplaza NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:
confirmar la clave correcta del storefront antes de retirar el nombre equivocado.
VIMEO_REDIRECT_URI tampoco configura el callback OAuth. El callback se construye
con BACKEND_URL; VIMEO_OAUTH_REDIRECT_SUCCESS es el destino después de conectarse.

**Corrección de la auditoría anterior:** MEDUSA_API_KEY_BASE64 sí se lee en la
DEPENDENCIA mcp-medusa. No es una variable muerta. Buscar sólo en apps y packages
sin revisar las dependencias produce falsos positivos.

## Verificación de una variable adicional

Buscar su nombre completo, aliases y accesos dinámicos en apps, plugins, scripts,
configuración de CI y dependencias del consumidor. Un nombre ausente en el código
propio no autoriza borrar credenciales del instalador o una dependencia.
La captura original tiene nombres truncados: no borrar por prefijo sin identificar
el nombre completo y su consumidor.

Vimeo, Typesense y SendGrid también se administran en Integraciones → Globales.
Sus namespaces y valores globales guardados se conservan; cambiar de tienda no cambia la cuenta.
