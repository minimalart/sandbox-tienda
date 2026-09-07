"use client";

import { useTenantBrand } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Reveal from "@modules/common/components/reveal";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

type FeaturedCategory = {
  id: string;
  title: string;
  image?: string;
  badge?: string;
  badgeVariant?: "dark" | "light";
  href: string;
  isAction?: boolean;
};

const categories: FeaturedCategory[] = [
  {
    id: "indumentaria",
    title: "Indumentaria",
    href: "/categories/indumentaria",
  },
  {
    id: "calzado",
    title: "Calzado",
    href: "/categories/calzado",
  },
  {
    id: "accesorios",
    title: "Accesorios",
    href: "/categories/accesorios",
  },
  {
    id: "ver-todas",
    title: "Ver todas",
    href: "/store",
    isAction: true,
  },
];

const CategoriesSection = () => {
  const { featuredCategories } = useTenantBrand();

  // Usar categorías del tenant si están disponibles, sino usar las hardcodeadas
  const availableCategories =
    featuredCategories?.categories && featuredCategories.categories.length > 0
      ? featuredCategories.categories
      : categories;

  const sectionTitle = featuredCategories?.title || "Categorías destacadas";

  return (
    <Reveal as="section" className="bg-white py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="home-section-heading mb-10 text-center">
          {sectionTitle}
        </p>

        <div className="relative -mx-4 overflow-hidden sm:mx-0">
          <div className="no-scrollbar flex snap-x snap-mandatory items-center gap-5 overflow-x-auto px-4 py-2 sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-10 sm:overflow-visible sm:px-0">
            {availableCategories.map((category, index) => (
              <Reveal
                as="div"
                className="min-w-[88px] snap-start snap-always"
                delay={index * 60}
                key={category.id}
              >
                <LocalizedClientLink
                  className="flex flex-col items-center gap-2 text-center transition-transform duration-200 ease-in-out hover:scale-105"
                  href={category.href}
                >
                  <div className="relative">
                    {category.isAction ? (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-gray-900 transition-colors duration-200 ease-in-out hover:bg-gray-900 hover:text-white sm:h-24 sm:w-24">
                        <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                    ) : (
                      <div className="relative h-20 w-20 rounded-full border border-gray-200 p-1 transition-colors duration-200 ease-in-out hover:border-gray-900 sm:h-24 sm:w-24">
                        <div className="relative h-full w-full overflow-hidden rounded-full">
                          {category.image ? (
                            <Image
                              alt={category.title}
                              className="object-contain max-w-[84px] max-h-[86px]"
                              fill
                              sizes="96px"
                              src={category.image}
                            />
                          ) : (
                            <div className="h-full w-full rounded-full bg-gray-100" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-800 sm:text-sm">
                    {category.title}
                  </span>
                </LocalizedClientLink>
              </Reveal>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white sm:hidden"
            aria-hidden="true"
          />
        </div>
      </div>
    </Reveal>
  );
};

export default CategoriesSection;
