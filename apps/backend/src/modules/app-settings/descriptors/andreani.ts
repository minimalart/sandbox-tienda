import { defineSettings } from './types';

/**
 * Ajustes de Andreani.
 *
 * El manifest declaraba 7 variables (`USERNAME`, `PASSWORD`, `CONTRACT`,
 * `CLIENT_CODE`, `HOSTNAME`, `TEST_MODE`, `ORIGIN_POSTAL_CODE`) y el código usa
 * 27. Andreani no tenía `_env-report.ts` ni guard, así que la deriva venía
 * creciendo sin nada que la frenara: los cinco `SENDER_*`, cuatro de los cinco
 * `ORIGIN_*`, los cinco `DIMENSION_FALLBACK_*`, los tres `*_CONTRACT_OVERRIDE`,
 * `AUTO_FULFILL` y los dos `TRACKING_*` nunca se le pidieron a nadie al instalar.
 *
 * TRES DECISIONES QUE NO SON OBVIAS, y que hay que respetar al editar esto:
 *
 * 1. Los cuatro de "Credenciales" son `tier: 'runtime'` aunque `medusa-config.ts`
 *    los use en el ARRANQUE — para armar las `options` del provider y, sobre todo,
 *    para DECIDIR SI SE REGISTRA (`medusa-config.ts:455` gatea por
 *    `ANDREANI_USERNAME`). Mismo criterio que los cuatro `KAPSO_*` de conexión:
 *    el provider ya no los lee de sus options, los resuelve en cada cotización y
 *    en cada despacho con `andreani-fulfillment/settings.ts`, que lee
 *    `site_setting` por `PG_CONNECTION`. Lo que sigue siendo de boot es EL GATE:
 *    si `ANDREANI_USERNAME` no está en el entorno al arrancar, el provider no
 *    existe y ningún valor en base lo va a hacer aparecer. Por eso la env var
 *    sigue haciendo falta aunque el valor efectivo salga de la base.
 *
 * 2. Las credenciales POR TIENDA no viven acá: viven en `site_credential`
 *    (integración `andreani`, claves `username`/`password`/`contract`/
 *    `clientCode`), cifradas con `lib/multistore/credentials.ts`. Estos cuatro
 *    descriptores son la capa de INSTANCIA — lo que hoy es el `.env` — y la card
 *    del admin. Las dos capas se combinan en
 *    `andreani-fulfillment/env-options.ts:applyAndreaniSiteCredentials`, con la
 *    de tienda ganando. Son dos sistemas con dos claves de cifrado distintas a
 *    propósito; ver la nota de `app-settings/resolve.ts:44-49`.
 *
 * 3. **`ANDREANI_HOSTNAME` es un `enum` de dos opciones, y su default sigue siendo
 *    QA.** Las dos mitades de esa frase son decisiones, no descuidos.
 *
 *    El problema: el default es `apisqa.andreani.com` —el entorno de PRUEBA de
 *    Andreani— y viene heredado del loader viejo
 *    (`process.env.ANDREANI_HOSTNAME || 'apisqa.andreani.com'`). Como el hostname
 *    siempre llega con valor, la rama `testMode ? qa : prod` de
 *    `normalizeAndreaniOptions` no se alcanza nunca: una instalación PRODUCTIVA que
 *    no setea nada cotiza y despacha contra QA, y las etiquetas que emite no valen.
 *    El envío "sale bien", nadie ve un error, y el paquete no lo retira nadie.
 *
 *    Por qué NO se cambió el default a producción: hay instalaciones vivas —las de
 *    prueba, las demos, los entornos de integración— que dependen del default
 *    actual y no tienen la variable seteada. Moverlo las mandaría de un día para el
 *    otro a facturar contra el contrato real sin que nadie tocara nada. Un cambio
 *    silencioso de "a dónde le pego" en las dos direcciones es igual de malo; la
 *    diferencia es que en esta dirección lo paga el cliente.
 *
 *    Qué se hizo en cambio: el campo dejó de ser texto libre y pasó a ser un
 *    `enum` con las dos opciones ETIQUETADAS sin ambigüedad ("Prueba (QA)" y
 *    "Producción"). El operador ya no tiene que saber que `apisqa` significa QA:
 *    lo lee, y la card le muestra cuál está activa y de qué capa sale. La elección
 *    pasa a ser explícita en vez de emergente de un default invisible. Y para el
 *    caso en que nadie mire la pantalla, `getAndreaniBootOptions()` loguea un
 *    warning al arrancar si `NODE_ENV=production` y el host resuelto es el de QA.
 *
 *    Lo que se pierde: no se puede apuntar a un host arbitrario DESDE LA CARD. No
 *    hay caso de uso documentado (a diferencia de Correo, que sí soporta un proxy
 *    propio) y el escape hatch sigue existiendo — `coerceFromEnv` NO valida contra
 *    las opciones, así que un `ANDREANI_HOSTNAME` con cualquier valor en el entorno
 *    se sigue respetando tal cual. Lo que se restringe es lo que se puede GUARDAR.
 *
 *    El default está también en `andreani-fulfillment/env-options.ts:ANDREANI_DEFAULTS`
 *    y `descriptor.test.ts` cruza los dos.
 */
