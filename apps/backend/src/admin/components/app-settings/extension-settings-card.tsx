import { Badge, Button, Container, Heading, Text, toast } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { registerExtensionSettingsCard } from '@minimalart/mercatto-plugin-runtime/admin';
import { isCredentialSetting } from '../../../modules/app-settings/credential-presentation';
import { findNamespace } from '../../../modules/app-settings/descriptors';
import {
  type AppSettingState,
  fieldErrorsFrom,
  useAppSettings,
  useUpdateAppSettings,
} from '../../hooks/api/app-settings';
import { useActiveSite } from '../../hooks/use-active-site';
import { SettingField, type SettingFieldController } from './setting-field';
import { SettingFieldSkeleton } from './setting-field-skeleton';
import { SettingsSiteContext } from './settings-site-context';

/**
 * Card de ajustes de UNA extensión. Drop-in de una línea en cualquier página:
 *
 *     <ExtensionSettingsCard namespace="extension:typesense" />
 *
 * Estado con `useState` + `useEffect(reset)` y no react-hook-form, siguiendo el
 * patrón dominante del repo (`store-config/components/ai-config-card.tsx:23-58`).
 */

export type ExtensionSettingsCardProps = {
  /** `extension:typesense` — el `settings_namespace` del manifest. */
  namespace: string;
  /** Ámbito explícito cuando el drawer representa Todas o una tienda concreta. */
  siteId?: string | null;
  /** Only the central credentials drawer renders account fields. */
  credentials?: boolean;
  /** Sólo estos grupos. Sirve para repartir una extensión grande entre tabs. */
  groups?: string[];
  /** Whitelist de keys. Escape hatch. */
  only?: string[];
  title?: string;
  description?: string;
  hideHeader?: boolean;
  /**
   * Oculta el bloque "Sólo por entorno". Necesario cuando una extensión se
   * reparte en varias cards: el bloque es del NAMESPACE, no del grupo, así que
   * sin esto se repetiría idéntico en cada card. Se deja visible en una sola.
   */
  hideEnvOnly?: boolean;
  /**
   * Oculta la barra de contexto de tienda. MISMA razón que `hideEnvOnly`, y por eso
   * el mismo patrón: la tienda activa es del BACKOFFICE, no de la card, así que en
   * una página con varias cards se repetiría idéntica N veces. Se deja visible en
   * UNA sola —la primera— y se apaga en las demás.
   *
   * El default es `false` a propósito: si el default fuera ocultar, la página nueva
   * nacería sin contexto de tienda y volveríamos exactamente al problema que esta
   * barra existe para resolver. Que el ruido sea opt-out, no el dato.
   */
  hideSiteContext?: boolean;
  /**
   * Sin argumento a propósito. Antes recibía `{ restart_required }`, que salía del
   * `tier: 'boot'`; cuando ese tier se eliminó —era una promesa falsa, porque
   * `medusa-config.ts` no lee la base ni después de reiniciar—, el campo desapareció
   * de la respuesta y esta llamada quedó pasando `Boolean(undefined)` para siempre.
   * El único consumidor ya ignoraba el argumento.
   */
  onSaved?: () => void;
};

