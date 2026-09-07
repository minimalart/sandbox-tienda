"use client";

import { acceptInvitation } from "@lib/data/corporate";
import { useDemoHref } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type InvitationInfo = {
  email: string;
  role: string;
  status: string;
  corporate_name: string | null;
  valid: boolean;
};

export default function AcceptInvitation({
  token,
  invitation,
  isLoggedIn,
}: {
  token: string;
  invitation: InvitationInfo | null;
  isLoggedIn: boolean;
}) {
  const demoHref = useDemoHref();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invitation) {
    return (
      <Card>
        <h1 className="font-bold text-xl text-gray-900">Invitación no encontrada</h1>
        <p className="mt-2 text-gray-500 text-sm">El enlace no es válido.</p>
      </Card>
    );
  }

  if (!invitation.valid) {
    const label =
      invitation.status === "expired"
        ? "Esta invitación expiró."
        : invitation.status === "accepted"
          ? "Esta invitación ya fue aceptada."
          : "Esta invitación ya no está disponible.";
    return (
      <Card>
        <h1 className="font-bold text-xl text-gray-900">Invitación no disponible</h1>
        <p className="mt-2 text-gray-500 text-sm">{label}</p>
      </Card>
    );
  }

  const onAccept = async () => {
    setError(null);
    setLoading(true);
    const result = await acceptInvitation(token);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    // Ruta limpia (el proxy resuelve el país) y con el prefijo del demo si lo hay.
    router.push(demoHref("/account/company"));
  };

  return (
    <Card>
      <h1 className="font-bold text-xl text-gray-900">
        Te invitaron a {invitation.corporate_name ?? "una empresa"}
      </h1>
      <p className="mt-2 text-gray-500 text-sm">
        Rol asignado: <span className="font-semibold">{invitation.role}</span>
        <br />
        Invitación para: <span className="font-medium">{invitation.email}</span>
      </p>

      {isLoggedIn ? (
        <>
          {error ? <p className="mt-3 text-red-600 text-sm">{error}</p> : null}
          <button
            className="mt-4 min-h-[44px] w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-[--primary-color-dark] disabled:opacity-50"
            disabled={loading}
            onClick={onAccept}
            type="button"
          >
            {loading ? "Procesando..." : "Aceptar invitación"}
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-gray-600 text-sm">
          <p className="mb-3">
            Para aceptar, iniciá sesión o creá tu cuenta con el email{" "}
            <span className="font-medium">{invitation.email}</span> y volvé a este enlace.
          </p>
          <LocalizedClientLink
            className="inline-flex min-h-[40px] items-center rounded-xl bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white"
            href="/account"
          >
            Ir a iniciar sesión
          </LocalizedClientLink>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      {children}
    </div>
  );
}
