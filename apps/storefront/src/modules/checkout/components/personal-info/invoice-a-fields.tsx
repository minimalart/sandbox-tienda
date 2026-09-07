"use client";

import {
  type BillingFields,
  type BillingProfile,
  associateCartBillingProfile,
  createBillingProfile,
  listBillingProfiles,
} from "@lib/data/billing-profile-client";
import { lookupArcaTaxpayer } from "@lib/data/arca-client";
import { validateCuit } from "@lib/util/cuit";
import CheckboxInput from "@modules/common/components/checkbox-input";
import FormInput from "@modules/common/components/form-input";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import TaxConditionRadios from "@modules/common/components/tax-condition-radios";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

export type InvoiceAHandle = {
  /** true si el bloque es válido para avanzar (o si Factura A está desactivada). */
  validate: () => boolean;
  /** Persiste la selección/datos al cart. Devuelve ok/error. */
  persist: () => Promise<{ ok: boolean; error?: string }>;
};

type Props = {
  cartId: string | null;
  isLoggedIn: boolean;
  initialMetadata?: Record<string, unknown> | null;
};

const normalizeInvoiceATaxCondition = (
  value: BillingFields["tax_condition"] | undefined,
): BillingFields["tax_condition"] =>
  value === "exento" ? "exento" : "responsable_inscripto";

