"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  MinusSmallIcon,
  PlusSmallIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useEffect, useRef, useState } from "react";

/**
 * Nodo del árbol de categorías del nav. Se arma en el server (Nav) desde la
 * lista plana de Medusa y llega ya recortado a 2 niveles con el href resuelto,
 * así el cliente no vuelve a pedir nada ni recibe el payload completo.
 */
export type CategoriesMenuNode = {
  id: string;
  name: string;
  href: string;
  children: CategoriesMenuNode[];
};

/**
 * Variante visual del menú de categorías, configurable por demo
 * (Contenido → "Diseño del menú de categorías"):
 *  - 'hamburger': link con ícono de hamburguesa y panel flotante con submenú
 *    lateral al pasar el mouse (referencia Frávega).
 *  - 'button': pill sólido en el color de marca y desplegable con acordeón
 *    inline para las subcategorías (referencia Arcor en casa).
 */
export type CategoriesMenuVariant = "hamburger" | "button";

const FONT_STYLE = {
  fontFamily: "var(--font-roboto), Roboto, sans-serif",
} as const;

const LABEL = "Categorías";

/**
 * Apertura/cierre compartido por las dos variantes: click en el trigger, click
 * afuera y Escape. El hover NO abre el panel — con el header sticky del
 * storefront un menú que se abre al pasar por encima tapa el buscador sin que
 * el usuario lo haya pedido.
 */
function useMenuState() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}

/**
 * Ícono de hamburguesa que se convierte en X al abrir el menú (patrón "squeeze"
 * de jonsuh.com/hamburgers): la barra de arriba y la de abajo primero se
 * desplazan al centro y RECIÉN AHÍ rotan — de ahí las dos capas por barra, una
 * para el translate y otra para la rotación, cada una con su propio delay. La
 * del medio se desvanece. Al cerrar, el orden se invierte.
 */
const HamburgerIcon = ({ open }: { open: boolean }) => {
  // 16x12 para no dominar al texto de 14px del nav: barras de 2px en posiciones
  // 0 / 5 / 10, así que el desplazamiento al centro es de 5px.
  const bar = "block h-[2px] w-full rounded-full bg-current";
  const shift = "absolute left-0 h-[2px] w-full transition-transform duration-150";
  const rotate = "transition-transform duration-150";

  return (
    <span aria-hidden="true" className="relative block h-[12px] w-[16px]">
      <span
        className={`${shift} top-0 ${
          open ? "translate-y-[5px] delay-0" : "delay-150"
        }`}
      >
        <span
          className={`${bar} ${rotate} ${open ? "rotate-45 delay-150" : "delay-0"}`}
        />
      </span>
      <span
        className={`${bar} absolute top-[5px] left-0 transition-opacity duration-100 ${
          open ? "opacity-0" : "opacity-100 delay-150"
        }`}
      />
      <span
        className={`${shift} top-[10px] ${
          open ? "-translate-y-[5px] delay-0" : "delay-150"
        }`}
      >
        <span
          className={`${bar} ${rotate} ${open ? "-rotate-45 delay-150" : "delay-0"}`}
        />
      </span>
    </span>
  );
};

type Props = {
  categories: CategoriesMenuNode[];
  variant?: CategoriesMenuVariant;
};

/**
 * Entrada "Categorías" del nav de escritorio, antes de "Tienda". Se muestra sólo
 * si el tenant la tiene habilitada y hay categorías con las que armar el menú
 * (ver nav-client). Los links caen en la PLP filtrada (`/store?category=<nombre>`),
 * el mismo formato que usan los filtros de la tienda contra Typesense.
 */
const CategoriesMenu = ({ categories, variant = "hamburger" }: Props) => {
  if (categories.length === 0) return null;
  return variant === "button" ? (
    <ButtonVariant categories={categories} />
  ) : (
    <HamburgerVariant categories={categories} />
  );
};

/* ── Variante 1: hamburguesa + panel con submenú lateral (Frávega) ────────── */

