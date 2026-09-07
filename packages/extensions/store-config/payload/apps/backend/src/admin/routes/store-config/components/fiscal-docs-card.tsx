import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { useActiveSite } from '../../../hooks/use-active-site';
import { fetchJson } from '../../../lib/http';

/**
 * "Documentación Fiscal" en la pantalla Preferencias. Lee/escribe el setting
 * versionado del site-manager vía /admin/fiscal-documents/config.
 *
 * Antes vivía como ruta propia (/app/fiscal-documentation); se movió acá como
 * una pestaña más para no ocupar un ítem propio en el sidebar. El módulo backend
 * y la API de config no cambian (b2b/corporate los siguen usando).
 *
 * ─── LA SECCIÓN "CONEXIÓN CON ARCA" ES DE SÓLO LECTURA, Y A PROPÓSITO ────────
 *
 * Lo que muestra sale de DOS almacenes que esta card no toca: `site_setting` (los
 * descriptores `ARCA_*`, editables en "Ajustes de extensiones") y `site_credential`
 * (el certificado y la clave, editables en "Integraciones → Globales → ARCA / AFIP"). Duplicar acá
 * los inputs sería una tercera pantalla escribiendo los mismos valores, que es
 * exactamente el problema que `shared-env-ownership.test.ts` existe para evitar.
 *
 * Lo que sí aporta, y no aporta ninguna de las otras dos, es GRITAR CONTRA QUÉ
 * ENTORNO DE AFIP se está operando. Homologación y producción se ven idénticos
 * desde el checkout: la única diferencia visible aparece cuando ya es tarde.
 */

const CONFIG_URL = '/admin/fiscal-documents/config';

type FiscalConfig = {
  arca_enabled: boolean;
  auto_pdf: boolean;
  update_owner_data: boolean;
  keep_history: boolean;
  max_versions: number | null;
  pdf_brand_name: string;
  pdf_footer: string;
  logo_url: string | null;
};

/**
 * Estado de la conexión con ARCA. Espejo de `ArcaConfigStatus` del backend.
 *
 * SÓLO BOOLEANOS para el certificado y la clave. No hay ni una "cola de cuatro"
 * como la que muestra el buscador de ajustes para otros secretos: el final de un
 * PEM en base64 es igual en todos, así que no distingue nada, y serían bytes de una
 * clave privada saliendo del backend por nada.
 */
type ArcaStatus = {
  environment: 'homologacion' | 'production';
  service: string;
  cuit_present: boolean;
  certificate_present: boolean;
  private_key_present: boolean;
  uses_legacy_path: boolean;
  credentials_source: 'site' | 'instance' | 'undecryptable';
  site_id: string | null;
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-ui-border-base border-b py-3">
      <div className="flex flex-col">
        <Text size="small" weight="plus">
          {label}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {description}
        </Text>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * "Falta" / "Cargado" para una pieza de la identidad fiscal.
 *
 * El rojo no es decorativo: sin cualquiera de las tres, la consulta a ARCA no sale.
 * Y si la tienda activa no es la principal, "Falta" significa que hay que cargarla
 * PARA ESTA TIENDA — no hereda la de la instancia a propósito.
 */
const PieceRow = ({ label, present, hint }: { label: string; present: boolean; hint: string }) => (
  <div className="flex items-start justify-between gap-4 border-ui-border-base border-b py-2">
    <div className="flex flex-col">
      <Text size="small">{label}</Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {hint}
      </Text>
    </div>
    <StatusBadge color={present ? 'green' : 'red'}>{present ? 'Cargado' : 'Falta'}</StatusBadge>
  </div>
);

/**
 * El bloque que grita el entorno.
 *
 * Producción va en rojo y no en verde aunque sea "el estado normal" de una
 * instalación viva: el color acá no dice "está bien configurado", dice "lo que hagas
 * tiene efectos ante AFIP". Es el mismo criterio que el rojo de `off`/`unset` en el
 * buscador de ajustes — señala dónde mirar, no si está bien.
 */

const ArcaConnection = ({ arca }: { arca: ArcaStatus }) => {
  const isProduction = arca.environment === 'production';
  const broken = arca.credentials_source === 'undecryptable';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="small" weight="plus">
          Conexión con ARCA
        </Text>
        <StatusBadge color={isProduction ? 'green' : 'orange'}>
          {isProduction ? 'Producción (consulta del padrón)' : 'Homologación (pruebas)'}
        </StatusBadge>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Cuenta global de Minimalart para consultar CUITs.
        </Text>
      </div>

      {/* Es el único estado en el que la tienda PARECE configurada y no puede
          operar. Sin este cartel, se descubre recién cuando falla una emisión y el
          mensaje que llega es un 424 que no apunta a las credenciales. */}
      {broken && (
        <div className="rounded-md border border-ui-tag-red-border bg-ui-tag-red-bg px-4 py-3">
          <Text size="xsmall" className="text-ui-tag-red-text">
            No se pueden descifrar las credenciales globales de ARCA. Revisá la clave de cifrado
            o volvé a cargar la cuenta en Integraciones → Globales → ARCA / AFIP.
          </Text>
        </div>
      )}

      <div>
        <PieceRow
          label="CUIT de Minimalart"
          present={arca.cuit_present}
          hint="Se configura junto al certificado en Integraciones → Globales → ARCA / AFIP."
        />
        <PieceRow
          label="Certificado X.509"
          present={arca.certificate_present}
          hint="Se carga en Integraciones → Globales → ARCA / AFIP. Nunca se muestra: sólo se reemplaza."
        />
        <PieceRow
          label="Clave privada"
          present={arca.private_key_present}
          hint="Se carga junto con el certificado. No sale del backend bajo ninguna forma."
        />
      </div>

      {/* Se cayó la enumeración de dónde se edita cada pieza: las tres `PieceRow` de
          arriba ya lo dicen una por una, en su propio `hint`, y repetirlo acá era la
          misma navegación dos veces —una en abstracto, más lejos del renglón que le
          corresponde. Lo que no está en ninguna fila es el servicio, que es DATO y por
          eso se queda en línea. */}
      <Text size="xsmall" className="text-ui-fg-subtle">
        Servicio WSAA: <span className="font-mono">{arca.service}</span>. Acá se muestran para poder
        verificar de un vistazo con qué identidad se está consultando.
      </Text>

      {arca.uses_legacy_path && (
        <div className="rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg px-4 py-3">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            El certificado o la clave se están leyendo de un archivo del contenedor
            (ARCA_CERTIFICATE_PATH / ARCA_PRIVATE_KEY_PATH). Ese archivo se pierde en cada deploy y
            cargá el par en “Integraciones → Globales → ARCA / AFIP”, que tiene
            prioridad sobre el archivo.
          </Text>
        </div>
      )}
    </div>
  );
};

