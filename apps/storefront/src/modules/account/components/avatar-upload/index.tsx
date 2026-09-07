"use client";

import { deleteCustomerAvatar, uploadCustomerAvatar } from "@lib/data/customer";
import {
  AVATAR_ACCEPT_ATTR,
  validateAvatarFile,
} from "@lib/validation/profile";
import type { HttpTypes } from "@medusajs/types";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  customer: HttpTypes.StoreCustomer;
};

/** Lee un File y devuelve su contenido en base64 (sin el prefijo `data:`). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Traduce errores técnicos de subida a un mensaje claro para el usuario.
 * El error real se loguea aparte para debug; acá solo devolvemos algo legible.
 */
function friendlyUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/body.*exceeded|body size|payload too large|content length|413/i.test(msg)) {
    return "La imagen es demasiado pesada para subirla. Probá con una más liviana (máx 2MB).";
  }
  if (/network|fetch|failed to fetch|timeout/i.test(msg)) {
    return "No se pudo conectar. Revisá tu conexión e intentá de nuevo.";
  }
  return "No se pudo subir la foto. Intentá de nuevo.";
}

function getInitials(customer: HttpTypes.StoreCustomer): string {
  const first = customer.first_name?.[0] ?? "";
  const last = customer.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || customer.email[0]?.toUpperCase() || "?";
}

const AvatarUpload = ({ customer }: Props) => {
  const avatarUrl = (customer.metadata as Record<string, unknown> | null)
    ?.avatar_url as string | undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si la URL del avatar muere (objeto borrado en S3, metadata huérfano), el
  // <img> dispara onError y caemos a las iniciales en vez del ícono roto.
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = !!avatarUrl && !imgFailed;

  const busy = isUploading || isRemoving;

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permitir volver a elegir el mismo archivo después de un error.
    e.target.value = "";
    if (!file) {
      return;
    }

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const content = await fileToBase64(file);
      const result = await uploadCustomerAvatar(file.name, file.type, content);
      if (result.success) {
        window.location.reload();
      } else {
        setError(result.error || "No se pudo subir la foto");
        setIsUploading(false);
      }
    } catch (err) {
      // El mensaje crudo de Next (p. ej. "Body exceeded 1 MB limit") no sirve
      // para el usuario: lo logueamos para debug y mostramos algo claro.
      console.error("[AvatarUpload] Error al subir el avatar:", err);
      setError(friendlyUploadError(err));
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setIsRemoving(true);
    const result = await deleteCustomerAvatar();
    if (result.success) {
      window.location.reload();
    } else {
      setError(result.error || "No se pudo quitar la foto");
      setIsRemoving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0px_5px_20px_0px_#0000000D]">
      <h2 className="mb-5 font-semibold text-base text-gray-900">
        Foto de perfil
      </h2>

      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0">
          {showImage ? (
            // biome-ignore lint/a11y/useAltText: alt provisto abajo
            <img
              alt={`Foto de ${customer.first_name ?? "perfil"}`}
              className="h-20 w-20 rounded-full object-cover ring-1 ring-gray-200"
              onError={() => setImgFailed(true)}
              src={avatarUrl}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[--mc-green-soft] font-semibold text-[--primary-color] text-xl ring-1 ring-gray-200">
              {getInitials(customer)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={handlePick}
              type="button"
            >
              <Camera className="h-4 w-4" />
              {isUploading
                ? "Subiendo..."
                : avatarUrl
                  ? "Reemplazar"
                  : "Cargar foto"}
            </button>

            {avatarUrl && (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 text-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                onClick={handleRemove}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                {isRemoving ? "Quitando..." : "Quitar"}
              </button>
            )}
          </div>
          <p className="text-gray-400 text-xs">JPG, PNG o WebP. Máximo 2MB.</p>
        </div>

        <input
          accept={AVATAR_ACCEPT_ATTR}
          className="hidden"
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </p>
      )}
    </div>
  );
};

export default AvatarUpload;
