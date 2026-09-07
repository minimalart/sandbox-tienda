import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useEffect, useState } from 'react';
import { Container, Heading, Button, Input, Label, Select, Text, Badge, Toaster, toast } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import {
  useLoyaltyPrograms,
  useCreateProgram,
  useUpdateProgram,
  type LoyaltyProgram,
} from '../../../hooks/api/loyalty';

type FormState = {
  name: string;
  points_name: string;
  currency_code: string;
  status: 'active' | 'inactive';
  expiration_type: 'none' | 'fixed_days' | 'end_of_year';
  expiration_days: string;
};

const fromProgram = (p: LoyaltyProgram): FormState => ({
  name: p.name ?? '',
  points_name: p.points_name ?? 'puntos',
  currency_code: p.currency_code ?? 'ars',
  status: p.status ?? 'active',
  expiration_type: p.expiration_policy?.type ?? 'none',
  expiration_days: p.expiration_policy?.days ? String(p.expiration_policy.days) : '',
});

const LoyaltyConfigPage = () => {
  const { data, isLoading } = useLoyaltyPrograms();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();

  const program = data?.programs?.find((p) => p.status === 'active') ?? data?.programs?.[0];
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (program) setForm(fromProgram(program));
  }, [program?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const buildPolicy = (f: FormState) => {
    if (f.expiration_type === 'fixed_days') return { type: 'fixed_days', days: Number(f.expiration_days) || 0 };
    return { type: f.expiration_type };
  };

  const onCreate = async () => {
    try {
      await createProgram.mutateAsync({
        name: 'Programa de fidelización',
        points_name: 'puntos',
        currency_code: 'ars',
        status: 'active',
        expiration_policy: { type: 'none' },
      });
      toast.success('Programa creado');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onSave = async () => {
    if (!program || !form) return;
    try {
      await updateProgram.mutateAsync({
        id: program.id,
        name: form.name,
        points_name: form.points_name,
        currency_code: form.currency_code,
        status: form.status,
        expiration_policy: buildPolicy(form),
      });
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">Programa de fidelización</Heading>
          <ExtensionVersion extension="loyalty" />
        </div>
      <SiteScopeBar screen="loyalty/configuracion" />

        {isLoading && (
          <div className="px-6 py-8">
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          </div>
        )}

        {!isLoading && !program && (
          <div className="flex flex-col items-start gap-3 px-6 py-8">
            <Text className="text-ui-fg-subtle">
              Todavía no hay un programa. Creá uno para empezar a acumular puntos.
            </Text>
            <Button onClick={onCreate} isLoading={createProgram.isPending}>
              Crear programa
            </Button>
          </div>
        )}

        {!isLoading && program && form && (
          <div className="flex max-w-2xl flex-col gap-4 px-6 py-6">
            <div className="flex flex-col gap-1">
              <Label size="small">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Nombre de los puntos</Label>
                <Input value={form.points_name} onChange={(e) => set('points_name', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Moneda</Label>
                <Input value={form.currency_code} onChange={(e) => set('currency_code', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Estado</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v as FormState['status'])}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="active">Activo</Select.Item>
                    <Select.Item value="inactive">Inactivo</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Vencimiento de puntos</Label>
                <Select
                  value={form.expiration_type}
                  onValueChange={(v) => set('expiration_type', v as FormState['expiration_type'])}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="none">No vencen</Select.Item>
                    <Select.Item value="fixed_days">A los N días</Select.Item>
                    <Select.Item value="end_of_year">Fin de año</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>

            {form.expiration_type === 'fixed_days' && (
              <div className="flex flex-col gap-1">
                <Label size="small">Días hasta el vencimiento</Label>
                <Input
                  type="number"
                  value={form.expiration_days}
                  onChange={(e) => set('expiration_days', e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={onSave} isLoading={updateProgram.isPending}>
                Guardar
              </Button>
              <Badge color={form.status === 'active' ? 'green' : 'grey'} size="2xsmall">
                {form.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        )}
      </Container>

      {/*
        La card va DEBAJO del programa y no arriba, a propósito: la tasa que
        edita es la del sistema VIEJO y sólo se usa mientras no exista un
        programa activo. Poniéndola arriba parecería el ajuste principal, y lo
        que gobierna la acumulación de verdad son las reglas del programa.
      */}
      <ExtensionSettingsCard
        namespace="extension:loyalty-engine"
        title="Acumulación legacy y entorno"
        description="La tasa de acumulación anterior al motor de reglas: se usa SÓLO mientras no haya un programa activo. Apenas exista uno, mandan sus reglas y este número deja de mirarse."
      />

      {/* No había Toaster en esta pantalla: los `toast` de guardado no se veían. */}
      <Toaster />
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Configuración',
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default LoyaltyConfigPage;
