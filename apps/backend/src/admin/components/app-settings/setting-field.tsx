import { Badge, Button, Input, Select, Switch, Text, Textarea, clx } from '@medusajs/ui';
import type { SettingDescriptor } from '../../../modules/app-settings/descriptors';
import type { AppSettingState } from '../../hooks/api/app-settings';
import { SettingLabel, isLongHelp } from '../common/setting-label';

/**
 * Render de UN ajuste. Lo comparten la card por extensión y el drawer del
 * buscador central: un solo renderer, un solo set de comportamientos por tipo.
 *
 * Importa el tipo `SettingDescriptor` de `src/modules/**`, que el bundle del
 * admin sí puede hacer (precedente: `admin/hooks/api/typesense.tsx:9`).
 */

export type SettingFieldController = {
  /** Valor tocado por el usuario, o `undefined` si no tocó nada. */
  draft: unknown;
  markedForUnset: boolean;
  /** El usuario apretó "Reemplazar" en un secreto. */
  replacingSecret: boolean;
  error?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
  /** Vuelve al valor heredado: encola el borrado de la fila. */
  onRestore: () => void;
  onStartReplaceSecret: () => void;
  onCancelReplaceSecret: () => void;
  onToggleDeleteSecret: () => void;
};

type Props = {
  descriptor: SettingDescriptor;
  state?: AppSettingState;
  controller: SettingFieldController;
};

/**
 * `null` = sin badge: el valor lo escribió alguien en la capa que esta pantalla
 * edita, así que no hay nada que aclarar.
 *
 * `'global'` SÍ lleva badge aunque muchas veces sea la propia capa editable (sin
 * tienda activa). Decir "configuración de la instancia" de más es ruido; no
 * decirlo cuando el operador está parado en una tienda es dejarlo creer que ese
 * valor es de la tienda, y ahí el próximo "guardar" forkea el namespace sin que
 * se dé cuenta.
 */
const SOURCE_BADGE: Record<AppSettingState['source'], string | null> = {
  site: null,
  global: 'Configuración de la instancia',
  env: 'Heredado del entorno',
  default: 'Valor por defecto',
  off: 'Apagado en esta tienda',
  unset: 'Sin configurar',
};

/** Los que piden atención: no hay valor efectivo utilizable. */
const ALARMING: ReadonlySet<AppSettingState['source']> = new Set(['unset', 'off']);

