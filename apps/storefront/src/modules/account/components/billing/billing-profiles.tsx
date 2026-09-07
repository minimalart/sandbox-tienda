"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { lookupArcaTaxpayer } from "@lib/data/arca-client";
import {
  type BillingFields,
  type BillingProfile,
  type TaxCondition,
  createBillingProfile,
  deleteBillingProfile,
  setDefaultBillingProfile,
  updateBillingProfile,
} from "@lib/data/billing-profile-client";
import { validateCuit } from "@lib/util/cuit";
import FormInput from "@modules/common/components/form-input";
import TaxConditionRadios from "@modules/common/components/tax-condition-radios";
import { useRouter } from "next/navigation";
import { useState } from "react";

const normalizeInvoiceATaxCondition = (
  value: TaxCondition | undefined,
): TaxCondition => (value === "exento" ? "exento" : "responsable_inscripto");

type FormState = BillingFields & { label: string };

const EMPTY: FormState = {
  label: "",
  tax_condition: "responsable_inscripto",
  document_type: "CUIT",
  document_number: "",
  legal_name: "",
  billing_email: "",
  billing_phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  province: "",
  postal_code: "",
  country_code: "ar",
};

type ArcaStatus = "idle" | "loading" | "verified" | "error" | "incompatible";

/** Editar cualquiera de estos campos invalida la verificación de ARCA. */
const ARCA_SENSITIVE_FIELDS: ReadonlySet<keyof FormState> = new Set<
  keyof FormState
>([
  "document_number",
  "legal_name",
  "tax_condition",
  "address_line_1",
  "city",
  "province",
  "postal_code",
]);

