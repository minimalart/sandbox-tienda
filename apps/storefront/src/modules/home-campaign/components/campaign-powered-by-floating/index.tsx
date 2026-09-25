import { getActiveTenant } from "@lib/site-config/active-tenant";
import "../../campaign-theme.css";

/**
 * Pill flotante "Powered by" del template Campaña — iteración visual.
 *
 * Se monta desde el layout `(main)` solo cuando el template activo es Campaign
 * y consume `chrome.poweredByImage` / `footer.poweredBy.image` (fields que ya
 * existen en la config). Renderiza SOLO la imagen dentro de un contenedor
 * flotante con sombra: sin texto "Powered by", sin label. Mismo tratamiento
 * visual que el pill inline del header (max-h + object-contain, aspect ratio
 * natural del asset). Sin imagen devuelve null. Cuando aterrice el toggle
 * desde admin este check pasa a leer `campaign.poweredByFloating`.
 */
export default async function CampaignPoweredByFloating() {
  const tenant = await getActiveTenant();
  const campaign = tenant.assets.campaign;
  if (!campaign) return null;

  const chrome = campaign.chrome;
  const footer = campaign.footer;

  const image =
    chrome?.poweredByImage?.trim() ||
    footer?.poweredBy?.image?.trim() ||
    undefined;
  if (!image) return null;

  const label =
    chrome?.poweredByLabel?.trim() ||
    footer?.poweredBy?.label?.trim() ||
    undefined;
  const href =
    chrome?.poweredByHref?.trim() ||
    footer?.poweredBy?.href?.trim() ||
    undefined;

  const wrapperClass =
    "fixed bottom-4 right-4 z-40 inline-flex items-center rounded-full bg-white px-4 py-2 ring-1 ring-black/10 transition shadow-[0_28px_60px_-8px_rgba(0,0,0,0.55),0_10px_24px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_36px_75px_-10px_rgba(0,0,0,0.65),0_14px_30px_-4px_rgba(0,0,0,0.35)]";

  const img = (
    <img
      src={image}
      alt={label || `Powered by ${tenant.name}`}
      className="max-h-7 w-auto object-contain sm:max-h-9"
    />
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
        aria-label={label ? `Powered by ${label}` : "Powered by"}
      >
        {img}
      </a>
    );
  }

  return <div className={wrapperClass}>{img}</div>;
}
