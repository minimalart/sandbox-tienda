import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, Layers3 } from 'lucide-react';
import { getSpaceConfigurators } from '@lib/data/space-designer';
import LocalizedClientLink from '@modules/common/components/localized-client-link';

export const metadata: Metadata = {
  title: 'Diseñá tu espacio',
  description: 'Elegí un espacio equipado y adaptalo con productos de nuestra tienda.',
};

export default async function SpacesPage() {
  const configurators = await getSpaceConfigurators();
  if (configurators.length === 0) notFound();
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16">
      <span className="text-xs font-medium uppercase tracking-widest text-gray-500">
        Ideas que toman forma
      </span>
      <h1 className="mt-3 text-4xl font-medium tracking-tight text-gray-900">Diseñá tu espacio</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-gray-500">
        Partí de una propuesta equipada, encontrá la distribución que te gusta y llevá todos los
        productos al carrito.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {configurators.map((configurator) => {
          const image = configurator.config.templates.find(
            (template) => template.image_url
          )?.image_url;
          return (
            <LocalizedClientLink
              key={configurator.id}
              href={`/espacios/${configurator.slug}`}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="flex h-60 items-center justify-center overflow-hidden bg-[#f0f3eb]">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <Layers3 className="h-16 w-16 text-[#8ca183]" strokeWidth={1} />
                )}
              </div>
              <div className="p-6">
                <h2 className="text-xl font-medium tracking-tight">{configurator.title}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  {configurator.config.description ||
                    'Elegí una propuesta y hacela tuya con productos reales de la tienda.'}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-medium text-[#345139]">
                  <span>{configurator.config.templates.length} espacios equipados</span>
                  <span className="flex items-center gap-2">
                    Explorar <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </LocalizedClientLink>
          );
        })}
      </div>
    </div>
  );
}
