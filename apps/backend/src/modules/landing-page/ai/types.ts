import type { PuckData } from './puck-schema';

export type LandingAiMode = 'replace' | 'append' | 'draft_only';

/** Input para generar una landing completa desde un brief. */
export type GenerateLandingInput = {
  brief: string;
  tone?: string;
  goal?: string;
  audience?: string;
  locale?: string;
  campaign?: string;
  /** Subconjunto de componentes permitidos a priorizar. */
  components?: string[];
  /** puck_data actual cuando se está mejorando/expandiendo una landing. */
  currentPuckData?: PuckData | null;
  /** Contexto opcional de productos/colecciones (texto libre). */
  productContext?: string;
};

/** Input para mejorar sólo los textos, conservando estructura. */
export type ImproveCopyInput = {
  instruction: string;
  locale?: string;
  currentPuckData: PuckData;
};

/** Input para traducir textos conservando estructura/links/handles. */
export type TranslateInput = {
  targetLocale: string;
  currentPuckData: PuckData;
};

/** Input para generar SEO. */
export type SeoInput = {
  locale?: string;
  keywords?: string[];
  title: string;
  currentPuckData?: PuckData | null;
};

export type LandingSeo = {
  title: string;
  description: string;
  image: string;
  noindex: boolean;
};

/** Error tipado para que las rutas devuelvan el status correcto. */
export class LandingAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'LandingAiError';
    this.status = status;
  }
}

export type { PuckData };