export default defineSettings({
  namespace: 'extension:andreani',
  /**
   * Casi todo Andreani es por tienda: el contrato define la TARIFA y la cuenta
   * define a quién se le factura el envío. Las cuatro excepciones —hostname, modo
   * test y las dos del job de tracking— son de la instancia y lo declaran una por
   * una con `scope: 'instance'`.
   */
  defaultScope: 'site',
  title: 'Andreani',
  envOnly: [
    {
      key: 'ANDREANI_TRACKING_SYNC_SCHEDULE',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. Para acotar cuándo corre usá "Sincronizar sólo en horario hábil".',
    },
  ],
  settings: [
    // ─── Credenciales ────────────────────────────────────────────────────────
    // Capa de INSTANCIA. La de tienda vive en `site_credential` — ver la nota 2.
    {
      key: 'ANDREANI_USERNAME',
      env: ['ANDREANI_USERNAME'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Usuario',
      help: 'Usuario de la API de Andreani. OJO: además de ser la credencial, su PRESENCIA EN EL ENTORNO al arrancar es lo que registra el carrier (medusa-config.ts:455). Cargarlo sólo acá alcanza para cambiar con qué cuenta se opera, pero no para encender la extensión en una instancia que arrancó sin él.',
      maxLength: 128,
      required: true,
    },
    {
      key: 'ANDREANI_PASSWORD',
      env: ['ANDREANI_PASSWORD'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Contraseña',
      help: 'Se usa para el Basic auth de `GET /login`, que devuelve un token de ~24 h. Nunca se muestra: sólo se puede reemplazar o borrar.',
      required: true,
    },
    {
      key: 'ANDREANI_CONTRACT',
      env: ['ANDREANI_CONTRACT'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Contrato base',
      help: 'El número de contrato con el que se cotiza y se despacha cuando el servicio no tiene contrato propio. No es una etiqueta: poner "Domicilio" acá lo descarta el validador y se cotiza en cero.',
      maxLength: 64,
      required: true,
    },
    {
      key: 'ANDREANI_CLIENT_CODE',
      env: ['ANDREANI_CLIENT_CODE'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Código de cliente',
      help: 'Opcional. Viaja como `cliente` en el alta del envío; algunos contratos lo exigen y otros lo ignoran.',
      maxLength: 64,
    },

    // ─── Conexión ────────────────────────────────────────────────────────────
    {
      key: 'ANDREANI_HOSTNAME',
      env: ['ANDREANI_HOSTNAME'],
      // `enum` y no `string`: con texto libre, el default `apisqa…` era la única
      // pista de que la instalación le estaba pegando a QA, y había que saber qué
      // significa "apisqa" para darse cuenta. Ver la nota 3 del encabezado.
      type: 'enum',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Entorno de la API',
      help: '⚠️ Con "Prueba (QA)" los envíos NO existen para Andreani y las etiquetas no valen: sirven para integrar, no para despachar. Es de la INSTANCIA — dos tiendas del mismo backend no le pegan a entornos distintos.',
      options: [
        { value: 'apisqa.andreani.com', label: 'Prueba (QA) — envíos de mentira' },
        { value: 'apis.andreani.com', label: 'Producción — envíos reales, se facturan' },
      ],
      // Sigue siendo QA, y a propósito: cambiarlo mandaría a producción, sin que
      // nadie tocara nada, a toda instalación de prueba que hoy no setea la
      // variable. Ver la nota 3 antes de moverlo.
      default: 'apisqa.andreani.com',
    },
    {
      key: 'ANDREANI_TEST_MODE',
      env: ['ANDREANI_TEST_MODE'],
      type: 'boolean',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Modo de prueba (heredado)',
      // Honestidad sobre el efecto real: `normalizeAndreaniOptions` sólo lo mira
      // para elegir el host por defecto cuando el host llega VACÍO, y con un enum
      // que siempre tiene default eso no pasa nunca. Queda porque forma parte de
      // las options del provider y de la huella de credenciales; el interruptor
      // que de verdad decide contra qué API se opera es "Entorno de la API".
      help: 'Hoy NO cambia nada: sólo elegía el host cuando "Entorno de la API" estaba vacío, y ese campo siempre tiene valor. Para cambiar de entorno usá "Entorno de la API".',
      default: false,
    },

    // ─── Contratos por servicio ──────────────────────────────────────────────
    // Andreani cotiza CADA servicio bajo su propio contrato: sin el override, la
    // tarifa de Domicilio no aparece en la respuesta y la opción sale "Gratuito"
    // (`service.ts:218-225`). Antes de esta migración los tres se leían de
    // `process.env` DENTRO del provider, sin pasar por las options — o sea que
    // eran inmunes a las credenciales por tienda: una tienda con contrato propio
    // seguía cotizando con el override de la instancia.
    {
      key: 'ANDREANI_DOMICILIO_CONTRACT_OVERRIDE',
      env: ['ANDREANI_DOMICILIO_CONTRACT_OVERRIDE'],
      type: 'string',
      tier: 'runtime',
      group: 'Contratos por servicio',
      label: 'Contrato de Domicilio',
      help: 'Vacío = se usa el contrato base. Si la opción de domicilio aparece en $0, este campo es el primer sospechoso.',
      maxLength: 64,
    },
    {
      key: 'ANDREANI_SUCURSAL_CONTRACT_OVERRIDE',
      env: ['ANDREANI_SUCURSAL_CONTRACT_OVERRIDE'],
      type: 'string',
      tier: 'runtime',
      group: 'Contratos por servicio',
      label: 'Contrato de Sucursal',
      help: 'Vacío = se usa el contrato base.',
      maxLength: 64,
    },
    {
      key: 'ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE',
      env: ['ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE'],
      type: 'string',
      tier: 'runtime',
      group: 'Contratos por servicio',
      label: 'Contrato de Punto de Tercero',
      help: 'Vacío = se usa el contrato base.',
      maxLength: 64,
    },

    // ─── Remitente ───────────────────────────────────────────────────────────
    {
      key: 'ANDREANI_SENDER_NAME',
      env: ['ANDREANI_SENDER_NAME'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Nombre del remitente',
      help: 'Lo pisa el nombre de la sucursal de stock cuando la orden tiene una con `company` cargada (`andreani-generate-tickets.ts:590`).',
      placeholder: 'Mi Tienda S.A.',
      default: 'Remitente',
      maxLength: 128,
    },
    {
      key: 'ANDREANI_SENDER_EMAIL',
      env: ['ANDREANI_SENDER_EMAIL'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Email del remitente',
      help: 'Adonde Andreani manda las novedades del envío del lado del que despacha.',
      placeholder: 'envios@mi-tienda.com',
      pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      maxLength: 128,
    },
    {
      key: 'ANDREANI_SENDER_PHONE',
      env: ['ANDREANI_SENDER_PHONE'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Teléfono del remitente',
      placeholder: '1122334455',
      maxLength: 32,
    },
    {
      key: 'ANDREANI_SENDER_DOC_TYPE',
      env: ['ANDREANI_SENDER_DOC_TYPE'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Tipo de documento del remitente',
      help: 'Como lo espera Andreani: `DNI`, `CUIT`, `CUIL`. No se valida contra una lista fija porque el catálogo lo define el contrato.',
      placeholder: 'CUIT',
      maxLength: 16,
    },
    {
      key: 'ANDREANI_SENDER_DOC_NUMBER',
      env: ['ANDREANI_SENDER_DOC_NUMBER'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Número de documento del remitente',
      help: 'Sólo dígitos, sin guiones.',
      placeholder: '30123456789',
      pattern: '^[0-9]{7,13}$',
      maxLength: 13,
    },

    // ─── Origen ──────────────────────────────────────────────────────────────
    // Fallback por CAMPO: la dirección de la sucursal de stock de la orden tiene
    // precedencia campo por campo (`andreani-generate-tickets.ts:582-589`). Estos
    // valores tapan los huecos, no la reemplazan.
    {
      key: 'ANDREANI_ORIGIN_POSTAL_CODE',
      env: ['ANDREANI_ORIGIN_POSTAL_CODE'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Código postal de origen',
      help: 'Se usa cuando la sucursal de stock de la orden no tiene dirección cargada.',
      placeholder: '1414',
      pattern: '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$',
      maxLength: 8,
    },
    {
      key: 'ANDREANI_ORIGIN_STREET',
      env: ['ANDREANI_ORIGIN_STREET'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Calle de origen',
      maxLength: 128,
    },
    {
      key: 'ANDREANI_ORIGIN_NUMBER',
      env: ['ANDREANI_ORIGIN_NUMBER'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Altura de origen',
      placeholder: '1234',
      maxLength: 16,
    },
    {
      key: 'ANDREANI_ORIGIN_CITY',
      env: ['ANDREANI_ORIGIN_CITY'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Localidad de origen',
      maxLength: 128,
    },
    {
      key: 'ANDREANI_ORIGIN_PROVINCE',
      env: ['ANDREANI_ORIGIN_PROVINCE'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Provincia de origen',
      maxLength: 128,
    },

    // ─── Bultos ──────────────────────────────────────────────────────────────
    {
      key: 'ANDREANI_DIMENSION_FALLBACK_ENABLED',
      env: ['ANDREANI_DIMENSION_FALLBACK_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Bultos',
      label: 'Completar dimensiones faltantes',
      help: 'Apagado, el armador de bultos es ESTRICTO: un producto sin peso o sin medidas aborta la etiqueta. Prendido, usa los valores de abajo y el envío sale igual — con el riesgo de que Andreani reliquide la diferencia.',
      default: false,
    },
    {
      key: 'ANDREANI_DIMENSION_FALLBACK_LENGTH',
      env: ['ANDREANI_DIMENSION_FALLBACK_LENGTH'],
      type: 'number',
      tier: 'runtime',
      group: 'Bultos',
      label: 'Largo por defecto (cm)',
      min: 1,
      max: 300,
      step: 1,
      default: 30,
    },
    {
      key: 'ANDREANI_DIMENSION_FALLBACK_WIDTH',
      env: ['ANDREANI_DIMENSION_FALLBACK_WIDTH'],
      type: 'number',
      tier: 'runtime',
      group: 'Bultos',
      label: 'Ancho por defecto (cm)',
      min: 1,
      max: 300,
      step: 1,
      default: 20,
    },
    {
      key: 'ANDREANI_DIMENSION_FALLBACK_HEIGHT',
      env: ['ANDREANI_DIMENSION_FALLBACK_HEIGHT'],
      type: 'number',
      tier: 'runtime',
      group: 'Bultos',
      label: 'Alto por defecto (cm)',
      min: 1,
      max: 300,
      step: 1,
      default: 15,
    },
    {
      key: 'ANDREANI_DIMENSION_FALLBACK_WEIGHT',
      env: ['ANDREANI_DIMENSION_FALLBACK_WEIGHT'],
      type: 'number',
      tier: 'runtime',
      group: 'Bultos',
      label: 'Peso por defecto (kg por unidad)',
      help: 'Por UNIDAD, no por bulto. El armador multiplica por la cantidad y después clampea cada bulto entre 0,1 y 30 kg.',
      min: 0.01,
      max: 30,
      step: 0.1,
      default: 0.5,
    },

    // ─── Operación ───────────────────────────────────────────────────────────
    {
      key: 'ANDREANI_AUTO_FULFILL',
      env: ['ANDREANI_AUTO_FULFILL'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Fulfillment automático al pagar',
      help: 'Crea el fulfillment nativo de Medusa apenas la orden se paga. NO genera la etiqueta: eso sigue siendo on-demand desde el admin. Es por tienda porque el flujo operativo de cada una puede ser distinto.',
      default: false,
    },
    {
      key: 'ANDREANI_TRACKING_BUSINESS_HOURS_ONLY',
      env: ['ANDREANI_TRACKING_BUSINESS_HOURS_ONLY'],
      type: 'boolean',
      tier: 'runtime',
      scope: 'instance',
      group: 'Operación',
      label: 'Sincronizar sólo en horario hábil',
      help: 'Limita el job de tracking a 8–21 hora argentina. Es de la INSTANCIA: el job recorre las ejecuciones de todas las tiendas en una sola pasada, así que no hay forma de que respete dos horarios distintos.',
      default: false,
    },
  ],
});