export default function BillingProfilesManager({
  initialProfiles,
}: {
  initialProfiles: BillingProfile[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arcaStatus, setArcaStatus] = useState<ArcaStatus>("idle");
  const [arcaMessage, setArcaMessage] = useState<string | null>(null);
  // CUIT primero: el resto de los campos se habilita tras la primera búsqueda
  // en ARCA (éxito O error — nunca bloquea el guardado) o al editar un perfil
  // que ya tiene los datos cargados.
  const [fieldsUnlocked, setFieldsUnlocked] = useState(false);

  const invalidateArca = (k: keyof FormState) => {
    if (!ARCA_SENSITIVE_FIELDS.has(k)) return;
    setArcaStatus((current) => (current === "loading" ? current : "idle"));
    setArcaMessage(null);
  };

  const set = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    invalidateArca(k);
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const setValue = (k: keyof FormState, value: string) => {
    invalidateArca(k);
    setForm((p) => ({ ...p, [k]: value }));
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setArcaStatus("idle");
    setArcaMessage(null);
    setFieldsUnlocked(false);
    setOpen(true);
  };
  const startEdit = (p: BillingProfile) => {
    setEditingId(p.id);
    setForm({
      ...EMPTY,
      ...p,
      label: p.label,
      document_type: "CUIT",
      tax_condition: normalizeInvoiceATaxCondition(p.tax_condition),
    });
    setError(null);
    setArcaStatus("idle");
    setArcaMessage(null);
    setFieldsUnlocked(true);
    setOpen(true);
  };

  const runArcaLookup = async () => {
    if (!validateCuit(form.document_number)) {
      setArcaStatus("error");
      setArcaMessage("Ingresá un CUIT válido para buscar en ARCA.");
      return;
    }
    setArcaStatus("loading");
    setArcaMessage(null);
    const result = await lookupArcaTaxpayer(form.document_number);
    setFieldsUnlocked(true);
    if (!result.ok) {
      setArcaStatus("error");
      setArcaMessage(result.error);
      return;
    }
    const taxpayer = result.data;
    const compatible =
      taxpayer.tax_condition === "responsable_inscripto" ||
      taxpayer.tax_condition === "exento";
    // Autocompleta sin pisar con vacío; email/teléfono siguen manuales.
    setForm((p) => ({
      ...p,
      legal_name: taxpayer.legal_name || p.legal_name,
      label: p.label.trim() || taxpayer.legal_name || p.label,
      ...(compatible ? { tax_condition: taxpayer.tax_condition } : {}),
      address_line_1: taxpayer.address.address_line_1 || p.address_line_1,
      city: taxpayer.address.city || p.city,
      province: taxpayer.address.province || p.province,
      postal_code: taxpayer.address.postal_code || p.postal_code,
    }));
    if (compatible) {
      setArcaStatus("verified");
    } else {
      setArcaStatus("incompatible");
      setArcaMessage(
        "Este CUIT no registra una condición compatible con Factura A. Verificá los datos o continuá a mano.",
      );
    }
  };

  const valid =
    form.label.trim().length > 0 &&
    form.legal_name.trim().length > 0 &&
    validateCuit(form.document_number) &&
    /.+@.+\..+/.test(form.billing_email) &&
    form.address_line_1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.province.trim().length > 0 &&
    form.postal_code.trim().length > 0;

  const save = async () => {
    if (!valid) {
      setError("Revisá los campos: etiqueta, razón social, CUIT válido, email y domicilio.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload: BillingFields & { label: string } = {
      ...form,
      document_type: "CUIT",
      country_code: form.country_code || "ar",
    };
    const res = editingId
      ? await updateBillingProfile(editingId, payload)
      : await createBillingProfile(payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const onDelete = async (id: string) => {
    const res = await deleteBillingProfile(id);
    if (res.ok) router.refresh();
  };
  const onSetDefault = async (id: string) => {
    const res = await setDefaultBillingProfile(id);
    if (res.ok) router.refresh();
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">
          Guardá tus datos de Factura A para reutilizarlos en el checkout.
        </p>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-[--primary-color] px-3 py-2 font-semibold text-sm text-white shadow-xs transition hover:opacity-90"
          onClick={startCreate}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          Agregar perfil
        </button>
      </div>

      {initialProfiles.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 p-6 text-gray-500 text-sm">
          Todavía no tenés perfiles de facturación.
        </p>
      ) : (
        <div className="space-y-3">
          {initialProfiles.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{p.label}</span>
                  {p.is_default ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 text-xs">
                      Predeterminado
                    </span>
                  ) : null}
                </div>
                <p className="text-gray-600 text-sm">{p.legal_name}</p>
                <p className="text-gray-400 text-xs">
                  CUIT {p.document_number} · {p.tax_condition}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!p.is_default ? (
                  <button
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-600 text-xs"
                    onClick={() => onSetDefault(p.id)}
                    type="button"
                  >
                    Hacer default
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-600 text-xs"
                  onClick={() => startEdit(p)}
                  type="button"
                >
                  Editar
                </button>
                <button
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-600 text-xs"
                  onClick={() => onDelete(p.id)}
                  type="button"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog className="relative z-[10000]" onClose={close} open={open}>
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <button
                aria-label="Cerrar"
                className="absolute top-3 right-3 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                disabled={busy}
                onClick={close}
                type="button"
              >
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
              <DialogTitle
                as="h3"
                className="mb-4 text-center font-semibold text-gray-900 text-lg"
              >
                {editingId ? "Editar perfil" : "Nuevo perfil de facturación"}
              </DialogTitle>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* CUIT primero: busca en ARCA y habilita el resto de los campos. */}
                <div className="flex items-start gap-2 sm:col-span-2">
                  <div className="min-w-0 flex-1">
                    <FormInput
                      label="CUIT"
                      placeholder="30-12345678-9"
                      required
                      inputMode="numeric"
                      value={form.document_number}
                      onChange={set("document_number")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={runArcaLookup}
                    disabled={
                      arcaStatus === "loading" ||
                      !validateCuit(form.document_number)
                    }
                    className="h-[44px] shrink-0 whitespace-nowrap rounded-[14px] border border-[--primary-color] px-3 font-medium text-[--primary-color] text-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {arcaStatus === "loading" ? "Buscando..." : "Buscar en ARCA"}
                  </button>
                </div>
                {arcaStatus === "verified" ? (
                  <p className="text-green-600 text-xs sm:col-span-2">
                    ✓ Datos encontrados en ARCA. Revisalos y completá el email.
                  </p>
                ) : null}
                {arcaStatus === "incompatible" && arcaMessage ? (
                  <p className="text-amber-600 text-xs sm:col-span-2">
                    {arcaMessage}
                  </p>
                ) : null}
                {arcaStatus === "error" && arcaMessage ? (
                  <p className="text-red-500 text-xs sm:col-span-2">
                    {arcaMessage}
                  </p>
                ) : null}
                {!fieldsUnlocked ? (
                  <p className="text-gray-500 text-xs sm:col-span-2">
                    Ingresá el CUIT y tocá "Buscar en ARCA" para habilitar el
                    resto de los datos.
                  </p>
                ) : null}
                <FormInput
                  label="Etiqueta"
                  placeholder="Ej: Mi empresa"
                  required
                  disabled={!fieldsUnlocked}
                  value={form.label}
                  onChange={set("label")}
                />
                <FormInput
                  label="Razón social"
                  placeholder="Ej: Acme S.A."
                  required
                  disabled={!fieldsUnlocked}
                  value={form.legal_name}
                  onChange={set("legal_name")}
                />
                <TaxConditionRadios
                  name="billing-tax-condition"
                  disabled={!fieldsUnlocked}
                  value={
                    form.tax_condition === "exento"
                      ? "exento"
                      : "responsable_inscripto"
                  }
                  onChange={(value) => setValue("tax_condition", value)}
                />
                <FormInput
                  label="Teléfono (opcional)"
                  placeholder="Ej: 11 5555-5555"
                  disabled={!fieldsUnlocked}
                  value={form.billing_phone ?? ""}
                  onChange={set("billing_phone")}
                />
                <FormInput
                  label="Email de facturación"
                  placeholder="facturacion@empresa.com"
                  required
                  type="email"
                  disabled={!fieldsUnlocked}
                  value={form.billing_email}
                  onChange={set("billing_email")}
                />
                <FormInput
                  className="sm:col-span-2"
                  label="Domicilio fiscal"
                  placeholder="Ej: Av. Siempreviva 742"
                  required
                  disabled={!fieldsUnlocked}
                  value={form.address_line_1}
                  onChange={set("address_line_1")}
                />
                <FormInput
                  label="Localidad"
                  placeholder="Ej: Córdoba"
                  required
                  disabled={!fieldsUnlocked}
                  value={form.city}
                  onChange={set("city")}
                />
                <FormInput
                  label="Provincia"
                  placeholder="Ej: Buenos Aires"
                  required
                  disabled={!fieldsUnlocked}
                  value={form.province}
                  onChange={set("province")}
                />
                <FormInput
                  label="Código postal"
                  placeholder="Ej: 1414"
                  required
                  disabled={!fieldsUnlocked}
                  value={form.postal_code}
                  onChange={set("postal_code")}
                />
              </div>

              {error ? (
                <p className="mt-2 text-red-500 text-sm">{error}</p>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  className="rounded-xl bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white disabled:opacity-50"
                  disabled={busy || !fieldsUnlocked}
                  onClick={save}
                  type="button"
                >
                  {busy ? "Guardando..." : "Guardar"}
                </button>
                <button
                  className="rounded-xl border border-gray-300 px-4 py-2 text-gray-600 text-sm"
                  disabled={busy}
                  onClick={close}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
