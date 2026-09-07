import { sdk } from "@lib/config";
import { resolveAndSetBranch } from "@lib/data/branch";
import { getStoreSettings } from "@lib/data/store-settings";
import { withMirroredAddressName } from "@lib/util/address-name";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

/**
 * The saved address determines the user's branch: geocoded lat/lng → polygon →
 * branch → B2C channel (cookies). No-op unless multi-branch is on (Admin →
 * Preferencias) and the address carries coordinates. Non-blocking: if the
 * address falls outside every coverage, the active channel is left unchanged.
 */
async function applyBranchFromAddress(address: unknown): Promise<void> {
  const { multi_branch_enabled } = await getStoreSettings();
  if (!multi_branch_enabled) return;
  const meta = (address as { metadata?: Record<string, unknown> } | null)
    ?.metadata;
  const lat = meta?.latitude as string | number | undefined;
  const lng = meta?.longitude as string | number | undefined;
  if (lat == null || lng == null || lat === "" || lng === "") return;
  try {
    await resolveAndSetBranch(lat, lng);
  } catch (err) {
    console.error("[addresses] branch resolution failed (non-blocking):", err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const headers = { authorization: `Bearer ${token}` };

    // Agregar dirección
    if (action === "add") {
      const address = withMirroredAddressName(body.address);

      try {
        const { customer } = await sdk.store.customer.createAddress(
          address,
          {},
          headers
        );
        // La dirección guardada define la sucursal/canal del usuario.
        await applyBranchFromAddress(address);
        return NextResponse.json({ success: true, customer });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: error?.message || "Error al guardar dirección" },
          { status: 400 }
        );
      }
    }

    // Actualizar dirección
    if (action === "update") {
      const { addressId } = body;
      const address = withMirroredAddressName(body.address);

      try {
        const { customer } = await sdk.store.customer.updateAddress(
          addressId,
          address,
          {},
          headers
        );
        await applyBranchFromAddress(address);
        return NextResponse.json({ success: true, customer });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: error?.message || "Error al actualizar dirección" },
          { status: 400 }
        );
      }
    }

    // Eliminar dirección
    if (action === "delete") {
      const { addressId } = body;

      try {
        await sdk.store.customer.deleteAddress(addressId, headers);
        return NextResponse.json({ success: true });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: error?.message || "Error al eliminar dirección" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, message: "Acción inválida" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error del servidor" },
      { status: 500 }
    );
  }
}
