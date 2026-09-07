"use client";

import { useEffect } from "react";

/**
 * Bloqueo de scroll del fondo robusto para móvil.
 *
 * Solo `overflow: hidden` en el body NO evita el scroll táctil del contenido
 * de fondo (el scroll ocurre en documentElement y se "encadena" desde el panel
 * scrolleable del modal). El patrón confiable es fijar el body con
 * `position: fixed` preservando la posición actual y restaurándola al cerrar.
 *
 * Está referenciado por contador: si hay varios modales/drawers abiertos a la
 * vez (o uno abre a otro), el bloqueo se aplica una sola vez y solo se restaura
 * cuando se cierra el último. Recordá agregar `overscroll-contain` al panel
 * interno scrolleable para cortar el scroll-chaining.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

const applyLock = () => {
  const { body } = document;
  savedScrollY = window.scrollY;
  savedStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
};

const releaseLock = () => {
  const { body } = document;
  if (savedStyles) {
    body.style.position = savedStyles.position;
    body.style.top = savedStyles.top;
    body.style.left = savedStyles.left;
    body.style.right = savedStyles.right;
    body.style.width = savedStyles.width;
    body.style.overflow = savedStyles.overflow;
    savedStyles = null;
  }
  window.scrollTo(0, savedScrollY);
};

export const useScrollLock = (locked: boolean): void => {
  useEffect(() => {
    if (!locked) return;
    if (lockCount === 0) applyLock();
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
};
