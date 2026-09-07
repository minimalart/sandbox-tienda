import { Button, Container, Heading, Label, Select, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { sdk } from '../../../lib/client';

const COUNTRIES = [
  { code: 'ar', label: 'Argentina' },
  { code: 'br', label: 'Brasil' },
  { code: 'cl', label: 'Chile' },
  { code: 'co', label: 'Colombia' },
  { code: 'es', label: 'España' },
  { code: 'us', label: 'Estados Unidos' },
  { code: 'mx', label: 'México' },
  { code: 'py', label: 'Paraguay' },
  { code: 'pe', label: 'Perú' },
  { code: 'uy', label: 'Uruguay' },
];

const CURRENCIES = [
  { code: 'ars', label: 'ARS · Peso argentino' },
  { code: 'brl', label: 'BRL · Real brasileño' },
  { code: 'clp', label: 'CLP · Peso chileno' },
  { code: 'cop', label: 'COP · Peso colombiano' },
  { code: 'usd', label: 'USD · Dólar estadounidense' },
  { code: 'eur', label: 'EUR · Euro' },
  { code: 'mxn', label: 'MXN · Peso mexicano' },
  { code: 'pyg', label: 'PYG · Guaraní' },
  { code: 'pen', label: 'PEN · Sol peruano' },
  { code: 'uyu', label: 'UYU · Peso uruguayo' },
];

const LOCALES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'pt', label: 'Portugués' },
];

type Plan = {
  operations: Array<{ type: string; currency_code?: string; country_code?: string; locale?: string }>;
  safeguards?: string[];
};

const countryLabel = (code?: string) => COUNTRIES.find((item) => item.code === code)?.label ?? code?.toUpperCase() ?? '';

function operationLabel(operation: Plan['operations'][number]): string {
  switch (operation.type) {
    case 'add_store_currency':
      return `Agregar la moneda ${operation.currency_code?.toUpperCase()} a la tienda.`;
    case 'create_region':
      return `Crear una región para ${countryLabel(operation.country_code)} con moneda ${operation.currency_code?.toUpperCase()}.`;
    case 'save_site_configuration':
      return `Guardar país, moneda e idioma (${operation.locale}) en la configuración del sitio.`;
    default:
      return operation.type;
  }
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ code: string; label: string }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label size="small" weight="plus">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <Select.Trigger><Select.Value /></Select.Trigger>
        <Select.Content>
          {options.map((option) => <Select.Item key={option.code} value={option.code}>{option.label}</Select.Item>)}
        </Select.Content>
      </Select>
    </div>
  );
}

/**
 * Commerce card — país, moneda e idioma de la INSTANCIA. Aplica sobre el Store y las
 * regiones de Medusa, no sobre una tienda: cada tienda ya recibe su propia región al
 * provisionarse.
 *
 * Vivía en la extensión site-manager (pantalla "Sitio", namespace `commerce`); se
 * mudó acá al desmantelarla, junto con sus dos endpoints. Persiste en `store_setting`
 * bajo `commerce_config`.
 *
 * Consume: POST /admin/store-config/commerce/plan y .../apply
 */
export function CommerceCard() {
  const [country, setCountry] = useState('ar');
  const [currency, setCurrency] = useState('ars');
  const [locale, setLocale] = useState('es');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [working, setWorking] = useState(false);

  const preview = async () => {
    setWorking(true);
    try {
      setPlan(await sdk.client.fetch<Plan>('/admin/store-config/commerce/plan', { method: 'POST', body: { country_code: country, currency_code: currency, locale } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo calcular el plan');
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    setWorking(true);
    try {
      await sdk.client.fetch('/admin/store-config/commerce/apply', { method: 'POST', body: { country_code: country, currency_code: currency, locale, confirmed: true } });
      toast.success('Configuración comercial aplicada');
      setPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar');
    } finally {
      setWorking(false);
    }
  };

  return (
    // `p-0` + header propio: la forma única de las cards de esta pantalla, ver
    // `branch-settings-card` para por qué no bajan a sección.
    <Container className="max-w-2xl p-0">
      <div className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h2">Comercio</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          País, moneda e idioma de esta instancia. Antes de aplicar cambios siempre se muestra un
          resumen de lo que se va a crear: nunca se eliminan regiones ni monedas, y los precios
          existentes no se convierten.
        </Text>
      </div>

      <div className="flex flex-col gap-5 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FieldSelect label="País" value={country} onChange={(value) => { setCountry(value); setPlan(null); }} options={COUNTRIES} />
          <FieldSelect label="Moneda" value={currency} onChange={(value) => { setCurrency(value); setPlan(null); }} options={CURRENCIES} />
          <FieldSelect label="Idioma" value={locale} onChange={(value) => { setLocale(value); setPlan(null); }} options={LOCALES} />
        </div>
        <div><Button onClick={preview} isLoading={working && !plan}>Ver qué va a cambiar</Button></div>
        {plan && (
          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <Text size="small" weight="plus">Al confirmar se va a:</Text>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {plan.operations.map((operation, index) => (
                <li key={index}><Text size="small">{operationLabel(operation)}</Text></li>
              ))}
            </ul>
            <Text size="xsmall" className="text-ui-fg-muted">
              No se eliminan regiones, monedas ni precios, y los precios existentes nunca se convierten automáticamente.
            </Text>
            <div><Button onClick={apply} isLoading={working}>Confirmar y aplicar</Button></div>
          </div>
        )}
      </div>
    </Container>
  );
}
