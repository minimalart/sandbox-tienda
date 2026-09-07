import { getTenant } from "@lib/site-config/resolver";
import { canonicalUrl } from '@lib/util/site-url';
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  
  return {
    title: 'Nosotros',
    // El sufijo de marca lo pone el `title.template` del root layout: repetirlo acá
    // emitía `Página | Marca | Marca`.
    alternates: { canonical: await canonicalUrl("/about") },
    description: `Conocé la historia y filosofía de ${tenant.name}.`,
  };
}

export default async function AboutPage() {
  const tenant = await getTenant();
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <p className="text-[--primary-color] text-sm uppercase tracking-wide">
          Nosotros
        </p>
        <h1 className="mt-3 font-semibold text-4xl text-gray-900">
          Inspirados por la sensorialidad
        </h1>
        <p className="mt-6 text-base text-gray-600">
          {tenant.name} nace con la misión de transformar espacios cotidianos a
          través de aromas memorables. Diseñamos colecciones que combinan
          calidad, sustentabilidad y tecnología para que cada ambiente tenga una
          identidad auténtica.
        </p>
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-semibold text-2xl text-gray-900">
              Diseño consciente
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Colaboramos con estudios creativos y laboratorios regionales para
              asegurar procesos responsables en cada etapa. Desde la elección de
              las materias primas hasta el packaging final, cuidamos cada
              detalle para ofrecer piezas que perduren.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-2xl text-gray-900">
              Experiencias personalizadas
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Trabajamos junto a marcas, hoteles y estudios para crear
              experiencias a medida. Nuestro equipo acompaña el proceso de
              selección de fragancias, montaje de equipos y capacitación para
              que cada implementación sea impecable.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
