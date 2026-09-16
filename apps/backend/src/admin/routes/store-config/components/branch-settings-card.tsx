import { Container, Heading, Label, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useStoreSettings, useUpdateStoreSettings } from '../../../hooks/api';

/**
 * "Sucursales" toggles on the Preferencias screen. Replaces the env-var
 * approach: multi-branch mode is enabled/disabled here and read by the
 * storefront via GET /store/store-config.
 */
export const BranchSettingsCard = () => {
  const { data, isPending } = useStoreSettings();
  const [multiBranch, setMultiBranch] = useState(false);
  const [requireCoverage, setRequireCoverage] = useState(false);
  // Arranca en `true`, no en `false` como sus hermanos: es el default del backend, y
  // sembrarlo en `false` haría que el switch se dibuje apagado y salte a prendido
  // cuando llega el fetch.
  const [branchGatePrompt, setBranchGatePrompt] = useState(true);
  const [barcodeScanner, setBarcodeScanner] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    setMultiBranch(data.settings.multi_branch_enabled);
    setRequireCoverage(data.settings.require_branch_coverage);
    setBranchGatePrompt(data.settings.branch_gate_prompt_enabled);
    setBarcodeScanner(data.settings.barcode_scanner_enabled);
  }, [data]);

  const { mutateAsync: save, isPending: saving } = useUpdateStoreSettings({
    onSuccess: () => toast.success('Preferencias de sucursales guardadas'),
    onError: (e) => toast.error(`No se pudo guardar: ${e.message}`),
  });

  const onToggleMultiBranch = async (v: boolean) => {
    setMultiBranch(v);
    await save({ multi_branch_enabled: v });
  };

  const onToggleRequireCoverage = async (v: boolean) => {
    setRequireCoverage(v);
    await save({ require_branch_coverage: v });
  };

  const onToggleBranchGatePrompt = async (v: boolean) => {
    setBranchGatePrompt(v);
    await save({ branch_gate_prompt_enabled: v });
  };

  const onToggleBarcodeScanner = async (v: boolean) => {
    setBarcodeScanner(v);
    await save({ barcode_scanner_enabled: v });
  };

  return (
    // Sin `mb-4`: el wrapper de la pestaña ya separa con `gap-4`, y un margen
    // propio se SUMA a ese gap en vez de reemplazarlo (16 + 16 = 32px). Así es
    // como la separación entre cards creció sin que nadie la pidiera, en las
    // siete cards de esta pantalla. El padre manda el espaciado.
    //
    // ─── POR QUÉ SIGUE SIENDO UN `Container` Y NO UNA SECCIÓN DE LA PÁGINA ──────
    //
    // Esta card vive DENTRO del `Container p-0` de `store-config/page.tsx`, así que
    // hay una sombra adentro de otra. Lo obvio sería bajarla a sección (un `div`
    // con `border-b`, sin sombra, como ya son las dos cajas de la pestaña "Compra
    // mínima"), y sería lo correcto si todos los hijos de la pestaña fueran
    // nuestros. No lo son: `ExtensionSettingsCard` es hermano de esta card en tres
    // de las siete pestañas y es la card RAÍZ en otras diez rutas
    // (email-templates/settings, corporate-detail, companies…), donde tiene que
    // seguir teniendo su chrome propio. Bajar sólo las nuestras a sección deja la
    // pestaña partida en dos lenguajes visuales —dos secciones planas y una card
    // con sombra— que es peor que la sombra duplicada.
    //
    // Entonces: `Container p-0` + header propio `px-6 py-4` + cuerpo `px-6 pb-6`.
    // Es exactamente la forma de `fiscal-docs-card` y de `ExtensionSettingsCard`,
    // y hace que el encabezado de la card caiga en la misma grilla que el de la
    // página. Lo que se unifica es el ritmo del header, no la elevación.
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Sucursales (multi-canal)</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Cuando está activo, la tienda resuelve la sucursal del cliente por la
          dirección (polígonos) y usa el canal/stock/pago de esa sucursal. Apagado:
          la tienda funciona con un único canal (comportamiento estándar).
        </Text>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <Label htmlFor="set-barcode-scanner">Activar scanner presencial</Label>
            <Text size="small" className="text-ui-fg-subtle">
              Muestra en mobile un acceso para escanear códigos de barras y agregar productos al carrito.
            </Text>
          </div>
          <Switch
            id="set-barcode-scanner"
            checked={barcodeScanner}
            onCheckedChange={onToggleBarcodeScanner}
            disabled={isPending || saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <Label htmlFor="set-multi-branch">Activar multi-sucursal</Label>
            <Text size="small" className="text-ui-fg-subtle">
              Muestra el selector de zona en la tienda y resuelve la sucursal al guardar la dirección.
            </Text>
          </div>
          <Switch
            id="set-multi-branch"
            checked={multiBranch}
            onCheckedChange={onToggleMultiBranch}
            disabled={isPending || saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <Label htmlFor="set-branch-gate-prompt">Mostrar el selector de zona en la tienda</Label>
            <Text size="small" className="text-ui-fg-subtle">
              La barra "Ingresá tu dirección para ver productos y envíos de tu zona"
              en todas las páginas, con el buscador de dirección. Apagado, la sucursal
              se sigue resolviendo sola al guardar la dirección y en el checkout. Solo
              aplica con multi-sucursal activo.
            </Text>
          </div>
          {/*
            Sin `|| !multiBranch` en los dos sub-toggles. Con multi-sucursal apagado
            este switch se dibujaba PRENDIDO (su default es `true`) y a la vez gris e
            inerte: el operador lo veía activo, hacía clic y no pasaba nada — "está
            roto". El valor guardado es independiente y el storefront ya exige las
            dos claves para dibujar la barra, así que no hay nada que proteger acá:
            que se pueda apagar (o pre-configurar) aunque multi-sucursal esté apagado.
          */}
          <Switch
            id="set-branch-gate-prompt"
            checked={branchGatePrompt}
            onCheckedChange={onToggleBranchGatePrompt}
            disabled={isPending || saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <Label htmlFor="set-require-coverage">Exigir cobertura en el checkout</Label>
            <Text size="small" className="text-ui-fg-subtle">
              Bloquea el checkout si la dirección no cae en ninguna cobertura. Solo aplica con multi-sucursal activo.
            </Text>
          </div>
          <Switch
            id="set-require-coverage"
            checked={requireCoverage}
            onCheckedChange={onToggleRequireCoverage}
            disabled={isPending || saving}
          />
        </div>
      </div>
    </Container>
  );
};
