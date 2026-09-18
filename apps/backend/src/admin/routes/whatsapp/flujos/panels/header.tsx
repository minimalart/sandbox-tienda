import { ArrowPath, ArrowUturnLeft, EllipsisHorizontal, PlaySolid } from '@medusajs/icons';
import { Badge, Button, DropdownMenu, Heading, IconButton, Tooltip } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { ExtensionVersion } from '../../../../components/common/extension-version';
import { HelpDrawer } from '../../../../components/common/help-drawer';
import { whatsappLabel } from '../../../../translations/whatsapp';
import { statusPills, type StatusInput } from '../lib/status';

/**
 * EL ENCABEZADO.
 *
 * Lo que cambió: los estados dejan de competir con el nombre de la pantalla y
 * empiezan a decir la verdad de la base. Antes había tres badges sueltos
 * ("Sin publicar", "Sin guardar", "N problemas") que no distinguían lo que el
 * cliente está viendo de lo que hay en pantalla; ahora el par
 * "Publicado · v7 / Borrador · Cambios sin guardar" dice las dos cosas, y el de
 * problemas se puede TOCAR para que el canvas salte al paso que falla.
 *
 * Las reglas de qué badge aparece cuándo viven en `lib/status.ts`, con tests: eran
 * condiciones sueltas en el JSX y ahí no hay forma de afirmar que "Publicado" no
 * aparece cuando todavía no se publicó nada.
 */
export function FlowHeader({
  status,
  name,
  onGoToIssue,
  onTest,
  testing,
  onSave,
  onPublish,
  onSeed,
  seedLabel,
  onShowVersions,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOrganize,
  onShowShortcuts,
  busy,
  saving,
  publishing,
}: {
  status: StatusInput;
  /** El nombre del recorrido que se está editando. Vacío = todavía no tiene. */
  name: string;
  onGoToIssue: () => void;
  onTest: () => void;
  testing: boolean;
  onSave: () => void;
  onPublish: () => void;
  onSeed: () => void;
  seedLabel: string;
  onShowVersions: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOrganize: () => void;
  onShowShortcuts: () => void;
  busy: boolean;
  saving: boolean;
  publishing: boolean;
}): ReactElement {
  const pills = statusPills(status);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* El NOMBRE y no "Recorrido": desde que hay varios, el título genérico no
            dice cuál se está editando — y abrir el equivocado y publicarlo es el
            error caro de esta pantalla. */}
        <Heading level="h2">{name?.trim() || whatsappLabel('NAV_FLOWS')}</Heading>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {pills.map((pill) =>
            pill.clickable ? (
              <button key={pill.key} type="button" onClick={onGoToIssue} title="Ir al primer problema">
                <Badge size="2xsmall" color={pill.color} className="cursor-pointer">
                  {pill.text}
                </Badge>
              </button>
            ) : (
              <Badge key={pill.key} size="2xsmall" color={pill.color}>
                {pill.text}
              </Badge>
            ),
          )}
        </div>
      </div>

      <div className="flex items-center gap-x-2">
        {/* Deshacer va en el header y no sólo en Ctrl+Z: el atajo lo usa quien ya sabe
            que existe, y el botón es lo que le dice al resto que se puede volver
            atrás — que es justo lo que hace falta saber antes de animarse a borrar. */}
        <div className="flex items-center">
          <Tooltip content="Deshacer (Ctrl+Z)">
            <IconButton size="small" variant="transparent" aria-label="Deshacer" disabled={!canUndo} onClick={onUndo}>
              <ArrowUturnLeft />
            </IconButton>
          </Tooltip>
          <Tooltip content="Rehacer (Ctrl+Shift+Z)">
            <IconButton
              size="small"
              variant="transparent"
              aria-label="Rehacer"
              disabled={!canRedo}
              onClick={onRedo}
              className="scale-x-[-1]"
            >
              <ArrowUturnLeft />
            </IconButton>
          </Tooltip>
        </div>

        <ExtensionVersion extension="whatsapp" />
        <HelpDrawer slug="whatsapp" />

        {/* Probar está al lado de Publicar y antes: es el paso que falta hacer antes
            de publicar, y tenerlo a mano es lo que evita que alguien pruebe en
            producción porque le quedaba más cerca. */}
        <Tooltip content="Probar el recorrido sin publicarlo y sin mandar nada">
          <Button size="small" variant={testing ? 'primary' : 'secondary'} onClick={onTest}>
            <PlaySolid />
            Probar
          </Button>
        </Tooltip>

        <Button size="small" variant="secondary" onClick={onSave} isLoading={saving} disabled={busy}>
          Guardar
        </Button>
        <Button size="small" onClick={onPublish} isLoading={publishing} disabled={busy}>
          Publicar
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent" aria-label="Más acciones" disabled={busy}>
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onOrganize}>
              <ArrowPath />
              Organizar automáticamente
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={onShowVersions}>Versiones del recorrido</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onShowShortcuts}>Atajos del teclado</DropdownMenu.Item>
            <DropdownMenu.Separator />
            {/* "Reemplazar por el base" es destructivo y vivía como un botón suelto
                del header, al lado de Guardar. Acá adentro sigue a un clic pero deja
                de estar en el camino de la edición de todos los días. */}
            <DropdownMenu.Item onClick={onSeed}>{seedLabel}</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

    </div>
  );
}