export const FiscalDocsCard = () => {
  const qc = useQueryClient();
  /**
   * La tienda entra en la QUERY KEY además de viajar en el header.
   *
   * El header solo no alcanza: react-query cachea por key, así que con una key
   * constante la config de la tienda A se servía desde caché al abrir la B. Es la
   * misma condición que documenta `SetActiveSiteOptions` en `lib/active-site.ts`.
   */
  const { activeId } = useActiveSite();
  const configKey = ['fiscal-config', activeId] as const;
  const { data, isLoading } = useQuery({
    queryKey: configKey,
    queryFn: () => fetchJson<{ config: FiscalConfig; arca: ArcaStatus | null }>(CONFIG_URL),
  });

  const [form, setForm] = useState<FiscalConfig | null>(null);
  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data]);

  const save = useMutation({
    mutationFn: (config: FiscalConfig) =>
      fetchJson<{ config: FiscalConfig }>(CONFIG_URL, {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    onSuccess: (res) => {
      // MERGE y no reemplazo: el POST devuelve sólo `{ config }`, así que pisar la
      // entrada entera borraría el `arca` que trajo el GET y la sección de conexión
      // desaparecería al guardar cualquier otra cosa.
      qc.setQueryData(
        configKey,
        (previous: { config: FiscalConfig; arca: ArcaStatus | null } | undefined) => ({
          arca: previous?.arca ?? null,
          config: res.config,
        }),
      );
      toast.success('Configuración guardada.');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const set = <K extends keyof FiscalConfig>(key: K, value: FiscalConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    // Sin `mb-4`: el espaciado vertical lo pone el wrapper de la pestaña. Un
    // margen propio se suma al del padre en vez de reemplazarlo.
    <Container className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">Documentación Fiscal</Heading>
          <ExtensionVersion extension="fiscal-documentation" />
        </div>
        <div className="flex items-center gap-2">
          {/*
            El drawer de la EXTENSIÓN cuelga de esta card y no del header de
            Preferencias, que ya tiene el suyo (`store-config`). No se pisan: el de
            arriba explica por qué las siete pestañas no tienen el mismo alcance; éste
            explica ARCA —el entorno que se ve idéntico desde el checkout, el par
            certificado/clave que se mueve de a una pieza— que es de esta extensión y
            de ninguna otra pestaña.
          */}
          <HelpDrawer slug="fiscal-documentation" />
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={!form}
            onClick={() => form && save.mutate(form)}
          >
            Guardar
          </Button>
        </div>
      </div>

      {isLoading || !form ? (
        <div className="px-6 pb-6">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 pb-6">
          {/* Primero el entorno: es lo que hay que ver ANTES de tocar cualquier
              interruptor de abajo. */}
          {data?.arca && <ArcaConnection arca={data.arca} />}

          <div>
            <Text size="small" weight="plus" className="mb-1">
              Integración
            </Text>
            <ToggleRow
              label="Habilitar integración ARCA"
              description="Permite consultar constancias en ARCA desde las empresas."
              checked={form.arca_enabled}
              onChange={(v) => set('arca_enabled', v)}
            />
            <ToggleRow
              label="Generar PDF automáticamente"
              description="Al consultar, genera y guarda la constancia en PDF."
              checked={form.auto_pdf}
              onChange={(v) => set('auto_pdf', v)}
            />
            <ToggleRow
              label="Actualizar datos de la empresa"
              description="Copia razón social, CUIT y metadata fiscal a la empresa consultada."
              checked={form.update_owner_data}
              onChange={(v) => set('update_owner_data', v)}
            />
            <ToggleRow
              label="Mantener historial"
              description="Conserva todas las versiones. Si se desactiva, solo queda la vigente."
              checked={form.keep_history}
              onChange={(v) => set('keep_history', v)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Text size="small" weight="plus">
              Retención y plantilla
            </Text>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Cantidad máxima de versiones (vacío = sin límite)</Label>
              <Input
                type="number"
                min={1}
                value={form.max_versions ?? ''}
                onChange={(e) =>
                  set('max_versions', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Marca institucional (encabezado del PDF)</Label>
              <Input
                value={form.pdf_brand_name}
                onChange={(e) => set('pdf_brand_name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Logo (URL PNG, opcional)</Label>
              <Input
                placeholder="https://…/logo.png"
                value={form.logo_url ?? ''}
                onChange={(e) => set('logo_url', e.target.value || null)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Pie institucional del PDF</Label>
              <Textarea
                rows={3}
                value={form.pdf_footer}
                onChange={(e) => set('pdf_footer', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Container>
  );
};

/**
 * La pestaña completa: la config de la extensión arriba y los ajustes de ARCA abajo.
 *
 * Son DOS cards y no una porque son dos almacenes con dos ciclos de guardado
 * distintos —`config` va por `/admin/fiscal-documents/config`, los `ARCA_*` por la
 * API de `app-settings` con su propio locking optimista por revisión— y un solo
 * botón "Guardar" para las dos haría que un conflicto en una dejara la otra a medias.
 *
 * La segunda se monta SIN `groups` a propósito: muestra el namespace entero, así que
 * un grupo nuevo en el descriptor aparece solo. Con la lista literal habría que
 * acordarse de agregarlo acá, y el síntoma de olvidarse es un ajuste que existe en la
 * API y no se ve en la pantalla — exactamente lo que `card-coverage.test.ts` mide.
 *
 * El certificado y la clave privada aparecen ahí como campos `secret`
 * (write-only, sin preview) y son la capa de INSTANCIA. La capa POR TIENDA se carga
 * en “Integraciones → Globales → ARCA / AFIP”, que es la que pisa: ver la nota 2 del descriptor.
 *
 * `hideSiteContext` en la card de ajustes: `store-config/page.tsx` monta un
 * `SiteScopeBar` propio arriba de las siete pestañas, visible sin importar cuál
 * esté activa. Sin este flag, entrar a esta pestaña mostraría UN SEGUNDO control
 * de tienda activa —el de `ExtensionSettingsCard`— apenas debajo del primero.
 */
export const FiscalDocsTab = () => (
  <>
    <FiscalDocsCard />
    {/*
      `description` de UNA oración. La segunda mitad —instancia vs. “Credenciales por
      tienda”, y cuál de las dos gana— se dijo hasta ahora en TRES lugares: esta línea,
      la sección "Fiscal" del drawer de `store-config` y la sección "El certificado y el
      CUIT se mueven de a una pieza" del drawer de `fiscal-documentation`. Queda en los
      drawers y no acá, porque acá era la única de las tres que no podía explicar el
      corolario que hace útil la regla: una tienda sin lo suyo NO hereda, queda apagada.
      Un `description` de dos oraciones no tiene lugar para eso, y sin eso la precedencia
      se lee como un detalle de implementación.
    */}
    <ExtensionSettingsCard
      namespace="extension:fiscal-documentation"
      description="Con qué identidad fiscal y contra qué entorno de AFIP se consulta."
      hideSiteContext
    />
  </>
);