const EMPTY: BillingFields = {
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

const inputCls =
  "h-[44px] w-full rounded-[14px] border-[0.8px] border-[--input-border] px-4 text-base outline-none transition-colors focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]";

type ArcaStatus = "idle" | "loading" | "verified" | "error" | "incompatible";

/** Editar cualquiera de estos campos invalida la verificación de ARCA. */
const ARCA_SENSITIVE_FIELDS: ReadonlySet<keyof BillingFields> = new Set<
  keyof BillingFields
>([
  "document_number",
  "legal_name",
  "tax_condition",
  "address_line_1",
  "city",
  "province",
  "postal_code",
]);

const InvoiceAFields = forwardRef<InvoiceAHandle, Props>(
  ({ cartId, isLoggedIn, initialMetadata }, ref) => {
    const meta = (initialMetadata ?? {}) as Record<string, unknown>;
    const initiallyEnabled = meta.invoice_type === "invoice_a";
    const initialSnapshot = (meta.billing_snapshot ?? null) as Partial<BillingFields> | null;
    const initialProfileId = (meta.billing_profile_id as string) ?? "";

    const [enabled, setEnabled] = useState(initiallyEnabled);
    const [profiles, setProfiles] = useState<BillingProfile[]>([]);
    const [mode, setMode] = useState<"saved" | "new">(
      initialProfileId ? "saved" : "new",
    );
    const [selectedProfileId, setSelectedProfileId] = useState(initialProfileId);
    const [fields, setFields] = useState<BillingFields>({
      ...EMPTY,
      ...(initialSnapshot ?? {}),
      tax_condition: normalizeInvoiceATaxCondition(
        initialSnapshot?.tax_condition,
      ),
    });
    const [saveForFuture, setSaveForFuture] = useState(false);
    const [touched, setTouched] = useState(false);
    // Rehidrata el "verificado en ARCA" si el snapshot del cart ya lo traía.
    const [arcaStatus, setArcaStatus] = useState<ArcaStatus>(
      initialSnapshot?.arca_verified ? "verified" : "idle",
    );
    const [arcaMessage, setArcaMessage] = useState<string | null>(null);
    const [arcaVerifiedAt, setArcaVerifiedAt] = useState<string | null>(
      initialSnapshot?.arca_verified_at ?? null,
    );
    const [arcaVerifiedCuit, setArcaVerifiedCuit] = useState<string | null>(
      initialSnapshot?.arca_lookup_cuit ?? null,
    );
    // CUIT primero: el resto de los campos se habilita tras la primera
    // búsqueda en ARCA (éxito O error — nunca bloquea el checkout) o si el
    // form rehidrata datos ya cargados del snapshot del cart.
    const [fieldsUnlocked, setFieldsUnlocked] = useState(
      Boolean(initialSnapshot?.legal_name),
    );
    const invoiceAProfiles = profiles.filter(
      (profile) =>
        profile.tax_condition === "responsable_inscripto" ||
        profile.tax_condition === "exento",
    );

    // Cargar perfiles guardados (logueado).
    useEffect(() => {
      if (!isLoggedIn) return;
      let active = true;
      listBillingProfiles().then((list) => {
        if (!active) return;
        const validProfiles = list.filter(
          (profile) =>
            profile.tax_condition === "responsable_inscripto" ||
            profile.tax_condition === "exento",
        );
        setProfiles(list);
        if (
          initialProfileId &&
          !validProfiles.some((profile) => profile.id === initialProfileId)
        ) {
          setMode("new");
          setSelectedProfileId("");
          return;
        }
        // Preseleccionar default si no había selección previa.
        if (!initialProfileId && validProfiles.length > 0) {
          const def = validProfiles.find((p) => p.is_default) ?? validProfiles[0];
          if (def) {
            setMode("saved");
            setSelectedProfileId(def.id);
          }
        }
      });
      return () => {
        active = false;
      };
    }, [isLoggedIn, initialProfileId]);

    const invalidateArca = (k: keyof BillingFields) => {
      if (!ARCA_SENSITIVE_FIELDS.has(k)) return;
      setArcaStatus((current) => (current === "loading" ? current : "idle"));
      setArcaMessage(null);
    };

    const set = (k: keyof BillingFields) => (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
      invalidateArca(k);
      setFields((p) => ({ ...p, [k]: e.target.value }));
    };

    const setValue = (k: keyof BillingFields, value: string) => {
      invalidateArca(k);
      setFields((p) => ({ ...p, [k]: value }));
    };

    const runArcaLookup = async () => {
      if (!validateCuit(fields.document_number)) {
        setArcaStatus("error");
        setArcaMessage("Ingresá un CUIT válido para buscar en ARCA.");
        return;
      }
      setArcaStatus("loading");
      setArcaMessage(null);
      const result = await lookupArcaTaxpayer(fields.document_number);
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
      setFields((p) => ({
        ...p,
        legal_name: taxpayer.legal_name || p.legal_name,
        ...(compatible ? { tax_condition: taxpayer.tax_condition } : {}),
        address_line_1: taxpayer.address.address_line_1 || p.address_line_1,
        city: taxpayer.address.city || p.city,
        province: taxpayer.address.province || p.province,
        postal_code: taxpayer.address.postal_code || p.postal_code,
      }));
      if (compatible) {
        setArcaStatus("verified");
        setArcaVerifiedAt(taxpayer.verified_at);
        setArcaVerifiedCuit(taxpayer.cuit);
      } else {
        setArcaStatus("incompatible");
        setArcaMessage(
          "Este CUIT no registra una condición compatible con Factura A. Verificá los datos o continuá a mano.",
        );
      }
    };

    const newDataValid = (): boolean =>
      fields.legal_name.trim().length > 0 &&
      validateCuit(fields.document_number) &&
      /.+@.+\..+/.test(fields.billing_email) &&
      fields.address_line_1.trim().length > 0 &&
      fields.city.trim().length > 0 &&
      fields.province.trim().length > 0 &&
      fields.postal_code.trim().length > 0;

    useImperativeHandle(ref, () => ({
      validate: () => {
        if (!enabled) return true;
        if (mode === "saved") {
          return invoiceAProfiles.some(
            (profile) => profile.id === selectedProfileId,
          );
        }
        return newDataValid();
      },
      persist: async () => {
        if (!cartId) return { ok: false, error: "Carrito no disponible." };
        if (!enabled) {
          return associateCartBillingProfile(cartId, {
            invoice_type: "final_consumer",
          });
        }
        if (mode === "saved") {
          if (
            !invoiceAProfiles.some(
              (profile) => profile.id === selectedProfileId,
            )
          )
            return { ok: false, error: "Elegí un perfil de facturación." };
          return associateCartBillingProfile(cartId, {
            billing_profile_id: selectedProfileId,
          });
        }
        // mode new
        if (!newDataValid())
          return { ok: false, error: "Revisá los datos fiscales (CUIT, email, domicilio)." };
        // Descarta arca_* rehidratados del snapshot: la verificación vigente
        // la aporta el estado de este componente (y el backend re-valida).
        const {
          arca_verified: _staleVerified,
          arca_verified_at: _staleVerifiedAt,
          arca_lookup_cuit: _staleLookupCuit,
          ...editableFields
        } = fields;
        const cleanCuit = fields.document_number.replace(/\D/g, "");
        const data: BillingFields = {
          ...editableFields,
          document_type: "CUIT",
          country_code: fields.country_code || "ar",
          label: fields.label?.trim() || fields.legal_name,
          ...(arcaStatus === "verified" && arcaVerifiedCuit === cleanCuit
            ? {
                arca_verified: true,
                arca_verified_at: arcaVerifiedAt,
                arca_lookup_cuit: arcaVerifiedCuit,
              }
            : {}),
        };
        if (saveForFuture && isLoggedIn) {
          const created = await createBillingProfile({ ...data, is_default: profiles.length === 0 });
          if (!created.ok) return created;
          return associateCartBillingProfile(cartId, {
            billing_profile_id: created.data!.id,
          });
        }
        return associateCartBillingProfile(cartId, {
          invoice_type: "invoice_a",
          billing_data: data,
        });
      },
    }));

    const showError = touched && enabled;

    return (
      <div className="mt-4 rounded-[14px] border border-gray-200 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <CheckboxInput
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-medium text-gray-800">Necesito Factura A</span>
        </label>

        {enabled ? (
          <div className="mt-3 space-y-3" onBlur={() => setTouched(true)}>
            {isLoggedIn && invoiceAProfiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("saved")}
                    className={`rounded-lg border px-3 py-1.5 ${mode === "saved" ? "border-[--primary-color] text-[--primary-color]" : "border-gray-200 text-gray-600"}`}
                  >
                    Usar perfil guardado
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("new")}
                    className={`rounded-lg border px-3 py-1.5 ${mode === "new" ? "border-[--primary-color] text-[--primary-color]" : "border-gray-200 text-gray-600"}`}
                  >
                    Crear nuevo
                  </button>
                </div>
                {mode === "saved" ? (
                  <ResponsiveCombobox
                    id="invoice-a-billing-profile"
                    placeholder="Elegí un perfil..."
                    searchPlaceholder="Buscar perfil..."
                    triggerClassName={inputCls}
                    value={selectedProfileId}
                    onValueChange={setSelectedProfileId}
                    options={[
                      { value: "", label: "Elegí un perfil..." },
                      ...invoiceAProfiles.map((p) => ({
                        value: p.id,
                        label: `${p.label} - ${p.legal_name} (${p.document_number})`,
                      })),
                    ]}
                  />
                ) : null}
              </div>
            ) : null}

            {mode === "new" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* CUIT primero: busca en ARCA y habilita el resto de los campos. */}
                <div className="flex items-start gap-2 sm:col-span-2">
                  <div className="min-w-0 flex-1">
                    <FormInput
                      label="CUIT"
                      placeholder="30-12345678-9"
                      required
                      inputMode="numeric"
                      value={fields.document_number}
                      onChange={set("document_number")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={runArcaLookup}
                    disabled={
                      arcaStatus === "loading" ||
                      !validateCuit(fields.document_number)
                    }
                    className="h-[44px] shrink-0 whitespace-nowrap rounded-[14px] border border-[--primary-color] px-3 text-sm font-medium text-[--primary-color] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="text-amber-600 text-xs sm:col-span-2">{arcaMessage}</p>
                ) : null}
                {arcaStatus === "error" && arcaMessage ? (
                  <p className="text-red-500 text-xs sm:col-span-2">{arcaMessage}</p>
                ) : null}
                {!fieldsUnlocked ? (
                  <p className="text-gray-500 text-xs sm:col-span-2">
                    Ingresá el CUIT y tocá "Buscar en ARCA" para habilitar el resto de los datos.
                  </p>
                ) : null}
                <FormInput
                  label="Razón social"
                  placeholder="Ej: Acme S.A."
                  required
                  disabled={!fieldsUnlocked}
                  value={fields.legal_name}
                  onChange={set("legal_name")}
                />
                <TaxConditionRadios
                  name="invoice-a-tax-condition"
                  disabled={!fieldsUnlocked}
                  value={
                    fields.tax_condition === "exento"
                      ? "exento"
                      : "responsable_inscripto"
                  }
                  onChange={(value) => setValue("tax_condition", value)}
                />
                <FormInput
                  label="Email de facturación"
                  placeholder="facturacion@empresa.com"
                  required
                  type="email"
                  disabled={!fieldsUnlocked}
                  value={fields.billing_email}
                  onChange={set("billing_email")}
                />
                <FormInput
                  label="Domicilio fiscal"
                  placeholder="Ej: Av. Siempreviva 742"
                  required
                  disabled={!fieldsUnlocked}
                  value={fields.address_line_1}
                  onChange={set("address_line_1")}
                />
                <FormInput
                  label="Localidad"
                  placeholder="Ej: Córdoba"
                  required
                  disabled={!fieldsUnlocked}
                  value={fields.city}
                  onChange={set("city")}
                />
                <FormInput
                  label="Provincia"
                  placeholder="Ej: Buenos Aires"
                  required
                  disabled={!fieldsUnlocked}
                  value={fields.province}
                  onChange={set("province")}
                />
                <FormInput
                  label="Código postal"
                  placeholder="Ej: 1414"
                  required
                  disabled={!fieldsUnlocked}
                  value={fields.postal_code}
                  onChange={set("postal_code")}
                />
                {isLoggedIn ? (
                  <label className="flex items-center gap-2 text-gray-600 text-sm sm:col-span-2">
                    <CheckboxInput
                      checked={saveForFuture}
                      onChange={(e) => setSaveForFuture(e.target.checked)}
                      disabled={!fieldsUnlocked}
                    />
                    Guardar estos datos para próximas compras
                  </label>
                ) : null}
                {showError && !newDataValid() ? (
                  <p className="text-red-500 text-xs sm:col-span-2">
                    Completá razón social, CUIT válido, email, domicilio, localidad, provincia y CP.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

InvoiceAFields.displayName = "InvoiceAFields";

export default InvoiceAFields;
