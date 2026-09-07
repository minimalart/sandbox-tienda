"use client";

import {
  type CorporateMember,
  type CorporateRole,
  type MyCorporate,
  inviteMember,
  removeMember,
  updateMember,
} from "@lib/data/corporate";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  pending: "Pendiente de aprobación",
  suspended: "Suspendida",
  archived: "Archivada",
};
const ROLE_OPTIONS: Array<{ value: CorporateRole; label: string }> = [
  { value: "buyer", label: "Comprador" },
  { value: "admin", label: "Administrador" },
  { value: "viewer", label: "Lector" },
];

export default function CompanyDashboard({ data }: { data: MyCorporate }) {
  const router = useRouter();
  const { corporate, role, members = [] } = data;
  const isManager = role === "owner" || role === "admin";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CorporateRole>("buyer");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!corporate) return null;

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const onInvite = async () => {
    if (!/.+@.+\..+/.test(email)) {
      flash("err", "Ingresá un email válido.");
      return;
    }
    setBusy(true);
    const res = await inviteMember(email, inviteRole);
    setBusy(false);
    if ("error" in res) {
      flash("err", res.error);
      return;
    }
    setEmail("");
    flash("ok", "Invitación enviada.");
    router.refresh();
  };

  const onUpdate = async (
    m: CorporateMember,
    body: { role?: CorporateRole; status?: "active" | "disabled" },
  ) => {
    const res = await updateMember(m.id, body);
    if ("error" in res) flash("err", res.error);
    else router.refresh();
  };

  const onRemove = async (m: CorporateMember) => {
    const res = await removeMember(m.id);
    if ("error" in res) flash("err", res.error);
    else router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">Mi Empresa</h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Gestioná los datos y los empleados de tu cuenta corporativa.
        </p>
      </div>

      {/* Datos */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">{corporate.name}</h3>
          <span
            className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${
              corporate.status === "active"
                ? "bg-green-100 text-green-700"
                : corporate.status === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_LABEL[corporate.status] ?? corporate.status}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {corporate.legal_name ? (
            <Row label="Razón social" value={corporate.legal_name} />
          ) : null}
          {corporate.tax_id ? <Row label="CUIT / Tax ID" value={corporate.tax_id} /> : null}
          <Row label="Tu rol" value={role ?? "—"} />
        </dl>
        {corporate.status === "pending" ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-700 text-xs">
            Tu empresa está pendiente de aprobación. Te avisaremos cuando esté activa.
          </p>
        ) : null}
      </div>

      {/* Invitar (managers) */}
      {isManager ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">Invitar empleado</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              className="min-h-[40px] flex-1 rounded-lg border border-gray-300 px-3 text-sm"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empleado@empresa.com"
              type="email"
              value={email}
            />
            <ResponsiveCombobox
              className="sm:w-44"
              placeholder="Rol"
              searchPlaceholder="Buscar rol..."
              triggerClassName="min-h-[40px] rounded-lg border border-gray-300 px-3 text-sm"
              onValueChange={(value) => setInviteRole(value as CorporateRole)}
              value={inviteRole}
              options={ROLE_OPTIONS}
            />
            <button
              className="min-h-[40px] rounded-lg bg-[--primary-color] px-4 font-semibold text-sm text-white disabled:opacity-50"
              disabled={busy}
              onClick={onInvite}
              type="button"
            >
              Invitar
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      ) : null}

      {/* Miembros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">Empleados</h3>
        <div className="mt-3 divide-y divide-gray-100">
          {members.length === 0 ? (
            <p className="py-2 text-gray-500 text-sm">Sin empleados todavía.</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-gray-700 text-xs">{m.customer_id}</p>
                  <p className="text-gray-500 text-xs">
                    {m.role} · {m.status}
                  </p>
                </div>
                {isManager && m.role !== "owner" ? (
                  <div className="flex flex-wrap gap-2">
                    <ResponsiveCombobox
                      className="w-36"
                      placeholder="Rol"
                      searchPlaceholder="Buscar rol..."
                      triggerClassName="min-h-[32px] rounded-md border border-gray-300 px-2 text-xs"
                      onValueChange={(value) =>
                        onUpdate(m, { role: value as CorporateRole })
                      }
                      value={m.role}
                      options={ROLE_OPTIONS}
                    />
                    {m.status === "active" ? (
                      <button
                        className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 text-xs"
                        onClick={() => onUpdate(m, { status: "disabled" })}
                        type="button"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 text-xs"
                        onClick={() => onUpdate(m, { status: "active" })}
                        type="button"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      className="rounded-md border border-rose-200 px-2 py-1 text-rose-600 text-xs"
                      onClick={() => onRemove(m)}
                      type="button"
                    >
                      Quitar
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-gray-400 text-xs">
        ¿Necesitás otra empresa?{" "}
        <LocalizedClientLink className="underline" href="/corporate/register">
          Registrá una nueva
        </LocalizedClientLink>
        .
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
