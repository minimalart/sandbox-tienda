"use client";

import { registerCompany } from "@lib/data/company";
import { useArcaLookup } from "@lib/hooks/use-arca-lookup";
import { useDemoHref } from "@lib/site-config/context";
import { validateCuit } from "@lib/util/cuit";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import FormInput from "@modules/common/components/form-input";
import PasswordInput from "@modules/common/components/password-input";
import TaxConditionRadios, {
  type InvoiceATaxCondition,
} from "@modules/common/components/tax-condition-radios";
import { useState } from "react";

type Form = {
  company_name: string;
  legal_name: string;
  tax_id: string;
  tax_condition: InvoiceATaxCondition;
  contact_name: string;
  email: string;
  password: string;
  password_confirm: string;
};

const EMPTY: Form = {
  company_name: "",
  legal_name: "",
  tax_id: "",
  tax_condition: "responsable_inscripto",
  contact_name: "",
  email: "",
  password: "",
  password_confirm: "",
};

export default function CompanyRegisterForm() {
  const demoHref = useDemoHref();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const arca = useArcaLookup();
  // CUIT primero: el resto del form se habilita tras la primera búsqueda en
  // ARCA (éxito O error — si ARCA no responde se completa a mano igual).
  const fieldsLocked = !arca.attempted;

  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (error) setError(null);
      if (k === "tax_id") arca.reset();
      setForm((p) => ({ ...p, [k]: e.target.value }));
    };

  const runArcaLookup = async () => {
    const taxpayer = await arca.lookup(form.tax_id);
    if (taxpayer) {
      setForm((p) => ({
        ...p,
        legal_name: taxpayer.legal_name || p.legal_name,
        ...(taxpayer.tax_condition === "responsable_inscripto" ||
        taxpayer.tax_condition === "exento"
          ? { tax_condition: taxpayer.tax_condition }
          : {}),
      }));
    }
  };

  const passwordsMatch = form.password === form.password_confirm;
  const showPasswordMismatch = form.password_confirm.length > 0 && !passwordsMatch;

  const valid =
    form.company_name.trim().length >= 2 &&
    form.contact_name.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length >= 8 &&
    passwordsMatch;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length >= 8 && !passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!valid) {
      setError("Completá los campos obligatorios (empresa, contacto, email y contraseña).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await Promise.race([
        registerCompany({
          email: form.email,
          password: form.password,
          contact_name: form.contact_name,
          company_name: form.company_name,
          legal_name: form.legal_name || undefined,
          tax_id: form.tax_id || undefined,
          tax_condition: form.tax_condition,
        }),
        new Promise<{ error: string }>((_, reject) =>
          setTimeout(() => reject(new Error("La solicitud demoró demasiado. Reintentá.")), 30000),
        ),
      ]);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Full-page nav (preservando el prefijo /demo/{slug}); igual que el login,
      // así la cookie de sesión recién creada llega al gate server-side.
      window.location.href = demoHref("/b2b");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la empresa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="font-bold text-2xl text-gray-900">Registrá tu empresa mayorista</h1>
      <p className="mt-1 mb-5 text-gray-500 text-sm">
        Creá tu cuenta para comprar a nombre de tu empresa con precios mayoristas.
      </p>
      <form className="flex flex-col gap-3" noValidate onSubmit={onSubmit}>
        {/* CUIT primero: busca en ARCA y habilita el resto del form. */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <FormInput
              label="CUIT"
              placeholder="30-12345678-9"
              required
              inputMode="numeric"
              value={form.tax_id}
              onChange={set("tax_id")}
            />
          </div>
          <button
            type="button"
            onClick={runArcaLookup}
            disabled={arca.status === "loading" || !validateCuit(form.tax_id)}
            className="h-[44px] shrink-0 whitespace-nowrap rounded-[14px] border border-[--primary-color] px-3 font-medium text-[--primary-color] text-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {arca.status === "loading" ? "Buscando..." : "Buscar en ARCA"}
          </button>
        </div>
        {arca.status === "verified" ? (
          <p className="-mt-1 text-green-600 text-xs">✓ Datos encontrados en ARCA. Revisalos y completá el resto.</p>
        ) : null}
        {arca.status === "error" && arca.message ? (
          <p className="-mt-1 text-red-500 text-xs">{arca.message}</p>
        ) : null}
        {fieldsLocked ? (
          <p className="-mt-1 text-gray-500 text-xs">
            Ingresá el CUIT y tocá "Buscar en ARCA" para habilitar el resto de los datos.
          </p>
        ) : null}

        {/* Datos de la empresa */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormInput
            label="Nombre de la empresa"
            placeholder="Ej: Acme S.A."
            required
            disabled={fieldsLocked}
            value={form.company_name}
            onChange={set("company_name")}
          />
          <FormInput
            label="Razón social"
            placeholder="Razón social"
            disabled={fieldsLocked}
            value={form.legal_name}
            onChange={set("legal_name")}
          />
        </div>
        <TaxConditionRadios
          name="b2b-register-tax-condition"
          disabled={fieldsLocked}
          value={form.tax_condition}
          onChange={(value) => {
            if (error) setError(null);
            setForm((p) => ({ ...p, tax_condition: value }));
          }}
        />

        <div className="mt-2 border-gray-100 border-t pt-3">
          <p className="mb-2 font-semibold text-gray-700 text-sm">Datos de contacto (administrador)</p>
          <div className="flex flex-col gap-3">
            <FormInput
              label="Nombre del contacto"
              placeholder="Ej: Juan Pérez"
              required
              disabled={fieldsLocked}
              value={form.contact_name}
              onChange={set("contact_name")}
            />
            <FormInput
              label="Email"
              placeholder="ejemplo@empresa.com"
              required
              type="email"
              disabled={fieldsLocked}
              value={form.email}
              onChange={set("email")}
            />
            <PasswordInput
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              required
              disabled={fieldsLocked}
              value={form.password}
              onChange={set("password")}
            />
            <PasswordInput
              label="Repetir contraseña"
              placeholder="Repetí la contraseña"
              required
              hasError={showPasswordMismatch}
              disabled={fieldsLocked}
              value={form.password_confirm}
              onChange={set("password_confirm")}
            />
            {showPasswordMismatch ? (
              <p className="-mt-1 text-red-600 text-xs">Las contraseñas no coinciden.</p>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-red-600 text-sm">{error}</p> : null}

        <button
          className="mt-1 min-h-[44px] w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !valid}
          type="submit"
        >
          {loading ? "Procesando..." : "Crear empresa"}
        </button>
      </form>

      {/*
        Salida de la pantalla. El portal B2B no monta el header ni el
        bottom-nav del B2C, así que sin este bloque /b2b/register era un
        callejón sin salida: el único camino de vuelta era el botón del
        navegador. Espeja el bloque inverso del login ("¿Tu empresa todavía no
        está registrada?").
      */}
      <div className="mt-6 border-gray-100 border-t pt-4 text-center">
        <p className="mb-2 text-gray-500 text-sm">¿Tu empresa ya está registrada?</p>
        <LocalizedClientLink
          href="/b2b/login"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[--primary-color] px-4 py-3 font-semibold text-[--primary-color] text-sm transition-colors hover:bg-[--primary-color]/5"
        >
          Volver al ingreso
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center text-gray-500 text-sm underline transition-colors hover:text-gray-700"
        >
          Volver a la tienda
        </LocalizedClientLink>
      </div>
    </div>
  );
}
