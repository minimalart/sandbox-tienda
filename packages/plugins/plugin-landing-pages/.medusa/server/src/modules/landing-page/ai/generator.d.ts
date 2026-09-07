import { type PuckData } from './puck-schema';
import { type GenerateLandingInput, type ImproveCopyInput, type LandingSeo, type SeoInput, type TranslateInput } from './types';
/**
 * Config de IA para generación de texto, resuelta desde store-config (con
 * fallback a los defaults de env). Se pasa desde la route.
 */
export type AiTextConfig = {
    model?: string;
    maxRetries?: number;
};
export declare function generateLandingPuckData(input: GenerateLandingInput, aiConfig?: AiTextConfig): Promise<PuckData>;
export declare function improveLandingCopy(input: ImproveCopyInput, aiConfig?: AiTextConfig): Promise<PuckData>;
export declare function translateLanding(input: TranslateInput, aiConfig?: AiTextConfig): Promise<PuckData>;
export declare function generateLandingSeo(input: SeoInput, aiConfig?: AiTextConfig): Promise<LandingSeo>;
