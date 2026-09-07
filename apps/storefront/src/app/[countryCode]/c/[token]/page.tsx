import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

// Always dynamic: this route kicks off a cart mutation and must never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// La marca la pone el `title.template` del root layout. Acá había
// `Tu compra | ${tenant.name}` con `getTenant()` — el resolver ESTÁTICO, que devuelve
// siempre "Mercatto" (mismo bug que el título del checkout, DESDEELSUR-49).
export const metadata: Metadata = {
  title: "Tu compra",
  robots: { index: false, follow: false },
};

/**
 * Entry point for a shared checkout link (`/{country}/c/{token}`).
 *
 * The happy path hands off to the server-side builder route handler, which
 * resolves the link, builds the cart in-process (no browser round-trips, no
 * hydration, no spinner) and redirects straight to checkout. The old
 * client-side "Preparando tu compra…" loader is gone; this page now only
 * renders the error states, which the builder reaches by bouncing back here
 * with an `?e=…` flag so the message shows inside the site layout.
 */
export default async function CheckoutLinkPage(props: {
  params: Promise<{ countryCode: string; token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { countryCode, token } = await props.params;
  const { e } = await props.searchParams;

  if (!e) {
    redirect(
      `/api/store/checkout-links/${encodeURIComponent(token)}/prepare?cc=${encodeURIComponent(countryCode)}`,
    );
  }

  const expired = e === "expired";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-semibold text-xl">
        {expired
          ? "Este link ya no está disponible"
          : "No pudimos preparar tu compra"}
      </h1>
      <p className="text-gray-600 text-sm">
        {expired
          ? "El enlace que abriste venció, fue deshabilitado o ya se usó. Pedí uno nuevo a quien te lo compartió."
          : "Tuvimos un problema al armar tu carrito. Volvé a intentarlo desde el link o escribinos."}
      </p>
      <Link
        className="rounded-lg bg-[--primary-color] px-4 py-2 font-medium text-sm text-white hover:opacity-90"
        href={expired ? `/${countryCode}` : `/${countryCode}/cart`}
      >
        {expired ? "Ir a la tienda" : "Ir al carrito"}
      </Link>
    </div>
  );
}
