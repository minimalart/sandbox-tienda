import { getCustomerSession } from "@lib/data/cookies";
import { sessionCookieName } from "@lib/util/customer-session";
import { sdk } from "@lib/config";
import {
  EMAIL_EXISTS_IN_OTHER_TENANT,
  TENANT_MISMATCH_ERROR,
} from "@lib/constants/customer";
import { resolveBranchByPoint } from "@lib/data/branch";
import { getMedusaAdminClient } from "@lib/data/medusa-client";
import { getStoreSettings } from "@lib/data/store-settings";
import { getTenant } from "@lib/site-config/resolver";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Multi-branch hydration: on login, the customer's default shipping address
 * determines their branch/channel. Returns the B2C sales_channel_id to persist,
 * or null when multi-branch is off / no mapped default address / out of coverage.
 */
async function resolveBranchChannelForToken(
  token: string,
): Promise<string | null> {
  try {
    const { multi_branch_enabled } = await getStoreSettings();
    if (!multi_branch_enabled) return null;

    const { customer } = await sdk.client.fetch<{ customer: any }>(
      "/store/customers/me",
      {
        method: "GET",
        query: { fields: "*addresses" },
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    const addresses: any[] = customer?.addresses ?? [];
    const def =
      addresses.find((a) => a?.is_default_shipping) ?? addresses[0] ?? null;
    const meta = (def?.metadata ?? {}) as Record<string, unknown>;
    const lat = meta.latitude as string | number | undefined;
    const lng = meta.longitude as string | number | undefined;
    if (lat == null || lng == null || lat === "" || lng === "") return null;

    const resolution = await resolveBranchByPoint(lat, lng);
    return resolution.covered ? resolution.sales_channel_id : null;
  } catch {
    return null;
  }
}

// Verifica via admin API si un email corresponde a un customer migrado sin contraseña
async function checkMigratedCustomer(email: string): Promise<boolean> {
  try {
    const adminClient = getMedusaAdminClient();
    const { customers } = await (adminClient.admin as any).customer.list({
      email,
      limit: 1,
    });
    const customer = customers?.[0];
    return (
      customer?.metadata?.customer_migrated === true &&
      !customer?.metadata?.migration_password_set
    );
  } catch (e) {
    console.error("Error checking migrated customer", e)
    return false;
  }
}

// Helper para crear respuesta con cookie de auth
async function createResponseWithAuthCookie(
  data: object,
  token: string,
  status: number = 200,
) {
  const session = await getCustomerSession();
  const { token: _privateToken, ...publicData } = data as Record<string, unknown>;
  const response = NextResponse.json(publicData, { status });
  response.cookies.set(sessionCookieName(session, "present"), "1", { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  // Configuración mínima para desarrollo local con dominios .local
  response.cookies.set(sessionCookieName(session), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
  });
  // Multi-sucursal: hidratar el canal desde la dirección por defecto del cliente
  // (la sucursal lo sigue entre dispositivos / aunque se haya borrado la cookie).
  const channelId = session.mode === "b2c" ? await resolveBranchChannelForToken(token) : null;
  if (channelId) {
    response.cookies.set("_sales_channel_id", channelId, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

// Helper para crear respuesta removiendo cookie de auth
async function createResponseRemovingAuthCookie(data: object, status: number = 200) {
  const response = NextResponse.json(data, { status });
  const session = await getCustomerSession();
  response.cookies.set(sessionCookieName(session, "cart"), "", { maxAge: 0, path: "/" });
  response.cookies.set(sessionCookieName(session, "present"), "", { maxAge: 0, path: "/" });
  response.cookies.set(sessionCookieName(session), "", {
    maxAge: 0,
    path: "/",
  });
  return response;
}

// Decodifica el payload de un JWT (sin verificar la firma — solo para leer
// actor_id y user_metadata del token que devuelve el callback de Google).
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Extrae los tenant_ids del metadata del customer (soporta legacy string y array)
function extractTenantIds(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (Array.isArray(metadata?.tenant_ids)) {
    return metadata.tenant_ids as string[];
  }
  if (typeof metadata?.tenant_id === "string") {
    return [metadata.tenant_id as string];
  }
  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Signup
    if (action === "signup") {
      const { email, password, first_name, last_name, phone, utm } = body;

      if (!email || !password) {
        return NextResponse.json(
          { success: false, message: "Email y contraseña son requeridos" },
          { status: 400 },
        );
      }

      try {
        // Obtener tenant actual para vincular el customer
        const tenant = await getTenant();

        let token: string;
        try {
          token = (await sdk.auth.register("customer", "emailpass", {
            email,
            password,
          })) as string;
        } catch (registerError: any) {
          // Si el error es que el email ya existe, intentar login para validar contraseña
          if (
            registerError?.message?.includes("already exists") ||
            registerError?.message?.includes(
              "Identity with email already exists",
            )
          ) {
            try {
              // Intentar login para validar contraseña
              const loginToken = (await sdk.auth.login(
                "customer",
                "emailpass",
                {
                  email,
                  password,
                },
              )) as string;

              // Obtener customer para verificar tenant
              const authHeaders = { authorization: `Bearer ${loginToken}` };
              const { customer: existingCustomer } = await sdk.client.fetch<{
                customer: any;
              }>("/store/customers/me", {
                method: "GET",
                headers: authHeaders,
                cache: "no-store",
              });

              // Obtener tenant_ids del customer (soporta legacy y array)
              const metadata = existingCustomer?.metadata as
                | Record<string, unknown>
                | null
                | undefined;
              let tenantIds: string[] = [];

              if (Array.isArray(metadata?.tenant_ids)) {
                tenantIds = metadata.tenant_ids as string[];
              } else if (typeof metadata?.tenant_id === "string") {
                tenantIds = [metadata.tenant_id];
              }

              // Si el customer ya tiene el tenant actual, no es necesario vincular
              if (tenantIds.includes(tenant.id)) {
                // El usuario ya está registrado en este tenant, hacer login directo
                return createResponseWithAuthCookie(
                  {
                    success: true,
                    customer: existingCustomer,
                    token: loginToken,
                  },
                  loginToken,
                );
              }

              // Si el customer tiene otro tenant, retornar error especial para vincular
              const originalTenantId = tenantIds[0] || "otra tienda";
              return NextResponse.json(
                {
                  success: false,
                  message: EMAIL_EXISTS_IN_OTHER_TENANT,
                  emailExistsInOtherTenant: true,
                  originalTenant: originalTenantId,
                },
                { status: 409 },
              );
            } catch (loginError: any) {
              // Si el login falla, la contraseña es incorrecta
              return NextResponse.json(
                {
                  success: false,
                  message: "Este correo ya está registrado con otra contraseña",
                },
                { status: 400 },
              );
            }
          }
          // Re-lanzar otros errores
          throw registerError;
        }

        // Si llegamos aquí, el registro fue exitoso
        // Crear customer con tenant_ids en metadata (array)
        const { customer: createdCustomer } = await sdk.store.customer.create(
          {
            email,
            first_name,
            last_name,
            phone,
            metadata: {
              tenant_ids: [tenant.id],
              sales_channel: "B2C Storefront",
              sales_channel_id: tenant.medusa.salesChannelId,
              ...(utm && { utm }),
            },
          },
          {},
          { authorization: `Bearer ${token}` },
        );

        // Login después de crear
        const loginToken = await sdk.auth.login("customer", "emailpass", {
          email,
          password,
        });
        return createResponseWithAuthCookie(
          {
            success: true,
            customer: createdCustomer,
            token: loginToken as string,
          },
          loginToken as string,
        );
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: error.message || error.toString() },
          { status: 400 },
        );
      }
    }

    // Login
    if (action === "login") {
      const { email, password, sales_channel_id, country_code } = body;

      if (!email || !password) {
        return NextResponse.json(
          { success: false, message: "Email y contraseña son requeridos" },
          { status: 400 },
        );
      }

      try {
        const token = await sdk.auth.login("customer", "emailpass", {
          email,
          password,
        });

        // Obtener customer para validar tenant
        const authHeaders = { authorization: `Bearer ${token}` };
        const { customer } = await sdk.client.fetch<{ customer: any }>(
          "/store/customers/me",
          {
            method: "GET",
            headers: authHeaders,
            cache: "no-store",
          },
        );

        // Validar tenant
        const tenant = await getTenant();
        const metadata = customer?.metadata as
          | Record<string, unknown>
          | null
          | undefined;

        // Obtener tenant_ids (soporta legacy y array)
        let tenantIds: string[] = [];
        if (Array.isArray(metadata?.tenant_ids)) {
          tenantIds = metadata.tenant_ids as string[];
        } else if (typeof metadata?.tenant_id === "string") {
          tenantIds = [metadata.tenant_id];
        }

        // Migrar si es necesario (tenant_id legacy)
        if (
          customer &&
          typeof metadata?.tenant_id === "string" &&
          !Array.isArray(metadata?.tenant_ids)
        ) {
          const migratedMetadata: Record<string, unknown> = {
            ...metadata,
            tenant_ids: [metadata.tenant_id],
          };
          delete migratedMetadata.tenant_id;

          await sdk.store.customer.update(
            { metadata: migratedMetadata },
            {},
            authHeaders,
          );
          tenantIds = [metadata.tenant_id];
        }

        // Si el customer tiene tenant_ids y el tenant actual no está en el array, rechazar login
        if (tenantIds.length > 0 && !tenantIds.includes(tenant.id)) {
          return createResponseRemovingAuthCookie({
            success: false,
            message: TENANT_MISMATCH_ERROR,
            tenantMismatch: true,
            originalTenant: tenantIds[0],
          });
        }

        // Si el customer no tiene tenant_ids, asignarlo al tenant actual
        if (customer && tenantIds.length === 0) {
          await sdk.store.customer.update(
            {
              metadata: {
                ...metadata,
                tenant_ids: [tenant.id],
                sales_channel: "B2C Storefront",
                sales_channel_id: tenant.medusa.salesChannelId,
              },
            },
            {},
            authHeaders,
          );
        }

        // Detectar usuario migrado que aún no estableció su contraseña
        if (
          customer?.metadata?.customer_migrated === true &&
          !customer?.metadata?.migration_password_set
        ) {
          try {
            const origin = request.headers.get("origin") || "";
            await sdk.auth.resetPassword("customer", "emailpass", {
              identifier: email.trim(),
              metadata: {
                web_url: origin,
                ...(sales_channel_id && { sales_channel_id }),
                ...(country_code && { country_code }),
              },
            } as any);
          } catch (_) {
            // Silenciar - siempre retornar el mensaje
          }
          return createResponseRemovingAuthCookie({
            success: false,
            needsMigrationReset: true,
          });
        }

        return createResponseWithAuthCookie(
          { success: true, customer, token: token as string },
          token as string,
        );
      } catch (loginError: any) {
        // Verificar si es un customer migrado sin contraseña (401 porque nunca tuvo auth identity)
        const isMigratedCustomer = await checkMigratedCustomer(email);
        if (isMigratedCustomer) {
          try {
            const origin = request.headers.get("origin") || "";
            await sdk.auth.resetPassword("customer", "emailpass", {
              identifier: email.trim(),
              metadata: {
                web_url: origin,
                ...(sales_channel_id && { sales_channel_id }),
                ...(country_code && { country_code }),
              },
            } as any);
            console.log("[migration] Reset password email dispatched for:", email);
          } catch (resetErr: any) {
            console.error("[migration] Failed to dispatch reset password:", resetErr?.message || resetErr);
          }
          return createResponseRemovingAuthCookie({
            success: false,
            needsMigrationReset: true,
          });
        }

        return NextResponse.json(
          { success: false, message: "Email o contraseña incorrectos" },
          { status: 401 },
        );
      }
    }

    // Google login init — arranca el flujo OAuth server-side (sin CORS).
    // El servidor le pide a Medusa la URL de consentimiento de Google y se la
    // devuelve al cliente para que redirija. El callback_url (página del
    // storefront) llega del cliente, armado desde el origin real, así no
    // depende de un env hardcodeado y funciona en cualquier entorno.
    if (action === "googleInit") {
      const { callbackUrl } = body;

      try {
        const result = await sdk.client.fetch<{ location?: string }>(
          "/auth/customer/google",
          {
            method: "POST",
            body: callbackUrl ? { callback_url: callbackUrl } : {},
          },
        );

        if (result?.location) {
          return NextResponse.json({ success: true, location: result.location });
        }

        return NextResponse.json(
          {
            success: false,
            message: "Google no devolvió una URL de redirección",
          },
          { status: 400 },
        );
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            message: error?.message || "No se pudo iniciar el login con Google",
          },
          { status: 400 },
        );
      }
    }

    // Google login callback — cierra el flujo OAuth server-side (sin CORS).
    // Recibe los query params (code/state) de Google, los intercambia por un
    // token contra el backend, y aplica LAS MISMAS reglas multi-tenant que el
    // login con emailpass: valida el tenant, crea el customer en el primer
    // login y rechaza cuentas que pertenecen a otra tienda.
    if (action === "googleCallback") {
      const { query } = body;

      if (!query || typeof query !== "object" || !query.code) {
        return NextResponse.json(
          { success: false, message: "Faltan datos del callback de Google" },
          { status: 400 },
        );
      }

      try {
        // Intercambiar el código por un token contra el backend (server-side)
        const callbackRes = await sdk.client.fetch<{ token?: string }>(
          "/auth/customer/google/callback",
          { method: "POST", query },
        );
        let token = callbackRes?.token;

        if (!token) {
          return NextResponse.json(
            { success: false, message: "Google no devolvió un token válido" },
            { status: 400 },
          );
        }

        const decoded = decodeJwtPayload(token);
        const tenant = await getTenant();
        let authHeaders = { authorization: `Bearer ${token}` };

        // actor_id vacío => la identidad de auth todavía no tiene customer asociado
        const needsCustomerCreation = !decoded?.actor_id;

        if (needsCustomerCreation) {
          const email = decoded?.user_metadata?.email as string | undefined;

          if (!email) {
            return NextResponse.json(
              { success: false, message: "Google no devolvió un email válido" },
              { status: 400 },
            );
          }

          // Antes de crear: intentar vincular esta identidad de Google a un
          // customer EXISTENTE con el mismo email (ej. registrado antes con
          // email/contraseña). Evita el error "Customer with this email already
          // has an account". Si vincula, refrescamos el token (ya con actor_id)
          // y seguimos por el camino de "customer existente" de más abajo.
          let linkedToExisting = false;
          try {
            const linkRes = await sdk.client.fetch<{ linked?: boolean }>(
              "/store/auth/google/link",
              { method: "POST", headers: authHeaders },
            );
            linkedToExisting = Boolean(linkRes?.linked);
          } catch {
            // 404 (no hay customer con ese email) u otro error → no vinculado:
            // seguimos al alta normal de un customer nuevo.
            linkedToExisting = false;
          }

          if (linkedToExisting) {
            const refreshed = await sdk.client.fetch<{ token?: string }>(
              "/auth/token/refresh",
              { method: "POST", headers: authHeaders },
            );
            token = refreshed?.token || token;
            authHeaders = { authorization: `Bearer ${token}` };
            // Cae al bloque de "customer existente" más abajo (valida tenant).
          } else {
            // Usuario nuevo: crear el customer vinculado a la identidad de
            // Google, con el tenant actual.
            const { customer: createdCustomer } = await sdk.store.customer.create(
              {
                email,
                first_name: (decoded?.user_metadata?.given_name as string) || "",
                last_name: (decoded?.user_metadata?.family_name as string) || "",
                metadata: {
                  tenant_ids: [tenant.id],
                  sales_channel: "B2C Storefront",
                  sales_channel_id: tenant.medusa.salesChannelId,
                },
              },
              {},
              authHeaders,
            );

            // Refrescar el token para que incluya el actor_id del customer creado
            const refreshed = await sdk.client.fetch<{ token: string }>(
              "/auth/token/refresh",
              { method: "POST", headers: authHeaders },
            );
            const finalToken = refreshed?.token || token;

            return createResponseWithAuthCookie(
              { success: true, customer: createdCustomer, token: finalToken },
              finalToken,
            );
          }
        }

        // Customer existente: validar tenant igual que el login con emailpass
        const { customer } = await sdk.client.fetch<{ customer: any }>(
          "/store/customers/me",
          { method: "GET", headers: authHeaders, cache: "no-store" },
        );

        const metadata = customer?.metadata as
          | Record<string, unknown>
          | null
          | undefined;
        let tenantIds = extractTenantIds(metadata);

        // Migrar tenant_id legacy (string) a tenant_ids (array)
        if (
          customer &&
          typeof metadata?.tenant_id === "string" &&
          !Array.isArray(metadata?.tenant_ids)
        ) {
          const migratedMetadata: Record<string, unknown> = {
            ...metadata,
            tenant_ids: [metadata.tenant_id],
          };
          delete migratedMetadata.tenant_id;
          await sdk.store.customer.update(
            { metadata: migratedMetadata },
            {},
            authHeaders,
          );
          tenantIds = [metadata.tenant_id as string];
        }

        // Cuenta registrada en otra tienda => rechazar
        if (tenantIds.length > 0 && !tenantIds.includes(tenant.id)) {
          return createResponseRemovingAuthCookie({
            success: false,
            message: TENANT_MISMATCH_ERROR,
            tenantMismatch: true,
            originalTenant: tenantIds[0],
          });
        }

        // Sin tenant asignado => vincular al tenant actual
        if (customer && tenantIds.length === 0) {
          await sdk.store.customer.update(
            {
              metadata: {
                ...metadata,
                tenant_ids: [tenant.id],
                sales_channel: "B2C Storefront",
                sales_channel_id: tenant.medusa.salesChannelId,
              },
            },
            {},
            authHeaders,
          );
        }

        return createResponseWithAuthCookie(
          { success: true, customer, token },
          token,
        );
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            message:
              error?.message || "No se pudo completar el login con Google",
          },
          { status: 400 },
        );
      }
    }

    // Link Tenant
    if (action === "linkTenant") {
      const { email, password, tenantId } = body;

      if (!email || !password || !tenantId) {
        return NextResponse.json(
          {
            success: false,
            message: "Email, contraseña y tenant ID son requeridos",
          },
          { status: 400 },
        );
      }

      try {
        // Validar credenciales con login
        const token = (await sdk.auth.login("customer", "emailpass", {
          email,
          password,
        })) as string;

        // Obtener customer actual
        const authHeaders = { authorization: `Bearer ${token}` };
        const { customer } = await sdk.client.fetch<{ customer: any }>(
          "/store/customers/me",
          {
            method: "GET",
            headers: authHeaders,
            cache: "no-store",
          },
        );

        if (!customer) {
          return NextResponse.json(
            {
              success: false,
              message: "No se pudo obtener la información del cliente",
            },
            { status: 404 },
          );
        }

        // Obtener tenant_ids actuales
        const metadata = customer.metadata as
          | Record<string, unknown>
          | null
          | undefined;
        let tenantIds: string[] = [];

        if (Array.isArray(metadata?.tenant_ids)) {
          tenantIds = metadata.tenant_ids as string[];
        } else if (typeof metadata?.tenant_id === "string") {
          tenantIds = [metadata.tenant_id];
        }

        // Verificar que el tenant no esté ya vinculado
        if (tenantIds.includes(tenantId)) {
          return NextResponse.json(
            {
              success: false,
              message: "Esta cuenta ya está vinculada a esta tienda",
            },
            { status: 400 },
          );
        }

        // Agregar el nuevo tenant al array
        const updatedMetadata: Record<string, unknown> = {
          ...metadata,
          tenant_ids: [...tenantIds, tenantId],
        };

        // Remover tenant_id legacy si existe
        delete updatedMetadata.tenant_id;

        // Actualizar customer
        await sdk.store.customer.update(
          { metadata: updatedMetadata },
          {},
          authHeaders,
        );

        // Retornar success sin token (NO autenticar automáticamente)
        return NextResponse.json({
          success: true,
          message: "Cuenta vinculada exitosamente",
        });
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            message: error.message || "Error al vincular la cuenta",
          },
          { status: 400 },
        );
      }
    }

    // Change password: validates current password, then sends reset link
    if (action === "changePassword") {
      const { email, currentPassword, sales_channel_id, country_code } = body;

      if (!email || !currentPassword) {
        return NextResponse.json(
          { success: false, message: "Email y contraseña actual son requeridos" },
          { status: 400 },
        );
      }

      try {
        // Validate current password
        await sdk.auth.login("customer", "emailpass", {
          email,
          password: currentPassword,
        });
      } catch {
        return NextResponse.json(
          { success: false, message: "Contraseña actual incorrecta" },
          { status: 401 },
        );
      }

      try {
        const origin = request.headers.get("origin") || "";
        await sdk.auth.resetPassword("customer", "emailpass", {
          identifier: email.trim(),
          ...(sales_channel_id &&
            country_code && {
              metadata: {
                sales_channel_id,
                country_code,
                web_url: origin,
              },
            }),
        } as any);
        return NextResponse.json({
          success: true,
          message: "Te enviamos un link para cambiar tu contraseña. Revisá tu correo.",
        });
      } catch {
        return NextResponse.json({
          success: true,
          message: "Te enviamos un link para cambiar tu contraseña. Revisá tu correo.",
        });
      }
    }

    // Request reset password (sends email if backend has subscriber)
    if (action === "requestResetPassword") {
      const { email, sales_channel_id, country_code } = body;

      if (!email || typeof email !== "string") {
        return NextResponse.json(
          { success: false, message: "El correo electrónico es requerido" },
          { status: 400 },
        );
      }

      try {
        const origin = request.headers.get("origin") || "";
        await sdk.auth.resetPassword("customer", "emailpass", {
          identifier: email.trim(),
          ...(sales_channel_id &&
            country_code && {
              metadata: {
                sales_channel_id,
                country_code,
                web_url: origin,
              },
            }),
        });
        // Always return success to avoid revealing if email exists
        return NextResponse.json({
          success: true,
          message:
            "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.",
        });
      } catch (error: any) {
        // Still return success so we don't leak email existence
        return NextResponse.json({
          success: true,
          message:
            "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.",
        });
      }
    }

    // Reset password with token (from email link)
    if (action === "resetPassword") {
      const { email, password, token } = body;

      if (!email || !password || !token) {
        return NextResponse.json(
          {
            success: false,
            message: "Email, contraseña y token son requeridos",
          },
          { status: 400 },
        );
      }

      try {
        await sdk.auth.updateProvider(
          "customer",
          "emailpass",
          { email, password },
          token,
        );

        // Marcar la migración como completada si aplica
        try {
          const tempToken = (await sdk.auth.login("customer", "emailpass", {
            email,
            password,
          })) as string;
          const tempHeaders = { authorization: `Bearer ${tempToken}` };
          const { customer: c } = await sdk.client.fetch<{ customer: any }>(
            "/store/customers/me",
            { method: "GET", headers: tempHeaders, cache: "no-store" },
          );
          if (
            c?.metadata?.customer_migrated === true &&
            !c?.metadata?.migration_password_set
          ) {
            await sdk.store.customer.update(
              { metadata: { ...c.metadata, migration_password_set: true } },
              {},
              tempHeaders,
            );
          }
        } catch (_) {
          // Non-critical, no fallar el reset
        }

        return NextResponse.json({
          success: true,
          message: "Contraseña actualizada. Ya podés iniciar sesión.",
        });
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            message:
              error?.message ||
              "El enlace expiró o no es válido. Solicitá uno nuevo.",
          },
          { status: 400 },
        );
      }
    }

    // Signout
    if (action === "signout") {
      try {
        // No necesitamos llamar a sdk.auth.logout() ya que solo borramos la cookie
        // El SDK logout puede fallar si no hay sesión activa
        return createResponseRemovingAuthCookie({ success: true });
      } catch (error: any) {
        // Igual retornamos success y borramos la cookie
        return createResponseRemovingAuthCookie({ success: true });
      }
    }

    return NextResponse.json(
      { success: false, message: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error de autenticación",
      },
      { status: 500 },
    );
  }
}