export const SettingField = ({ descriptor, state, controller }: Props) => {
  const source = state?.source ?? 'unset';
  const isOverridden = state?.is_set === true;
  const touched = controller.draft !== undefined;

  // El acento a la izquierda es la señal de "esto viaja en el próximo
  // Guardar" que NO depende de leer ningún texto: cubre tanto un draft sin
  // guardar como un secreto marcado para borrar, que son las dos formas en
  // que esta fila puede quedar pendiente.
  const pending = touched || controller.markedForUnset;

  const longHelp = isLongHelp(descriptor.help);

  return (
    <div
      className={clx(
        'flex flex-col gap-y-1.5 border-l-2 border-transparent py-3 pl-3',
        pending && 'border-ui-border-interactive',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Las ayudas largas van al tooltip del label; las cortas siguen en
              línea abajo del control. El corte y su porqué están en
              `common/setting-label.tsx`. */}
          <SettingLabel
            label={descriptor.label}
            htmlFor={descriptor.key}
            size="small"
            weight="plus"
            hint={longHelp ? descriptor.help : undefined}
          />
          {SOURCE_BADGE[source] && (
            <Badge size="2xsmall" color={ALARMING.has(source) ? 'red' : 'grey'}>
              {SOURCE_BADGE[source]}
            </Badge>
          )}
          {/* Sin badge de "requiere reinicio": no hay ningún ajuste editable acá
              que lo necesite. El tier `'boot'` que lo pintaba se eliminó porque
              mentía — el reinicio no aplicaba nada (ver `SettingTier`). */}
          {descriptor.required && ALARMING.has(source) && (
            <Badge size="2xsmall" color="red">
              Requerido
            </Badge>
          )}
          {touched && (
            <Badge size="2xsmall" color="blue">
              Sin guardar
            </Badge>
          )}
        </div>

        {isOverridden && !controller.markedForUnset && (
          <Button
            variant="transparent"
            size="small"
            disabled={controller.disabled}
            onClick={controller.onRestore}
          >
            Restaurar
          </Button>
        )}
      </div>

      {descriptor.type === 'secret' ? (
        <SecretControl descriptor={descriptor} state={state} controller={controller} />
      ) : (
        <ValueControl descriptor={descriptor} state={state} controller={controller} />
      )}

      {controller.error ? (
        <Text id={errorId(descriptor.key)} size="xsmall" className="text-ui-fg-error" role="alert">
          {controller.error}
        </Text>
      ) : (
        descriptor.help &&
        (longHelp ? (
          /*
            La ayuda larga se ve en el tooltip del label, pero el TEXTO tiene que
            seguir en el DOM igual: `describedByFor` apunta `aria-describedby` del
            control a este id, y el contenido del `Tooltip` cuelga del ícono, no
            del input. Sin este ancla, adelgazar la UI le sacaría al lector de
            pantalla justo la información que más necesita — la que explica por
            qué el campo es como es. Se ve mejor y se escucha peor no es un
            arreglo: es el mismo bug con otra víctima.
          */
          <span id={helpId(descriptor.key)} className="sr-only">
            {descriptor.help}
          </span>
        ) : (
          <Text id={helpId(descriptor.key)} size="xsmall" className="text-ui-fg-subtle">
            {descriptor.help}
          </Text>
        ))
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * IDs compartidos entre el `Label` (arriba), el control (`Input`/`Select`/
 * `Switch`/`Textarea`) y el texto de ayuda o de error. Sin este puente,
 * `aria-describedby` no tiene nada que apuntar y un lector de pantalla lee el
 * control sin la ayuda ni el motivo del error — que es justo la única
 * información que distingue "Requerido" de "por qué falló".
 */
const helpId = (key: string) => `${key}-help`;
const errorId = (key: string) => `${key}-error`;
const describedByFor = (descriptor: SettingDescriptor, error?: string): string | undefined =>
  error ? errorId(descriptor.key) : descriptor.help ? helpId(descriptor.key) : undefined;

// ─────────────────────────────────────────────────────────────────────────────

const ValueControl = ({ descriptor, state, controller }: Props) => {
  const { draft, disabled, onChange, error } = controller;
  const isOverridden = state?.is_set === true;

  /**
   * Sólo se pinta el input con un valor cuando hay override. Si el valor viene
   * heredado va de PLACEHOLDER: así "heredado" se distingue a simple vista de
   * "alguien lo puso a mano con el mismo texto", que un input pre-cargado
   * borraría.
   */
  const stored = isOverridden ? state?.value : undefined;
  const inherited = !isOverridden ? state?.value : undefined;
  const current = draft !== undefined ? draft : stored;

  const invalid = Boolean(error);

  const describedBy = describedByFor(descriptor, error);

  if (descriptor.type === 'boolean') {
    // El switch muestra siempre el estado EFECTIVO: un toggle en blanco cuando
    // el env lo tiene prendido sería directamente mentira.
    const effective = current !== undefined ? current : inherited;
    return (
      <div className="flex items-center gap-x-2">
        <Switch
          id={descriptor.key}
          checked={effective === true}
          disabled={disabled}
          aria-describedby={describedBy}
          onCheckedChange={(v) => onChange(v)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {effective === true ? 'Activado' : 'Desactivado'}
        </Text>
      </div>
    );
  }

  if (descriptor.type === 'enum') {
    const effective = current !== undefined ? current : inherited;
    return (
      <Select
        value={typeof effective === 'string' ? effective : ''}
        disabled={disabled}
        onValueChange={(v) => onChange(v)}
      >
        <Select.Trigger
          id={descriptor.key}
          className={clx(invalid && 'border-ui-border-error', 'w-full sm:max-w-sm')}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <Select.Value placeholder="Elegí una opción" />
        </Select.Trigger>
        <Select.Content>
          {(descriptor.options ?? []).map((o) => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    );
  }

  if (descriptor.type === 'json' || descriptor.type === 'text') {
    return (
      <Textarea
        id={descriptor.key}
        rows={3}
        className={clx(descriptor.type === 'json' && 'font-mono text-xs', invalid && 'border-ui-border-error')}
        value={toInputString(current)}
        placeholder={descriptor.placeholder ?? toInputString(inherited)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={descriptor.key}
      type={descriptor.type === 'number' ? 'number' : 'text'}
      min={descriptor.min}
      max={descriptor.max}
      step={descriptor.step}
      className={clx(invalid && 'border-ui-border-error', 'w-full sm:max-w-sm')}
      value={toInputString(current)}
      placeholder={descriptor.placeholder ?? toInputString(inherited)}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Campo write-only. Nunca recibe el valor del servidor: se muestra el preview
 * enmascarado y se ofrece reemplazar o borrar, que es el mismo affordance de
 * `admin/routes/erp/configuracion/page.tsx:1086-1112`. Existe porque la UI sólo
 * conoce el NOMBRE de la credencial, nunca su valor — y por eso borrar tiene que
 * ser un acto explícito y no "dejar el campo vacío".
 */
const SecretControl = ({ descriptor, state, controller }: Props) => {
  const { draft, disabled, replacingSecret, markedForUnset, error } = controller;
  const storedInDb = state?.is_set === true;
  const undecryptable = state?.decryptable === false;
  const inEnvOnly = !storedInDb && state?.env_present === true;
  // El error/help "oficial" del campo lo renderiza el wrapper (`SettingField`),
  // una sola vez, con `errorId`/`helpId`. Acá sólo se agrega un id PROPIO para
  // el aviso de "no descifra", que es una condición aparte y puede coexistir
  // con un error de validación — `aria-describedby` admite varios ids
  // separados por espacio, así que se concatenan en vez de pisarse.
  const undecryptableId = `${descriptor.key}-undecryptable`;
  const officialDescribedBy = describedByFor(descriptor, error);
  const describedBy = [officialDescribedBy, undecryptable && undecryptableId]
    .filter(Boolean)
    .join(' ') || undefined;

  // El `Label` de arriba apunta con `htmlFor` a `descriptor.key` en TODOS los
  // estados, así que cada rama tiene que poner ese id en el elemento
  // accionable de verdad — si no, clickear el label (o el lector de pantalla
  // que anuncia "asociado a…") apunta a nada.
  if (markedForUnset) {
    return (
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-ui-tag-red-border bg-ui-tag-red-bg px-3 py-2"
        aria-live="polite"
      >
        <Text size="small" className="text-ui-tag-red-text">
          Se borrará al guardar.
        </Text>
        <Button
          id={descriptor.key}
          variant="secondary"
          size="small"
          disabled={disabled}
          onClick={controller.onToggleDeleteSecret}
        >
          Deshacer
        </Button>
      </div>
    );
  }

  // Sin nada guardado (o con la clave rotada) el input va abierto: no hay valor
  // que preservar y esconderlo detrás de un botón sólo agrega un click.
  const mustEnter = (!storedInDb && !inEnvOnly) || undecryptable;

  if (replacingSecret || mustEnter) {
    return (
      <div className="flex flex-col gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Sin este badge, un secreto reemplazándose se ve IGUAL que uno que
              nunca tuvo valor: los dos muestran un input de contraseña vacío.
              La diferencia — que cancelar acá vuelve a un valor guardado y allá
              no vuelve a nada — es la que separaba "Cancelar" de que no
              apareciera ningún botón, y ahora también se ve sin leer el input. */}
          {!mustEnter && (
            <Badge size="2xsmall" color="orange">
              Reemplazando
            </Badge>
          )}
          {undecryptable && (
            <Text id={undecryptableId} size="xsmall" className="text-ui-fg-error" role="alert">
              No se puede descifrar (rotó la clave de cifrado). Reingresá el valor.
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:gap-x-2">
          <Input
            id={descriptor.key}
            type="password"
            autoComplete="new-password"
            placeholder="Pegá el valor nuevo"
            className="w-full sm:max-w-sm"
            value={typeof draft === 'string' ? draft : ''}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(e) => controller.onChange(e.target.value)}
          />
          {!mustEnter && (
            <Button
              variant="secondary"
              size="small"
              disabled={disabled}
              onClick={controller.onCancelReplaceSecret}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text size="small" className="font-mono text-ui-fg-subtle">
          {/* Un secreto que vive en el entorno tampoco se previsualiza. */}
          {storedInDb ? (state?.preview ?? '••••') : 'Definido en el entorno'}
        </Text>
        {state?.updated_at && (
          <Text size="xsmall" className="text-ui-fg-muted">
            Guardado el {new Date(state.updated_at).toLocaleDateString('es-AR')}
          </Text>
        )}
      </div>
      <div className="flex items-center gap-x-2">
        <Button
          id={descriptor.key}
          variant="secondary"
          size="small"
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={controller.onStartReplaceSecret}
        >
          Reemplazar
        </Button>
        {storedInDb && (
          <Button variant="danger" size="small" disabled={disabled} onClick={controller.onToggleDeleteSecret}>
            Borrar
          </Button>
        )}
      </div>
    </div>
  );
};

function toInputString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}