export const ExtensionSettingsCard = ({
  namespace,
  siteId,
  credentials = false,
  groups,
  only,
  title,
  description,
  hideHeader,
  hideSiteContext,
  onSaved,
}: ExtensionSettingsCardProps) => {
  const declared = findNamespace(namespace);
  // La tienda activa entra en la query key Y viaja como header por llamada, que
  // es lo que permite cambiar de tienda sin recargar la página.
  const { activeId: selectedSiteId } = useActiveSite();
  const activeId = siteId !== undefined ? siteId : declared?.settings.every((d) => d.scope === 'instance') ? null : selectedSiteId;

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [unset, setUnset] = useState<string[]>([]);
  const [replacing, setReplacing] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isPending, isError, refetch } = useAppSettings(namespace, activeId, {
    enabled: Boolean(declared),
  });

  const { mutateAsync: save, isPending: saving } = useUpdateAppSettings(activeId);

  // Al llegar datos nuevos (o al guardar) se descarta el borrador: lo que se ve
  // pasa a ser lo que el servidor confirmó.
  useEffect(() => {
    if (!data) return;
    setDraft({});
    setUnset([]);
    setReplacing([]);
    setErrors({});
  }, [data]);

  const descriptors = useMemo(() => {
    if (!declared) return [];
    return declared.settings.filter(
      (d) =>
        (credentials || !isCredentialSetting(d)) &&
        (!groups || groups.includes(d.group)) &&
        (!only || only.includes(d.key))
    );
  }, [declared, groups, only, credentials]);

  const stateByKey = useMemo(() => {
    const map = new Map<string, AppSettingState>();
    for (const s of data?.settings ?? []) map.set(s.key, s);
    return map;
  }, [data]);

  const grouped = useMemo(() => {
    const out = new Map<string, typeof descriptors>();
    for (const d of descriptors) {
      const list = out.get(d.group) ?? [];
      list.push(d);
      out.set(d.group, list);
    }
    return [...out.entries()];
  }, [descriptors]);

  /**
   * Primer descriptor (en el orden en que se renderiza) que tiene un error. Se
   * usa dos veces: para saber si hay algo que resaltar y para saber A DÓNDE
   * saltar. El orden de `descriptors` es el mismo que el de `grouped` porque
   * éste se arma iterando aquél sin reordenar.
   *
   * Va ANTES del `if (!declared)` de abajo aunque sólo tenga sentido cuando sí
   * hay descriptores: un hook no puede quedar detrás de un `return`
   * condicional, porque entonces algunos renders lo llaman y otros no, que es
   * justo lo que las reglas de hooks prohíben.
   */
  const firstErrorKey = useMemo(
    () => descriptors.find((d) => errors[d.key])?.key,
    [descriptors, errors]
  );

  // Un 400 con errores por campo no alcanza con el toast: en un formulario de
  // 20 campos la esquina donde aparece el toast no dice CUÁL falló, y el
  // operador tiene que leer uno por uno. Este efecto mueve el foco al primer
  // campo con error apenas `errors` cambia — que incluye el momento en que
  // `onSave` fuerza a un secreto a modo reemplazo para que el campo exista de
  // verdad en el DOM antes de intentar enfocarlo (ver más abajo).
  useEffect(() => {
    if (!firstErrorKey) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(firstErrorKey);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [firstErrorKey]);

  // Un namespace mal tipeado tiene que GRITAR. Es la falla número uno de un
  // componente con clave string, y una card vacía la haría invisible.
  if (!declared) {
    return (
      <Container className="flex flex-col gap-y-1 border-ui-border-error">
        <Heading level="h2">Ajustes no declarados</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          No hay descriptores para <span className="font-mono">{namespace}</span>. Revisá el
          namespace o creá{' '}
          <span className="font-mono">descriptors/{namespace.split(':')[1]}.ts</span>.
        </Text>
      </Container>
    );
  }

  if (descriptors.length === 0) return null;

  const dirty = Object.keys(draft).length > 0 || unset.length > 0;
  // `isError` entra acá y no sólo en el `disabled` de cada input: sin baseline
  // cargado, "Guardar" mandaría un `unset`/`draft` vacíos que el backend
  // aceptaría como no-op, pero el botón quedaría habilitado sobre una card que
  // no muestra ni un solo campo — una acción que no hace nada y que parece
  // que sí.
  const disabled = isPending || saving || isError;

  const scrollToFirstError = () => {
    if (!firstErrorKey) return;
    const el = document.getElementById(firstErrorKey);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  const onSave = async () => {
    try {
      await save({ namespace, values: draft, unset });
      setErrors({});
      toast.success('Ajustes guardados');
      onSaved?.();
    } catch (error) {
      const fieldErrors = fieldErrorsFrom(error);
      setErrors(fieldErrors);
      const secretKeysToOpen = descriptors
        .filter((d) => d.type === 'secret' && fieldErrors[d.key] && !replacing.includes(d.key))
        .map((d) => d.key);
      if (secretKeysToOpen.length > 0) {
        setReplacing((prev) => [...prev, ...secretKeysToOpen]);
      }
      toast.error(
        Object.keys(fieldErrors).length > 0
          ? 'Hay campos con errores. No se guardó nada.'
          : `No se pudo guardar: ${(error as Error).message}`
      );
    }
  };

  const onDiscard = () => {
    setDraft({});
    setUnset([]);
    setReplacing([]);
    setErrors({});
  };

  const controllerFor = (key: string, isSecret: boolean): SettingFieldController => ({
    draft: draft[key],
    markedForUnset: unset.includes(key),
    replacingSecret: replacing.includes(key),
    error: errors[key],
    disabled,
    onChange: (value) => setDraft((prev) => ({ ...prev, [key]: value })),
    onRestore: () => {
      setDraft(({ [key]: _dropped, ...rest }) => rest);
      setUnset((prev) => (prev.includes(key) ? prev : [...prev, key]));
      if (isSecret) setReplacing((prev) => prev.filter((k) => k !== key));
    },
    onStartReplaceSecret: () => setReplacing((prev) => [...prev, key]),
    onCancelReplaceSecret: () => {
      setReplacing((prev) => prev.filter((k) => k !== key));
      // Cancelar descarta lo tipeado, NO borra lo guardado.
      setDraft(({ [key]: _dropped, ...rest }) => rest);
    },
    onToggleDeleteSecret: () =>
      setUnset((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
  });

  const errorCount = Object.keys(errors).length;

  return (
    <Container className="flex flex-col gap-y-2 p-0">
      {/*
        El título, la descripción y el nombre de cada grupo son ESTÁTICOS
        (salen de `declared`, un import síncrono de los descriptores) y por eso
        se muestran igual con `isPending` en `true` o en `false` — nunca hubo
        nada que esqueletizar ahí. Lo único que depende del fetch es el VALOR
        de cada ajuste, así que el esqueleto de más abajo tapa sólo eso.
      */}
      {!hideHeader && (
        <div className="flex flex-col gap-y-1 px-6 pt-6">
          <Heading level="h2">{title ?? declared.title}</Heading>
          {description && (
            <Text size="small" className="text-ui-fg-subtle">
              {description}
            </Text>
          )}
        </div>
      )}

      {/* Acá vivía el cartel de "hay cambios que necesitan un reinicio". Se fue con
          el tier `'boot'`: mandaba a reiniciar por un valor que el reinicio tampoco
          iba a leer, porque `medusa-config.ts` no toca la base. Todo lo que esta
          card guarda aplica al instante. */}

      {/*
        Va DEBAJO del título y no arriba: primero se lee QUÉ extensión es, después
        contra qué tienda se resuelve. Y va acá adentro, no en las ~28 páginas
        consumidoras, porque es esta card la que mete `activeId` en la query key y en
        el header `x-site-id` — el componente que hace el scoping es el que tiene que
        declararlo. Montarlo página por página garantiza que la número 29 nazca sin él.
      */}
      {!hideSiteContext && <SettingsSiteContext descriptors={descriptors} dirty={dirty} />}

      {/*
        Persistente mientras haya `errors`, no un toast que se va solo. Un
        formulario largo puede tener el campo con error fuera de la pantalla
        visible; el toast dice "hay errores" pero no dice DÓNDE, y para cuando
        el operador vuelve a mirar ya desapareció. Esto se queda hasta el
        próximo guardado exitoso, discard, o carga de datos nuevos.
      */}
      {errorCount > 0 && (
        <div className="mx-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-ui-tag-red-border bg-ui-tag-red-bg px-4 py-3">
          <Text size="small" className="text-ui-tag-red-text">
            {errorCount === 1
              ? 'Hay un campo con errores. No se guardó nada.'
              : `Hay ${errorCount} campos con errores. No se guardó nada.`}
          </Text>
          {firstErrorKey && (
            <Button variant="secondary" size="small" onClick={scrollToFirstError}>
              Ir al primero
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col divide-y px-6">
        {isError && (
          <div className="flex items-center gap-x-3 py-4">
            <Text size="small" className="text-ui-fg-error">
              No se pudieron cargar los ajustes.
            </Text>
            <Button variant="secondary" size="small" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {!isError &&
          grouped.map(([group, items]) => (
            <div key={group} className="flex flex-col py-3">
              {/*
                `Heading level="h3"` y no `Text weight="plus"`: con más de dos o
                tres grupos el texto chico se aplana contra el label de cada
                campo (también `size="small" weight="plus"`) y deja de leerse
                como encabezado. El borde inferior separa "título de sección" de
                "primer campo" — la línea de `divide-y` de más arriba ya separa
                un grupo del siguiente, así que ésta es una jerarquía distinta,
                no una duplicada.
              */}
              <div className="mb-2 flex items-baseline gap-x-2 border-b border-ui-border-base pb-2">
                <Heading level="h3">{group}</Heading>
                <Badge size="2xsmall" color="grey">
                  {items.length}
                </Badge>
              </div>
              <div className="flex flex-col divide-y">
                {isPending
                  ? items.map((d) => <SettingFieldSkeleton key={d.key} />)
                  : items.map((d) => (
                      <SettingField
                        key={d.key}
                        descriptor={d}
                        state={stateByKey.get(d.key)}
                        controller={controllerFor(d.key, d.type === 'secret')}
                      />
                    ))}
              </div>
            </div>
          ))}
      </div>

      {/*
        Footer SIEMPRE montado mientras haya algo editable, ya no `{dirty &&
        ...}`. Antes aparecer y desaparecer del layout escondía la única salida
        ("Guardar"/"Descartar") justo cuando el usuario recién terminó de tocar
        algo, y el salto de alto de la card se sentía como que algo se rompió.
        Ahora los botones están siempre en el mismo lugar, deshabilitados
        cuando no hay nada pendiente — el mismo criterio que ya usan
        `ai-config-card.tsx` y `fiscal-docs-card.tsx` con su botón "Guardar"
        fijo en el header.

        El `descriptors.length > 0` es el escape para la variante documentada
        arriba en `store-config/page.tsx` (`only={[]}`): una card que sólo
        muestra el bloque "Sólo por entorno", sin un solo campo editable. Ahí
        "siempre visible" degeneraría en un footer PERMANENTEMENTE
        deshabilitado y sin ningún propósito — el criterio es "visible mientras
        pueda dejar de estar limpio", no "visible siempre a secas".
      */}
      {descriptors.length > 0 && (
        <div className="flex items-center justify-end gap-x-2 border-t px-6 py-3">
          <Button
            variant="secondary"
            size="small"
            disabled={disabled || !dirty}
            onClick={onDiscard}
          >
            Descartar
          </Button>
          <Button
            size="small"
            isLoading={saving}
            disabled={!saving && (disabled || !dirty)}
            onClick={onSave}
          >
            Guardar
          </Button>
        </div>
      )}
    </Container>
  );
};

// Registrar en el runtime contract para que los plugins publicados
// (@minimalart/mercatto-plugin-runtime/admin) rendericen la MISMA card vía el
// slot `ExtensionSettingsCard`. La registración se dispara con el side-effect
// del import del componente en cualquier página del admin.
registerExtensionSettingsCard(ExtensionSettingsCard);
