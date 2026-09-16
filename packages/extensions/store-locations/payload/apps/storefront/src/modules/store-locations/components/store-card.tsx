"use client";

import type {
  StoreLocatorCategory,
  StoreLocatorLocation,
} from "@lib/types/store-locator";
import { branchTypeLabel, branchTypeStyle } from "@lib/util/branch-types";
import { handleImageError } from "@lib/util/placeholder-image";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

type StoreCardProps = {
  store: StoreLocatorLocation;
  isExpanded: boolean;
  onToggle: () => void;
  /** Los tipos que configuró la tienda: de acá salen la etiqueta y el color. */
  types: StoreLocatorCategory[];
};

const externalHref = (value: string) =>
  value.startsWith("http") ? value : `https://${value}`;

export default function StoreCard({
  store,
  isExpanded,
  onToggle,
  types,
}: StoreCardProps) {
  // El estilo nunca es undefined: antes esto era un lookup pelado sobre un
  // objeto de tres claves y una sucursal con un tipo desconocido rompía la
  // card al leer `.label`. Sin tipo (o con uno que la tienda borró) no se
  // muestra la etiqueta, pero el resto de la tarjeta funciona igual.
  const config = branchTypeStyle(types, store.type);
  const typeLabel = branchTypeLabel(types, store.type);
  // El admin permite hasta 3 imágenes y deja huecos vacíos cuando se borra una,
  // así que filtramos los slots vacíos antes de decidir si hay galería.
  const images = (store.images ?? [])
    .filter((url): url is string => Boolean(url?.trim()))
    .slice(0, 3);
  const hasSocial =
    store.socialMedia?.instagram ||
    store.socialMedia?.facebook ||
    store.socialMedia?.website ||
    store.socialMedia?.tiktok ||
    store.socialMedia?.linkedin ||
    store.whatsapp;

  return (
    <div
      className={`overflow-hidden rounded-2xl transition-all ${
        isExpanded
          ? `border ${config.border} bg-white shadow-sm`
          : "border border-transparent bg-white/80 hover:bg-white hover:shadow-sm"
      }`}
    >
      <button
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${config.bg}`}
          >
            <MapPin className={`h-5 w-5 ${config.text}`} />
          </div>
          <div className="min-w-0">
            {/* h2: la tarjeta es un ítem del contenido principal de /sucursales. En h3 dejaba un
                salto h1→h3 en los layouts donde los selects de filtro no se muestran. */}
            <h2 className="truncate font-semibold text-gray-900">
              {store.name}
            </h2>
            {/* `truncate`: con la pastilla del tipo al lado, "San Carlos de
                Bariloche, Río Negro" se partía en dos renglones y desalineaba
                la fila. Una línea con elipsis. */}
            <p className="mt-0.5 truncate text-gray-500 text-sm">
              {[store.city, store.province].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeLabel && (
            <span
              className={`hidden whitespace-nowrap rounded-full px-3 py-1 font-medium text-xs sm:inline-flex ${config.bg} ${config.text}`}
            >
              {typeLabel}
            </span>
          )}
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-gray-100 border-t px-4 pt-3 pb-4">
          {/* Sin sangría: el panel usa todo el ancho de la tarjeta, si no la
              dirección y las fotos quedan partidas al medio en la columna. */}
          <div className="space-y-3">
            {typeLabel && (
              <span
                className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 font-medium text-xs sm:hidden ${config.bg} ${config.text}`}
              >
                {typeLabel}
              </span>
            )}

            {images.length > 0 && (
              <div
                className={`grid gap-2 ${
                  images.length === 1 ? "grid-cols-1" : "grid-cols-3"
                }`}
              >
                {images.map((url, index) => (
                  <a
                    className="group relative block overflow-hidden rounded-xl bg-gray-100"
                    href={url}
                    key={url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {/* `<img>` crudo: las URLs pueden venir de storage externo y
                        no están en los remotePatterns de next/image. */}
                    <img
                      alt={`${store.name} - foto ${index + 1}`}
                      className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        images.length === 1
                          ? "aspect-[16/10]"
                          : "aspect-[4/3]"
                      }`}
                      loading="lazy"
                      onError={handleImageError}
                      src={url}
                    />
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              {store.address && (
                <div className="flex items-start gap-2 text-gray-600 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{store.address}</span>
                </div>
              )}
              {/* Horario y estado en la misma fila (el estado solo tiene sentido
                  al lado del horario; suelto parecía un dato aparte). */}
              {(store.businessHoursSummary || store.isOpenNow !== undefined) && (
                <div className="flex items-start gap-2 text-gray-600 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {store.businessHoursSummary && (
                      <span>{store.businessHoursSummary}</span>
                    )}
                    {store.isOpenNow !== undefined && (
                      <span
                        className={`font-medium ${
                          store.isOpenNow ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {store.isOpenNow ? "Abierto ahora" : "Cerrado"}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {store.phone && (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  <a
                    className="hover:text-[--primary-color] hover:underline"
                    href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                  >
                    {store.phone}
                  </a>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <a
                    className="truncate hover:text-[--primary-color] hover:underline"
                    href={`mailto:${store.email}`}
                  >
                    {store.email}
                  </a>
                </div>
              )}
            </div>

            {hasSocial && (
              <div className="flex flex-wrap items-center gap-2">
                {store.whatsapp && (
                  <a
                    className="inline-flex items-center gap-2 rounded-full bg-[--primary-color]/10 px-3 py-1.5 font-medium text-[--primary-color] text-sm transition-opacity hover:opacity-80"
                    href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                {store.socialMedia?.website && (
                  <a
                    className="inline-flex items-center gap-2 rounded-full bg-[--primary-color]/10 px-3 py-1.5 font-medium text-[--primary-color] text-sm transition-opacity hover:opacity-80"
                    href={externalHref(store.socialMedia.website)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Globe className="h-4 w-4" />
                    Sitio web
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
