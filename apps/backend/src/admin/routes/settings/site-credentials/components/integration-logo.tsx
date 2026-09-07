const logos: Record<string, string> = {
  catalogador: new URL('../logos/catalogador.png', import.meta.url).href,
  delivery: new URL('../logos/delivery.png', import.meta.url).href,
  newsletter: new URL('../logos/newsletter.png', import.meta.url).href,
  andreani: new URL('../logos/andreani.png', import.meta.url).href,
  arca: new URL('../logos/arca.png', import.meta.url).href,
  'correo-argentino': new URL('../logos/correo-argentino.png', import.meta.url).href,
  embeddings: new URL('../logos/embeddings.png', import.meta.url).href,
  erp: new URL('../logos/erp.png', import.meta.url).href,
  ga4: new URL('../logos/ga4.png', import.meta.url).href,
  kapso: new URL('../logos/kapso.png', import.meta.url).href,
  mercadopago: new URL('../logos/mercadopago.png', import.meta.url).href,
  openrouter: new URL('../logos/openrouter.png', import.meta.url).href,
  sendgrid: new URL('../logos/sendgrid.png', import.meta.url).href,
  typesense: new URL('../logos/typesense.png', import.meta.url).href,
  videos: new URL('../logos/videos.png', import.meta.url).href,
};
const mercattoLogo = new URL('../logos/mercatto.svg', import.meta.url).href;
export const IntegrationLogo = ({ id, label }: { id: string; label: string }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ui-border-base bg-white">
    <img
      src={logos[id] ?? mercattoLogo}
      alt={label}
      width={28}
      height={28}
      className="h-7 w-7 object-contain"
    />
  </span>
);
