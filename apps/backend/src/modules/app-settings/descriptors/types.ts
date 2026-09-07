/**
 * Descriptores de settings: el SIGNIFICADO de cada variable.
 *
 * La fila de `site_setting` guarda sólo valores. Todo lo demás — label, tipo,
 * validación, agrupación, si requiere reinicio — vive acá, en código.
 *
 * IMPORTANTE: este archivo y todos los `descriptors/*.ts` los importa TAMBIÉN el
 * bundle del admin (precedente: `admin/hooks/api/typesense.tsx:9` importa de
 * `modules/typesense/types`). Eso significa que tienen que ser DATOS PUROS:
 * sin `node:*`, sin DOM, sin `process.env` en scope de módulo, sin side effects.
 * A cambio, el backend y la UI comparten literalmente el mismo objeto — sin
 * formato de wire ni duplicación.
 */

export type SettingType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'url'
  | 'secret';

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HAY UN SOLO TIER, Y NO ES POR SIMPLICIDAD: ES QUE EL OTRO NO EXISTÍA.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `runtime` → lo lee `resolveSetting()` en cada uso: guardar tiene efecto ya.
 *
 * Hubo un `'boot'` que decía "lo consume `medusa-config.ts` antes de que exista la
 * DB; se muestra con el cartel de requiere reinicio". **Era mentira, y de la peor
 * clase: la que no falla.** `medusa-config.ts` NUNCA lee la base — se evalúa antes
 * de que haya contenedor y antes de que el loader llene el snapshot, así que
 * `getAndreaniBootOptions()` y `loadCorreoOptionsFromEnv()` resuelven `env →
 * default` y punto. Un descriptor `boot` renderizaba un input editable con un badge
 * naranja; el operador escribía, guardaba, reiniciaba… y el valor guardado seguía
 * sin aplicarse. Nunca. Sin un error, sin un log, sin nada a lo que agarrarse.
 *
 * Al momento de sacarlo NINGÚN descriptor lo usaba (los dos que se lo plantearon
 * —`media-library` y `videos`— dejaron escrito por qué no), así que la opción
 * honesta era eliminarlo y no maquillarlo: una alternativa que no funciona no
 * tiene que poder elegirse. Hoy declarar `tier: 'boot'` no compila, y eso es el
 * guard más barato que existe. `tier-boot.test.ts` lo respalda con un tripwire
 * sobre el fuente, para el día que alguien "arregle" el tipo sin leer esto.
 *
 * ─── Si algún día hace falta de verdad ───────────────────────────────────────
 *
 * Reintroducirlo NO es agregar el literal al union. Es, como mínimo:
 *
 *  1. Que `medusa-config.ts` LEA la base al arrancar. Hoy no puede: es sincrónico
 *     y corre antes del contenedor. Haría falta un read sincrónico contra Postgres
 *     (o un snapshot en disco escrito por el proceso anterior), con su propio plan
 *     para el arranque en frío, para el `predeploy` que sólo tiene `DATABASE_URL` y
 *     para la base que todavía no migró.
 *  2. Volver a cablear el diff de "hace falta reiniciar" (`isBootStale`,
 *     `restart_required`, `boot_stale`), que se eliminó junto con el tier porque
 *     con cero descriptores `boot` era código que sólo podía devolver `false`.
 *  3. Recién ahí, el badge.
 *
 * Mientras la lectura no exista, lo correcto para una variable de arranque es
 * `envOnly` en el namespace, con la razón escrita: la UI la muestra como lo que es
 * —algo que se cambia en el `.env`— en vez de fingir que se puede editar.
 */
export type SettingTier = 'runtime';

/**
 * Contra qué se resuelve el valor. Es ortogonal a `tier`.
 *
 * `site`     → puede variar por tienda. Vive en `site_setting` (o en
 *              `site_credential` si es secreto) y le aplica la precedencia de la
 *              decisión 3, **incluido el fail-closed**: una tienda secundaria
 *              que no configuró lo suyo queda APAGADA, no hereda la global.
 * `instance` → es de la instancia y nunca varía por tienda. La fila global es la
 *              única que existe.
 *
 * Elegir `site` para algo que en realidad es de instancia es el error caro: deja
 * a las tiendas secundarias sin valor por fail-closed, y el síntoma es una
 * extensión que "no anda en la tienda B" sin ningún error.
 */
export type SettingScope = 'site' | 'instance';

export type SettingDescriptor = {
  /** UPPER_SNAKE. Es la PK dentro del namespace. */
  key: string;
  /** Lo inyecta `defineSettings()` — nunca se escribe a mano. */
  namespace: string;
  /**
   * Env vars de las que hereda, en orden de precedencia. Casi siempre es
   * `[key]`; la lista existe para los alias reales del repo, como
   * `GA_MEASUREMENT_ID` / `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
   */
  env: string[];
  type: SettingType;
  tier: SettingTier;
  /** Lo inyecta `defineSettings()` desde `defaultScope` si no se declara acá. */
  scope: SettingScope;
  /** Agrupador visual dentro de la card. Ej. 'Conexión', 'Credenciales'. */
  group: string;
  /** es-AR literal: el repo hardcodea español en el admin. */
  label: string;
  help?: string;
  placeholder?: string;
  /** Sin valor efectivo la extensión no opera → badge rojo en la UI. */
  required?: boolean;
  /** Último eslabón de la precedencia: sólo si no hay fila ni env. */
  default?: unknown;
  /** `type: 'enum'` */
  options?: { value: string; label: string }[];
  /** `type: 'number'` */
  min?: number;
  max?: number;
  step?: number;
  /** `type: 'string' | 'url'` — source de una RegExp, no la RegExp. */
  pattern?: string;
  maxLength?: number;
  /**
   * Escape hatch PURO para formas que lo declarativo no cubre (el caso real es
   * `MERCADOPAGO_ACCOUNTS`). Devuelve `null` si está OK, o el mensaje de error.
   */
  refine?: (value: unknown) => string | null;
};

export type EnvOnlyEntry = {
  key: string;
  /** Por qué NO se gestiona desde la DB. Lo muestra la UI como ayuda. */
  reason: string;
};

export type SettingsNamespace = {
  /** `extension:typesense` — idéntico al `settings_namespace` del manifest. */
  namespace: string;
  /** Título para la UI central. */
  title: string;
  /**
   * Scope por defecto de los ajustes de este namespace. Casi siempre todos
   * comparten uno, así que declararlo por descriptor sería repetirlo N veces y
   * dejar que uno se desalinee sin que se note.
   */
  defaultScope: SettingScope;
  /**
   * Vars del `environment[]` del manifest que NO se gestionan desde la DB.
   * `manifest-drift.test.ts` exige que `environment[] === keys ∪ envOnly`, así
   * que dejar una var afuera obliga a justificarlo por escrito acá.
   */
  envOnly?: EnvOnlyEntry[];
  settings: SettingDescriptor[];
};

/**
 * Declara un namespace inyectando `namespace` en cada descriptor, para que no
 * haya forma de que un descriptor quede apuntando al namespace equivocado por
 * copiar y pegar.
 */
export function defineSettings(
  input: Omit<SettingsNamespace, 'settings'> & {
    settings: (Omit<SettingDescriptor, 'namespace' | 'scope'> & { scope?: SettingScope })[];
  },
): SettingsNamespace {
  return {
    ...input,
    settings: input.settings.map((s) => ({
      ...s,
      namespace: input.namespace,
      scope: s.scope ?? input.defaultScope,
    })),
  };
}
