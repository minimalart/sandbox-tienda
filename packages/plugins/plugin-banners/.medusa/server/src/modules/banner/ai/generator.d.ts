import { type GenerateBannerCopyInput } from './prompts';
export type GeneratedBannerCopy = {
    content: {
        title: string;
        subtitle: string;
        body: string;
    };
    cta: {
        label: string;
        url: string;
    };
};
export type BannerAiTextConfig = {
    model?: string;
    maxRetries?: number;
};
/**
 * Genera el copy de un banner (title/subtitle/body + CTA) con OpenRouter.
 * Reutiliza el cliente del módulo landing-page. Reintenta hasta `maxRetries`.
 */
export declare function generateBannerCopy(input: GenerateBannerCopyInput, aiConfig?: BannerAiTextConfig): Promise<GeneratedBannerCopy>;
