import { sdk } from "@lib/config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
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

    if (action === "update") {
      const { data } = body;

      if (!data || Object.keys(data).length === 0) {
        return NextResponse.json(
          { success: false, message: "No hay datos para actualizar" },
          { status: 400 }
        );
      }
      
      try {
        const { customer } = await sdk.store.customer.update(data, {}, headers);
        return NextResponse.json({ success: true, customer });
      } catch (error: any) {
        console.error("[API Customer] Update error:", error?.message);
        return NextResponse.json(
          { success: false, message: error?.message || "Error al actualizar" },
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
