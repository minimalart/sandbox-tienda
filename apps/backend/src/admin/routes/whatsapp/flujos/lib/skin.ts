/**
 * LOS COLORES DEL EDITOR.
 *
 * ─── EL CAMBIO QUE IMPORTA ───────────────────────────────────────────────────────
 *
 * La tarjeta es BLANCA y el color vive en un cuadrado chico con el ícono del tipo.
 * Antes la tarjeta entera se pintaba del color del tipo, y eso tenía dos problemas
 * concretos: con nueve colores saturados el canvas se leía como un mosaico y no como
 * un recorrido, y el texto del mensaje —que es lo que se vino a mostrar— competía
 * con su propio fondo. Con el cuadrado, el tipo se reconoce igual de rápido y el
 * contenido queda sobre blanco.
 *
 * Las dos excepciones son los extremos, y son a propósito: la Entrada va llena de
 * verde porque es de donde arranca todo, y el Fin sobre rosa muy claro porque es
 * donde termina. Los extremos de un diagrama se buscan con la vista, no leyendo.
 *
 * Van como estilo calculado y no como clases de Tailwind porque Tailwind no escanea
 * strings armados en runtime: `bg-[${color}]` no genera CSS y el nodo saldría
 * transparente, sin que falle el build ni el typecheck.
 */

import type { NodeType } from '../_editor';

/** Paleta de WhatsApp, para el simulador y los acentos verdes. */
export const WA = {
  brand: '#25D366',
  teal: '#128C7E',
  tealDeep: '#075E54',
  blue: '#34B7F1',
  sentLight: '#DCF8C6',
  sentDark: '#005C4B',
  bubbleDark: '#202C33',
  surfaceDark: '#111B21',
} as const;

export type NodeSkin = {
  /** El cuadrado del ícono, el conector y la flecha que sale del paso. */
  accent: string;
  /** Fondo de la tarjeta. Blanco salvo en los extremos. */
  bg: string;
  /** Texto principal. */
  fg: string;
  /** Borde de la tarjeta en reposo. */
  border: string;
  /** El ícono adentro del cuadrado. */
  onAccent: string;
};

const claro = (accent: string): NodeSkin => ({
  accent,
  bg: '#FFFFFF',
  fg: '#111827',
  border: '#E5E7EB',
  onAccent: '#FFFFFF',
});

const oscuro = (accent: string): NodeSkin => ({
  accent,
  bg: '#1E2A33',
  fg: '#E9EDEF',
  border: '#33414B',
  onAccent: '#FFFFFF',
});

/**
 * Un color por tipo, elegido para que se distingan de un vistazo y no para decorar:
 * verde lo que habla, violeta/azul/ámbar lo que pregunta, rosa lo que decide,
 * grafito lo que ejecuta, y rojo el final.
 */
const ACCENT: Record<NodeType, string> = {
  start: '#16A34A',
  message: '#16A34A',
  ask_buttons: '#7C3AED',
  ask_list: '#2563EB',
  ask_text: '#F59E0B',
  condition: '#EC4899',
  action: '#374151',
  // El agente va en el violeta del asistente: es el mismo del icono de Asistente en
  // el menú, así que se lee de dónde sale lo que va a contestar.
  agent: '#8B5CF6',
  handoff: '#475569',
  end: '#EF4444',
};

const ACCENT_DARK: Record<NodeType, string> = {
  ...ACCENT,
  action: '#6B7280',
  handoff: '#7C8CA1',
};

export const SKIN: Record<'light' | 'dark', Record<NodeType, NodeSkin>> = {
  light: {
    // La Entrada va LLENA: es de donde arranca todo y se busca con la vista.
    start: { ...claro(ACCENT.start), bg: ACCENT.start, fg: '#FFFFFF', border: '#15803D' },
    message: claro(ACCENT.message),
    ask_buttons: claro(ACCENT.ask_buttons),
    ask_list: claro(ACCENT.ask_list),
    ask_text: claro(ACCENT.ask_text),
    condition: claro(ACCENT.condition),
    action: claro(ACCENT.action),
    agent: claro(ACCENT.agent),
    handoff: claro(ACCENT.handoff),
    // El Fin sobre rosa muy claro: cierra sin gritar.
    end: { ...claro(ACCENT.end), bg: '#FEF2F2', border: '#FECACA' },
  },
  dark: {
    start: { ...oscuro(ACCENT_DARK.start), bg: '#15803D', fg: '#FFFFFF', border: '#166534' },
    message: oscuro(ACCENT_DARK.message),
    ask_buttons: oscuro(ACCENT_DARK.ask_buttons),
    ask_list: oscuro(ACCENT_DARK.ask_list),
    ask_text: oscuro(ACCENT_DARK.ask_text),
    condition: oscuro(ACCENT_DARK.condition),
    action: oscuro(ACCENT_DARK.action),
    agent: oscuro(ACCENT_DARK.agent),
    handoff: oscuro(ACCENT_DARK.handoff),
    end: { ...oscuro(ACCENT_DARK.end), bg: '#3A2427', border: '#5B3338' },
  },
};

/** Rojo del borde de un paso con problemas. Legible sobre los dos fondos. */
export const ERROR_BORDER = { light: '#D32F2F', dark: '#F15C5C' } as const;

/** El fondo de una fila de respuesta dentro de la tarjeta. */
export const optionRow = (isDark: boolean): { bg: string; border: string } =>
  isDark ? { bg: '#26333C', border: '#38474F' } : { bg: '#F9FAFB', border: '#E5E7EB' };

/**
 * Los colores de una flecha según lo que le pasa.
 *
 * En reposo va apagada; resaltada, más oscura. Una flecha que sale de una respuesta
 * toma el color del paso de origen —eso es lo que deja seguir una rama con la vista
 * en un recorrido de treinta flechas— y esa parte la decide la proyección.
 */
export function edgeColors(isDark: boolean): {
  rest: string;
  highlighted: string;
  broken: string;
  traced: string;
  labelBg: string;
} {
  return {
    rest: isDark ? '#5E6E76' : '#C3CAD1',
    highlighted: isDark ? '#9AA8B2' : '#6B7280',
    broken: ERROR_BORDER[isDark ? 'dark' : 'light'],
    // El verde de la marca para el camino que recorrió la prueba: es el color que la
    // gente ya asocia con WhatsApp, y no compite con el rojo de los problemas.
    traced: isDark ? WA.brand : WA.teal,
    labelBg: isDark ? '#1E2A33' : '#FFFFFF',
  };
}

/** La sombra despega la tarjeta del fondo. Suave: son muchas juntas. */
export const shadowFor = (isDark: boolean): string =>
  isDark ? '0 1px 3px rgba(0,0,0,.45)' : '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)';

/** El fondo del canvas (la grilla) por tema. */
export const backgroundDot = (isDark: boolean): string => (isDark ? '#2A3942' : '#DDE1E6');

/** El fondo del panel del minimapa por tema. */
export const minimapSurface = (isDark: boolean): string => (isDark ? WA.surfaceDark : '#F7F8FA');

/** La máscara del minimapa (lo que queda fuera del viewport). */
export const minimapMask = (isDark: boolean): string =>
  isDark ? 'rgba(11,20,26,.6)' : 'rgba(226,232,240,.6)';