const HamburgerVariant = ({
  categories,
}: {
  categories: CategoriesMenuNode[];
}) => {
  const { open, setOpen, ref } = useMenuState();
  // Categoría cuyo submenú está abierto al costado. Se sigue con el mouse y con
  // el foco de teclado, así el panel también es navegable con Tab.
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = categories.find((c) => c.id === activeId) ?? null;

  return (
    <div className="relative flex items-center self-stretch" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className={`group relative flex items-center gap-1.5 self-stretch whitespace-nowrap text-[14px] leading-5 antialiased transition-colors duration-200 ${
          open
            ? "font-semibold text-[--primary-color]"
            : "font-normal text-[color:var(--header-fg,#374151)] hover:text-[--accent-color]"
        }`}
        onClick={() => setOpen((v) => !v)}
        style={FONT_STYLE}
        type="button"
      >
        <HamburgerIcon open={open} />
        {LABEL}
        {/* Barra inferior anclada al borde de la fila, igual que los links. */}
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t-full transition-colors duration-200 ${
            open ? "bg-[--primary-color]" : "bg-transparent group-hover:bg-[color:var(--header-fg-muted,#d1d5db)]"
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 flex pt-px">
          <ul
            className="max-h-[70vh] w-[280px] overflow-y-auto rounded-b-lg border border-gray-100 bg-white py-2 shadow-lg"
            style={FONT_STYLE}
          >
            {categories.map((category) => {
              const isActive = category.id === activeId;
              return (
                <li key={category.id}>
                  <LocalizedClientLink
                    className={`flex items-center justify-between gap-3 px-5 py-2.5 text-[14px] leading-5 transition-colors duration-150 ${
                      isActive
                        ? "bg-gray-50 text-[--primary-color]"
                        : "text-[#374151] hover:bg-gray-50 hover:text-[--primary-color]"
                    }`}
                    href={category.href}
                    onClick={() => setOpen(false)}
                    onFocus={() => setActiveId(category.id)}
                    onMouseEnter={() => setActiveId(category.id)}
                  >
                    <span className="truncate">{category.name}</span>
                    {category.children.length > 0 && (
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-gray-400"
                      />
                    )}
                  </LocalizedClientLink>
                </li>
              );
            })}
          </ul>

          {/* Submenú lateral: mismo alto máximo que la lista madre, en 1 o 2
              columnas según cuántas subcategorías haya. */}
          {active && active.children.length > 0 && (
            <div
              className="max-h-[70vh] w-[420px] overflow-y-auto rounded-b-lg border border-gray-100 border-l-0 bg-white p-5 shadow-lg"
              onMouseLeave={() => setActiveId(null)}
              style={FONT_STYLE}
            >
              <LocalizedClientLink
                className="font-semibold text-[14px] text-[--primary-color]"
                href={active.href}
                onClick={() => setOpen(false)}
              >
                {active.name}
              </LocalizedClientLink>
              <ul
                className={`mt-3 gap-x-6 ${
                  active.children.length > 6 ? "columns-2" : ""
                }`}
              >
                {active.children.map((child) => (
                  <li className="break-inside-avoid" key={child.id}>
                    <LocalizedClientLink
                      className="block py-1.5 text-[14px] text-[#374151] leading-5 transition-colors duration-150 hover:text-[--primary-color]"
                      href={child.href}
                      onClick={() => setOpen(false)}
                    >
                      {child.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Variante 2: pill sólido + acordeón inline (Arcor en casa) ────────────── */

const ButtonVariant = ({ categories }: { categories: CategoriesMenuNode[] }) => {
  const { open, setOpen, ref } = useMenuState();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="relative flex items-center self-stretch" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[--primary-color] px-3.5 py-1.5 font-medium text-[13px] text-white leading-5 transition-all duration-200 ease-in-out hover:opacity-90"
        onClick={() => setOpen((v) => !v)}
        style={FONT_STYLE}
        type="button"
      >
        <Squares2X2Icon className="h-4 w-4" />
        {LABEL}
        <ChevronDownIcon
          aria-hidden="true"
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          className="absolute top-full left-0 z-50 mt-1.5 max-h-[70vh] w-[300px] overflow-y-auto rounded-lg border border-gray-100 bg-white py-2 shadow-lg"
          style={FONT_STYLE}
        >
          {categories.map((category) => {
            const isExpanded = category.id === expandedId;
            return (
              <li key={category.id}>
                <div className="flex items-center justify-between gap-2 pr-2">
                  <LocalizedClientLink
                    className="min-w-0 flex-1 truncate py-2.5 pl-5 font-medium text-[14px] text-[#374151] leading-5 transition-colors duration-150 hover:text-[--primary-color]"
                    href={category.href}
                    onClick={() => setOpen(false)}
                  >
                    {category.name}
                  </LocalizedClientLink>
                  {category.children.length > 0 && (
                    <button
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Ocultar" : "Ver"} subcategorías de ${category.name}`}
                      className="rounded p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-50 hover:text-[--primary-color]"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : category.id)
                      }
                      type="button"
                    >
                      {isExpanded ? (
                        <MinusSmallIcon className="h-5 w-5" />
                      ) : (
                        <PlusSmallIcon className="h-5 w-5" />
                      )}
                    </button>
                  )}
                </div>
                {isExpanded && category.children.length > 0 && (
                  <ul className="mb-1 border-gray-100 border-l pb-1 pl-5 ml-5">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <LocalizedClientLink
                          className="block py-1.5 text-[13px] text-gray-500 leading-5 transition-colors duration-150 hover:text-[--primary-color]"
                          href={child.href}
                          onClick={() => setOpen(false)}
                        >
                          {child.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CategoriesMenu;
