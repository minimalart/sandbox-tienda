import { Alert, Badge, Button, Checkbox, Container, Heading, Label, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import {
  type SiteCredentialIntegration,
  credentialErrorMessage,
  isUndecryptableConflict,
  useDeleteSiteCredentials,
  useUpdateSiteCredentials,
} from '../../../../hooks/api/site-credentials';
import { BlockedBody } from './blocked-body';
import { DisconnectPrompt } from './disconnect-prompt';
import { KeyRow } from './key-row';
import { OrphanKeys } from './orphan-keys';
import { SourceBadge, formatSavedAt } from './source-badge';

/**
 * Una integración, para la tienda activa.
 *
 * Toda la pantalla se apoya en una sola regla: **el valor de una credencial nunca
 * baja del servidor**. Del GET viene el NOMBRE de la clave y nada más. Por eso el
 * campo cargado no es un input pre-poblado sino el affordance de tres botones que ya
 * usan `routes/erp/configuracion/page.tsx` y `components/app-settings/setting-field.tsx`:
 * Reemplazar / Borrar / Deshacer (extraído a `./key-row.tsx`). Un input enmascarado
 * con seis puntitos invita a "limpiarlo para borrar", y limpiar un campo que el
 * servidor ignora no borra nada: el operador se va convencido de que sacó la
 * credencial y la clave sigue viva.
 *
 * El guardado MERGEA (lo hace el POST), así que rotar una clave no toca las otras.
 * La única excepción es el blob ilegible, y por eso pide confirmación explícita.
 *
 * `isMainSite` viaja desde `page.tsx` (vía `useActiveSite()`, el mismo manifest que
 * ya resuelve `SiteScopeBar`) porque acá SÍ importa: `effective_source: 'none'`
 * significa cosas distintas según si la tienda es principal o no (ver el docblock
 * de `./source-badge.tsx`), y "Desconectar cuenta propia" tiene una consecuencia
 * distinta en cada caso (ver `./disconnect-prompt.tsx`). Sin este dato la pantalla
 * podía decir "vuelve a las del entorno" cuando en realidad quedaba apagada.
 */

type Props = {
  integration: SiteCredentialIntegration;
  /** La tienda que se está editando. Viaja explícita hasta las mutaciones. */
  siteId: string | null;
  /** Para que los toasts digan en qué tienda se guardó. Es media pantalla del daño. */
  siteName: string;
  /** `false` en toda tienda que no sea la principal. Ver docblock de arriba. */
  isMainSite: boolean;
};

export const IntegrationCard = ({ integration, siteId, siteName, isMainSite }: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [unset, setUnset] = useState<string[]>([]);
  const [replacing, setReplacing] = useState<string[]>([]);
  const [confirmReplaceAll, setConfirmReplaceAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El 409 llegó en caliente: la clave de cifrado rotó entre el GET y el guardado. */
  const [conflict, setConflict] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const { mutateAsync: save, isPending: saving } = useUpdateSiteCredentials(siteId);
  const { mutateAsync: disconnect, isPending: deleting } = useDeleteSiteCredentials(siteId);
  const busy = saving || deleting;

  const reset = () => {
    setValues({});
    setUnset([]);
    setReplacing([]);
    setConfirmReplaceAll(false);
    setError(null);
    setConflict(false);
  };

  const undecryptable = !integration.decryptable || conflict;
  /**
   * "Apagada por fail-closed": hay `effective_source: 'none'` pero NO porque el blob
   * sea ilegible (ese caso ya lo cubre el alert de `undecryptable`, y aplica igual en
   * cualquier tienda) sino porque esta tienda no es la principal y no tiene fila
   * propia. Es el caso que la migración de esta pantalla existe para volver visible:
   * antes de esto, una tienda en este estado se veía simplemente "sin configurar",
   * indistinguible de "todavía no la migramos".
   */
  const fellClosed = !isMainSite && !undecryptable && integration.effective_source === 'none';
  const savedAt = formatSavedAt(integration.updated_at);

  const filled = Object.entries(values).filter(([, value]) => value.trim() !== '');
  const dirty = filled.length > 0 || unset.length > 0;
  const canSave = dirty && (!undecryptable || confirmReplaceAll);

  const onSave = async () => {
    setError(null);
    try {
      const result = await save({
        integration: integration.integration,
        set: filled.length > 0 ? Object.fromEntries(filled) : undefined,
        unset: unset.length > 0 ? unset : undefined,
        // Sólo viaja cuando el operador confirmó: `canSave` lo garantiza.
        replace_undecryptable: undecryptable ? true : undefined,
      });
      toast.success(
        result.result === 'unchanged'
          ? 'No había nada que cambiar.'
          : `${integration.label}: credenciales actualizadas en ${siteName}.`,
      );
      reset();
    } catch (err) {
      // El 409 no es un error terminal: tiene una salida concreta, y la UI la ofrece.
      if (isUndecryptableConflict(err)) setConflict(true);
      setError(credentialErrorMessage(err));
    }
  };

  const onDisconnect = async () => {
    setError(null);
    try {
      await disconnect(integration.integration);
      toast.success(
        isMainSite && integration.env_available
          ? `${integration.label}: ${siteName} vuelve a usar las credenciales del entorno.`
          : `${integration.label}: ${siteName} se quedó sin credenciales.`,
      );
      reset();
    } catch (err) {
      setError(credentialErrorMessage(err));
    } finally {
      setPromptOpen(false);
    }
  };

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Heading level="h2">{integration.label}</Heading>
            <Badge size="2xsmall" className="font-mono">
              {integration.integration}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SourceBadge
              source={integration.effective_source}
              isMainSite={isMainSite}
              envAvailable={integration.env_available}
            />
            {integration.env_available ? (
              <Badge size="2xsmall" color="grey">
                Hay credenciales de entorno
              </Badge>
            ) : (
              <Badge size="2xsmall" color="orange">
                Sin credenciales de entorno
              </Badge>
            )}
            {savedAt && (
              <Text size="xsmall" className="text-ui-fg-muted">
                Guardado el {savedAt}
              </Text>
            )}
          </div>
        </div>

        {integration.is_set && (
          <DisconnectPrompt
            integration={integration}
            siteName={siteName}
            isMainSite={isMainSite}
            open={promptOpen}
            onOpenChange={setPromptOpen}
            triggerDisabled={busy}
            confirming={deleting}
            onConfirm={() => void onDisconnect()}
          />
        )}
      </div>

      {integration.writable ? (
        <WritableBody
          integration={integration}
          undecryptable={undecryptable}
          fellClosed={fellClosed}
          siteName={siteName}
          values={values}
          unset={unset}
          replacing={replacing}
          confirmReplaceAll={confirmReplaceAll}
          busy={busy}
          error={error}
          canSave={canSave}
          dirty={dirty}
          saving={saving}
          onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          onStartReplace={(key) => setReplacing((prev) => [...prev, key])}
          onCancelReplace={(key) => {
            setReplacing((prev) => prev.filter((entry) => entry !== key));
            setValues((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }}
          onToggleDelete={(key) =>
            setUnset((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]))
          }
          onConfirmReplaceAll={setConfirmReplaceAll}
          onSave={onSave}
          onDiscard={reset}
        />
      ) : (
        <BlockedBody integration={integration} error={error} />
      )}
    </Container>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

type WritableBodyProps = {
  integration: SiteCredentialIntegration;
  undecryptable: boolean;
  /** Ver `fellClosed` en `IntegrationCard`. */
  fellClosed: boolean;
  siteName: string;
  values: Record<string, string>;
  unset: string[];
  replacing: string[];
  confirmReplaceAll: boolean;
  busy: boolean;
  error: string | null;
  canSave: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (key: string, value: string) => void;
  onStartReplace: (key: string) => void;
  onCancelReplace: (key: string) => void;
  onToggleDelete: (key: string) => void;
  onConfirmReplaceAll: (value: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
};

const WritableBody = ({
  integration,
  undecryptable,
  fellClosed,
  siteName,
  values,
  unset,
  replacing,
  confirmReplaceAll,
  busy,
  error,
  canSave,
  dirty,
  saving,
  onChange,
  onStartReplace,
  onCancelReplace,
  onToggleDelete,
  onConfirmReplaceAll,
  onSave,
  onDiscard,
}: WritableBodyProps) => (
  <div className="flex flex-col gap-y-3 px-6 py-4">
    {/* Estado → consecuencia → acción, en ese orden: es lo primero que se lee del
        cuerpo de la card, antes que cualquier campo, porque es más grave que
        cualquier campo individual. Sólo se muestra cuando NO es el caso ilegible
        (ese tiene su propio alert, dos bloques abajo) para no apilar dos alerts
        rojos que dicen variantes de "no funciona" por razones distintas. */}
    {fellClosed && (
      <Alert variant="error">
        <div className="flex flex-col gap-y-2">
          <Text size="small" weight="plus">
            {integration.label} está APAGADA para {siteName}.
          </Text>
          <Text size="small">
            {siteName} no es la tienda principal
            {integration.env_available
              ? ', y aunque el entorno TIENE credenciales cargadas, esta integración no las usa'
              : ''}
            : una tienda no principal nunca hereda del entorno. Es la regla fail-closed — evita
            despachar o cobrar con la cuenta de otro titular.
          </Text>
          <Text size="small">
            Cargá la cuenta propia de {siteName} en los campos de abajo para prenderla.
          </Text>
        </div>
      </Alert>
    )}

    {undecryptable && (
      <Alert variant="error">
        <div className="flex flex-col gap-y-2">
          <Text size="small" weight="plus">
            Las credenciales guardadas no se pueden descifrar.
          </Text>
          <Text size="small">
            Rotó la clave de cifrado del backend (típicamente <span className="font-mono">JWT_SECRET</span>),
            así que lo que hay guardado es irrecuperable —ni siquiera se puede listar qué claves
            eran—. Mientras tanto la integración NO cae a las credenciales del entorno: corta, para
            no despachar ni cobrar con la cuenta de otro titular.
          </Text>
          <Text size="small">
            Por eso guardar acá pide confirmación: el guardado normal MERGEA sobre lo que hay, y
            mergear sobre un blob ilegible dejaría la clave nueva y borraría en silencio todas las
            demás. Hay que volver a cargar TODAS las claves de la integración. Si preferís que esta
            tienda vuelva a las credenciales del entorno, usá "Desconectar cuenta propia".
          </Text>
        </div>
      </Alert>
    )}

    <div className="flex flex-col divide-y divide-ui-border-base">
      {integration.keys.map((spec) => (
        <KeyRow
          key={spec.key}
          inputId={`${integration.integration}-${spec.key}`}
          spec={spec}
          // Con el blob ilegible NO hay nombres de claves que mostrar: `set_keys`
          // viene vacío justamente porque no se pudo abrir. Todo va a input abierto.
          stored={!undecryptable && integration.set_keys.includes(spec.key)}
          value={values[spec.key]}
          marked={unset.includes(spec.key)}
          replacing={replacing.includes(spec.key)}
          disabled={busy}
          onChange={(value) => onChange(spec.key, value)}
          onStartReplace={() => onStartReplace(spec.key)}
          onCancelReplace={() => onCancelReplace(spec.key)}
          onToggleDelete={() => onToggleDelete(spec.key)}
        />
      ))}
    </div>

    <OrphanKeys integration={integration} unset={unset} disabled={busy} onToggleDelete={onToggleDelete} />

    {undecryptable && (
      <div className="flex items-start gap-x-2">
        <Checkbox
          id={`${integration.integration}-confirm-replace`}
          checked={confirmReplaceAll}
          disabled={busy}
          onCheckedChange={(checked) => onConfirmReplaceAll(checked === true)}
        />
        <Label size="small" htmlFor={`${integration.integration}-confirm-replace`} className="text-ui-fg-subtle">
          Entiendo que se reemplaza TODO lo guardado de esta integración en esta tienda, y que lo
          que no vuelva a cargar acá se pierde.
        </Label>
      </div>
    )}

    {error && (
      <Text size="small" className="text-ui-fg-error" role="alert">
        {error}
      </Text>
    )}

    <div className="flex flex-wrap items-center justify-end gap-2">
      {dirty && (
        <Button variant="secondary" size="small" disabled={busy} onClick={onDiscard}>
          Descartar cambios
        </Button>
      )}
      <Button size="small" isLoading={saving} disabled={!canSave || busy} onClick={onSave}>
        Guardar
      </Button>
    </div>
  </div>
);
