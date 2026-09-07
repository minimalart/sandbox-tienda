import { Badge, Button, Copy, Drawer, InlineTip, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import type { SettingDescriptor } from '../../../../../modules/app-settings/descriptors';
import {
  type AppSettingState,
  fieldErrorsFrom,
  useUpdateAppSettings,
} from '../../../../hooks/api/app-settings';
import { useActiveSite } from '../../../../hooks/use-active-site';
import { SettingField, type SettingFieldController } from '../../../../components/app-settings/setting-field';

/**
 * Edición de UN ajuste desde el buscador central.
 *
 * Usa el MISMO `<SettingField>` que la card por extensión: un solo renderer y un
 * solo set de comportamientos por tipo. La alternativa era editar inline en la
 * celda, y se descartó porque un secreto necesita tres affordances
 * (reemplazar / borrar / deshacer) que no entran en una celda, y un `json`
 * necesita textarea.
 */

type Props = {
  descriptor: SettingDescriptor;
  state?: AppSettingState;
  /**
   * La tienda que se está editando. `null` = la capa global.
   *
   * Viaja explícita y no se lee de la tienda activa acá adentro: el drawer se
   * abre con los valores de UNA tienda y tiene que guardar en ESA, aunque el
   * selector cambie mientras está abierto.
   */
  siteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const SettingEditDrawer = ({ descriptor, state, siteId, open, onOpenChange }: Props) => {
  const [draft, setDraft] = useState<unknown>(undefined);
  const [markedForUnset, setMarkedForUnset] = useState(false);
  const [replacingSecret, setReplacingSecret] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { mutateAsync: save, isPending: saving } = useUpdateAppSettings(siteId);

  // Nombre de la tienda que ESTE drawer edita — no necesariamente la tienda
  // activa ahora mismo, ver el docblock de `siteId` en `Props`. Sin esto el
  // drawer no dice en ningún lado para quién está guardando, y con `siteId`
  // congelado eso deja de ser obvio en cuanto el selector de arriba cambia
  // mientras el drawer sigue abierto.
  const { sites, enabled } = useActiveSite();
  const siteName = siteId ? (sites.find((s) => s.id === siteId)?.name ?? null) : null;
  const showSiteContext = enabled && sites.length > 1;

  // Mismo fallback que `page.tsx`: sin fila en la respuesta, el ajuste está
  // `unset`, no "sin dato". Sin este default, un descriptor que todavía nunca
  // se guardó (nunca tuvo fila) no dispara ningún `InlineTip` de contexto acá
  // abajo, aunque la tabla ya lo esté mostrando en rojo como "Sin configurar".
  const source = state?.source ?? 'unset';

  const dirty = draft !== undefined || markedForUnset;

  const reset = () => {
    setDraft(undefined);
    setMarkedForUnset(false);
    setReplacingSecret(false);
    setError(undefined);
  };

  const onSave = async () => {
    try {
      await save({
        namespace: descriptor.namespace,
        values: draft !== undefined ? { [descriptor.key]: draft } : undefined,
        unset: markedForUnset ? [descriptor.key] : undefined,
      });
      toast.success('Ajuste guardado');
      reset();
      onOpenChange(false);
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err);
      setError(fieldErrors[descriptor.key] ?? (err as Error).message);
    }
  };

  const controller: SettingFieldController = {
    draft,
    markedForUnset,
    replacingSecret,
    error,
    disabled: saving,
    onChange: (value) => setDraft(value),
    onRestore: () => {
      setDraft(undefined);
      setMarkedForUnset(true);
    },
    onStartReplaceSecret: () => setReplacingSecret(true),
    onCancelReplaceSecret: () => {
      setReplacingSecret(false);
      setDraft(undefined);
    },
    onToggleDeleteSecret: () => setMarkedForUnset((v) => !v),
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Drawer.Content>
        <Drawer.Header>
          <div className="flex flex-col gap-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2">
              <Drawer.Title>{descriptor.label}</Drawer.Title>
              <Badge size="2xsmall">{descriptor.namespace}</Badge>
            </div>
            {/* La variable como dato secundario y copiable: es lo que hay que
                pegar en un ticket o en Slack para hablar de este ajuste, pero no
                es lo que el operador lee primero — para eso ya está el título. */}
            <div className="flex items-center gap-x-1">
              <Text size="xsmall" className="font-mono text-ui-fg-subtle">
                {descriptor.key}
              </Text>
              <Copy content={descriptor.key} variant="mini" />
            </div>
            {showSiteContext && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {siteId
                  ? `Editando para ${siteName ?? 'esta tienda'}`
                  : 'Editando la configuración de la instancia'}
              </Text>
            )}
          </div>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4">
          {/* Contexto de por qué el valor actual está vacío o ignorado, ANTES del
              campo: `SettingField` ya badgea el origen, pero un badge no explica
              la acción correctiva — y acá la acción es distinta según cuál de los
              dos rojos sea (ver el docblock de `SOURCE_LABEL` en `page.tsx`). */}
          {source === 'off' && (
            <InlineTip variant="warning" label="Apagado en esta tienda">
              Hay un valor de instancia o de entorno disponible, pero esta tienda lo tiene
              apagado a propósito (no hereda por diseño, para no operar con una cuenta ajena sin
              querer). Cargá un valor acá para prenderlo sólo para esta tienda.
            </InlineTip>
          )}
          {source === 'unset' && (
            <InlineTip variant="info" label="Sin configurar">
              No hay valor en ninguna capa: ni en esta tienda, ni en la instancia, ni en el
              entorno. Cargá uno acá, o hacelo desde "Configuración de la instancia" para que
              aplique a todas las tiendas.
            </InlineTip>
          )}

          <SettingField descriptor={descriptor} state={state} controller={controller} />

          {/* Acá iba el aviso de "se lee al arrancar, aplica en el próximo
              reinicio". Era falso: `medusa-config.ts` no lee la base ni al
              reiniciar, así que el ajuste no aplicaba nunca. El tier que lo
              disparaba ya no existe; una variable que de verdad sea de arranque va
              como `envOnly` del namespace, que la UI muestra sin input. */}

          {/* Confirmación de qué va a pasar al guardar cuando la acción pendiente
              es un borrado: "Restaurar" en `SettingField` marca `markedForUnset`
              sin dejar ningún rastro visual propio para tipos no-secreto (el
              secreto sí tiene su "Se borrará al guardar."), así que sin esto un
              clic en "Restaurar" no explica qué va a pasar al apretar Guardar. */}
          {markedForUnset && descriptor.type !== 'secret' && (
            <InlineTip variant="warning" label="Se va a restaurar">
              Al guardar, este valor deja de estar en esta capa y el ajuste vuelve a heredar de
              la capa siguiente (instancia, entorno o valor por defecto).
            </InlineTip>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small" disabled={saving}>
              Cancelar
            </Button>
          </Drawer.Close>
          <Button size="small" isLoading={saving} disabled={!dirty} onClick={onSave}>
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
