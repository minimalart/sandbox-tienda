import { getLandingAiSettings } from '../settings';
import { LandingAiError } from './types';

/**
 * Cliente de generación de IMÁGENES vía OpenRouter (compatible OpenAI), usando
 * por default el modelo "nano banana" (Google Gemini 2.5 Flash Image). A
 * diferencia del cliente de texto, manda `modalities: ['image','text']` y NO
 * `response_format` (rompería la salida de imagen). La imagen vuelve como data
 * URL base64 en `choices[0].message.images[0].image_url.url`.
 *
 * La API key (OPENROUTER_API_KEY) sigue siendo un SECRETO, pero ya no un secreto
 * de entorno: se edita en la card del Asistente IA, que es su dueña, y acá se lee
 * el mismo valor efectivo por `landing-page/settings.ts`. El modelo de imagen y
 * los demás parámetros siguen llegando desde store-config, resueltos en la route.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
const REQUEST_TIMEOUT_MS = 30_000;

export type AspectRatio = '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
};

export async function generateImage(opts: {
  prompt: string;
  model?: string;
  aspectRatio?: AspectRatio;
  imageSize?: '0.5K' | '1K' | '2K';
  /**
   * Imágenes de referencia (data URLs `data:image/...;base64,...`) que el modelo
   * debe usar como base. Con nano banana (Gemini 2.5 Flash Image) sirve para
   * COMPONER una escena manteniendo fieles los productos de las fotos. Se mandan
   * como partes `image_url` del mensaje (formato multimodal OpenAI-compatible).
   */
  referenceImages?: string[];
}): Promise<GeneratedImage> {
  const { apiKey, siteUrl } = getLandingAiSettings();
  if (!apiKey) {
    throw new LandingAiError('OPENROUTER_API_KEY no está configurada en el backend.', 503);
  }
  const model = opts.model?.trim() || DEFAULT_IMAGE_MODEL;

  // Con referencias, el `content` pasa de string a array multimodal (texto +
  // una parte image_url por cada foto). Sin referencias, se mantiene como string
  // para no cambiar el comportamiento de las landings.
  const refs = (opts.referenceImages ?? []).filter((u) => typeof u === 'string' && u.startsWith('data:'));
  const userContent =
    refs.length > 0
      ? [
          { type: 'text', text: opts.prompt },
          ...refs.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
      : opts.prompt;

  // Con referencias, componer suele tardar más: ampliamos el timeout.
  const timeoutMs = refs.length > 0 ? 60_000 : REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'Mercatto Landing Builder',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: opts.aspectRatio ?? '16:9',
          image_size: opts.imageSize ?? '1K',
        },
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new LandingAiError('Timeout generando la imagen con IA.', 504);
    }
    throw new LandingAiError(
      `No se pudo conectar con OpenRouter: ${(err as Error).message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LandingAiError(`OpenRouter respondió ${res.status}: ${body.slice(0, 300)}`, 502);
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{
      message?: { images?: Array<{ image_url?: { url?: string } }> };
    }>;
  } | null;

  const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new LandingAiError('El modelo no devolvió ninguna imagen.', 502);
  }

  // data:image/png;base64,XXXX → mime + bytes
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  const mimeType = match?.[1] ?? 'image/png';
  const b64 = match?.[2] ?? '';
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length === 0) {
    throw new LandingAiError('La imagen devuelta por el modelo está vacía.', 502);
  }

  return { bytes, mimeType };
}
