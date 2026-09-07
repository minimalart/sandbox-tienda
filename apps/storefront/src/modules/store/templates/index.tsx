"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { HttpTypes } from "@medusajs/types";
import CheckboxInput from "@modules/common/components/checkbox-input";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import SearchSortBar from "@modules/store/components/search-sort-bar";
import { useUIStore } from "@lib/stores";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

type FilterOption = {
  value: string;
  label: string;
  children?: FilterOption[];
};
type FilterSection = {
  id: string;
  name: string;
  options: FilterOption[];
  hasChildren?: boolean;
};

type NavigationCategory = {
  id: string;
  name: string;
  featured: {
    name: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
  }[];
  sections: {
    id: string;
    name: string;
    items: { name: string; href: string }[];
  }[];
};

type Navigation = {
  categories: NavigationCategory[];
  pages: { name: string; href: string }[];
};

type StoreTemplateProps = {
  sortBy?: SortOptions;
  page?: string;
  countryCode: string;
  collections: HttpTypes.StoreCollection[];
  categories: HttpTypes.StoreProductCategory[];
  children: React.ReactNode;
  searchQuery?: string;
};

const mapNavigation = (
  collections?: HttpTypes.StoreCollection[],
  categories?: HttpTypes.StoreProductCategory[],
): Navigation => {
  const safeCollections = collections ?? [];
  const safeCategories = categories ?? [];
  const categorySection: NavigationCategory = {
    id: "aromapop",
    name: "Colecciones",
    featured: safeCollections.slice(0, 2).map((collection, index) => ({
      name: collection.title ?? "Colección",
      href: `/collections/${collection.handle}`,
      imageSrc:
        "https://tailwindcss.com/plus-assets/img/ecommerce-images/mega-menu-category-01.jpg",
      imageAlt: collection.title ?? "Colección Aromapop",
    })),
    sections: [
      {
        id: "collections",
        name: "Colecciones",
        items: safeCollections.slice(0, 8).map((collection) => ({
          name: collection.title ?? "Colección",
          href: `/collections/${collection.handle}`,
        })),
      },
      {
        id: "categories",
        name: "Categorías",
        items: safeCategories.slice(0, 8).map((category) => ({
          name: category.name ?? "Categoría",
          href: `/store?category=${encodeURIComponent(category.name ?? "")}`,
        })),
      },
    ],
  };

  return {
    categories:
      safeCategories.length || safeCollections.length ? [categorySection] : [],
    pages: [{ name: "Tienda", href: "/store" }],
  };
};

const mapCategoryToOption = (
  category: HttpTypes.StoreProductCategory,
): FilterOption => {
  const children = category.category_children ?? [];
  return {
    value: category.handle!,
    label: category.name ?? "Categoría",
    ...(children.length > 0
      ? { children: children.map(mapCategoryToOption) }
      : {}),
  };
};

const buildFilters = (
  collections?: HttpTypes.StoreCollection[],
  categories?: HttpTypes.StoreProductCategory[],
): FilterSection[] => {
  const parentCategories = (categories ?? []).filter(
    (cat) => !cat.parent_category_id,
  );

  return [
    {
      id: "collections",
      name: "Colecciones",
      options: (collections ?? []).map((collection) => ({
        value: collection.handle!,
        label: collection.title ?? "Colección",
      })),
    },
    {
      id: "categories",
      name: "Categorías",
      hasChildren: true,
      options: parentCategories.map(mapCategoryToOption),
    },
  ];
};

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
  collections,
  categories,
  children,
  searchQuery,
}: StoreTemplateProps) => {
  const { isMobileFiltersOpen, openMobileFilters, closeMobileFilters } =
    useUIStore();
  const [isPending, startTransition] = useTransition();

  const pageNumber = page ? Number.parseInt(page) : 1;
  const sort = sortBy || "relevance";

  const filters = useMemo(
    () => buildFilters(collections, categories),
    [collections, categories],
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? null;
  const activeCollection = searchParams.get("collection") ?? null;

  const handleFilterChange = (sectionId: string, value: string) => {
    const isCategory = sectionId === "categories";

    const nextCategory = isCategory
      ? activeCategory === value
        ? null
        : value
      : activeCategory;

    const nextCollection = isCategory
      ? activeCollection
      : activeCollection === value
        ? null
        : value;

    const params = new URLSearchParams(searchParams);
    params.delete("category");
    params.delete("collection");
    params.delete("q");
    params.delete("page");

    if (nextCategory) {
      params.set("category", nextCategory);
    }

    if (nextCollection) {
      params.set("collection", nextCollection);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="bg-white">
      <div>
        <Dialog
          className="relative z-40 lg:hidden"
          onClose={closeMobileFilters}
          open={isMobileFiltersOpen}
        >
          <DialogBackdrop
            className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-closed:opacity-0"
            transition
          />
          <div className="fixed inset-0 z-40 flex">
            <DialogPanel
              className="relative ml-auto flex h-full w-full max-w-xs transform flex-col overflow-y-auto bg-white py-4 pb-12 shadow-xl transition duration-300 ease-in-out data-closed:translate-x-full"
              transition
            >
              <div className="flex items-center justify-between px-4">
                <h2 className="font-medium text-gray-900 text-lg">Filtros</h2>
                <button
                  className="-mr-2 flex size-10 items-center justify-center rounded-md bg-white p-2 text-gray-400"
                  onClick={closeMobileFilters}
                  type="button"
                >
                  <span className="sr-only">Cerrar menú</span>
                  <XMarkIcon aria-hidden="true" className="size-6" />
                </button>
              </div>

              {/* Filters */}
              <form className="mt-4 border-gray-200 border-t">
                {filters.map((section) => (
                  <Disclosure
                    as="div"
                    className="border-gray-200 border-t px-4 py-6"
                    defaultOpen
                    key={section.id}
                  >
                    {({ open }) => (
                      <>
                        <h3 className="-mx-2 -my-3 flow-root">
                          <DisclosureButton className="group flex w-full items-center justify-between bg-white px-2 py-3 text-gray-400 hover:text-gray-500">
                            <span className="font-medium text-gray-900">
                              {section.name}
                            </span>
                            <span className="ml-6 flex items-center">
                              {open ? (
                                <MinusIcon
                                  aria-hidden="true"
                                  className="size-5"
                                  style={{
                                    color: "#1E1E1E",
                                    strokeWidth: 1.33,
                                  }}
                                />
                              ) : (
                                <PlusIcon
                                  aria-hidden="true"
                                  className="size-5"
                                  style={{
                                    color: "#1E1E1E",
                                    strokeWidth: 1.33,
                                  }}
                                />
                              )}
                            </span>
                          </DisclosureButton>
                        </h3>
                        <DisclosurePanel className="pt-6">
                          <div className="space-y-6">
                            {section.options.map((option, optionIdx) => (
                              <div key={option.value}>
                                {section.hasChildren &&
                                option.children &&
                                option.children.length > 0 ? (
                                  <Disclosure as="div" defaultOpen>
                                    {({ open: categoryOpen }) => (
                                      <>
                                        <DisclosureButton className="flex w-full items-center justify-between py-2 text-left">
                                          <span className="font-semibold text-gray-900">
                                            {option.label}
                                          </span>
                                          <span className="ml-6 flex items-center">
                                            {categoryOpen ? (
                                              <ChevronDownIcon
                                                aria-hidden="true"
                                                className="size-5"
                                                style={{
                                                  color: "#1E1E1E",
                                                  strokeWidth: 1.33,
                                                }}
                                              />
                                            ) : (
                                              <ChevronUpIcon
                                                aria-hidden="true"
                                                className="size-5"
                                                style={{
                                                  color: "#1E1E1E",
                                                  strokeWidth: 1.33,
                                                }}
                                              />
                                            )}
                                          </span>
                                        </DisclosureButton>
                                        <DisclosurePanel className="mt-3 space-y-3 pl-0">
                                          {option?.children?.map(
                                            (child, childIdx) => (
                                              <div
                                                className="flex gap-3"
                                                key={child.value}
                                              >
                                                <div className="flex h-5 shrink-0 items-center">
                                                  <CheckboxInput
                                                    checked={
                                                      activeCategory ===
                                                      child.value
                                                    }
                                                    disabled={isPending}
                                                    id={`filter-mobile-${section.id}-${optionIdx}-${childIdx}`}
                                                    name={`${section.id}[]`}
                                                    onChange={() =>
                                                      handleFilterChange(
                                                        section.id,
                                                        child.value,
                                                      )
                                                    }
                                                  />
                                                </div>
                                                <label
                                                  className="min-w-0 flex-1 text-gray-500 text-sm"
                                                  htmlFor={`filter-mobile-${section.id}-${optionIdx}-${childIdx}`}
                                                >
                                                  {child.label}
                                                </label>
                                              </div>
                                            ),
                                          )}
                                        </DisclosurePanel>
                                      </>
                                    )}
                                  </Disclosure>
                                ) : (
                                  <div className="flex gap-3">
                                    <div className="flex h-5 shrink-0 items-center">
                                      <CheckboxInput
                                        checked={
                                          section.id === "categories"
                                            ? activeCategory === option.value
                                            : activeCollection === option.value
                                        }
                                        disabled={isPending}
                                        id={`filter-mobile-${section.id}-${optionIdx}`}
                                        name={`${section.id}[]`}
                                        onChange={() =>
                                          handleFilterChange(
                                            section.id,
                                            option.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <label
                                      className="min-w-0 flex-1 text-gray-500"
                                      htmlFor={`filter-mobile-${section.id}-${optionIdx}`}
                                    >
                                      {option.label}
                                    </label>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </DisclosurePanel>
                      </>
                    )}
                  </Disclosure>
                ))}
              </form>
            </DialogPanel>
          </div>
        </Dialog>
      </div>

      <main className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="pt-12 pb-24 lg:flex lg:gap-10">
          <aside className="lg:w-64 lg:flex-shrink-0 xl:w-72">
            <h2 className="sr-only">Filtros</h2>

            <div className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)]">
              <div className="space-y-8 py-6">
                <form className="space-y-8">
                  {filters.map((section) => (
                    <Disclosure
                      as="div"
                      className="border-gray-200 border-b pb-6"
                      defaultOpen
                      key={section.id}
                    >
                      {({ open }) => (
                        <>
                          <h3 className="-my-3 flow-root">
                            <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-gray-400 text-sm hover:text-gray-500">
                              <span className="font-medium text-gray-900">
                                {section.name}
                              </span>
                              <span className="ml-6 flex items-center">
                                {open ? (
                                  <MinusIcon
                                    aria-hidden="true"
                                    className="size-5"
                                    style={{
                                      color: "#1E1E1E",
                                      strokeWidth: 1.33,
                                    }}
                                  />
                                ) : (
                                  <PlusIcon
                                    aria-hidden="true"
                                    className="size-5"
                                    style={{
                                      color: "#1E1E1E",
                                      strokeWidth: 1.33,
                                    }}
                                  />
                                )}
                              </span>
                            </DisclosureButton>
                          </h3>
                          <DisclosurePanel className="pt-6">
                            <div className="space-y-4">
                              {section.options.map((option, optionIdx) => (
                                <div key={option.value}>
                                  {section.hasChildren &&
                                  option.children &&
                                  option.children.length > 0 ? (
                                    <Disclosure as="div" defaultOpen>
                                      {({ open: categoryOpen }) => (
                                        <>
                                          <DisclosureButton className="flex w-full items-center justify-between py-2 text-left">
                                            <span className="font-semibold text-gray-900 text-sm">
                                              {option.label}
                                            </span>
                                            <span className="ml-6 flex items-center">
                                              {categoryOpen ? (
                                                <ChevronDownIcon
                                                  aria-hidden="true"
                                                  className="size-5"
                                                  style={{
                                                    color: "#1E1E1E",
                                                    strokeWidth: 1.33,
                                                  }}
                                                />
                                              ) : (
                                                <ChevronUpIcon
                                                  aria-hidden="true"
                                                  className="size-5"
                                                  style={{
                                                    color: "#1E1E1E",
                                                    strokeWidth: 1.33,
                                                  }}
                                                />
                                              )}
                                            </span>
                                          </DisclosureButton>
                                          <DisclosurePanel className="mt-3 space-y-3 pl-0">
                                            {option?.children?.map(
                                              (child, childIdx) => (
                                                <div
                                                  className="flex gap-3"
                                                  key={child.value}
                                                >
                                                  <div className="flex h-5 shrink-0 items-center">
                                                    <CheckboxInput
                                                      checked={
                                                        activeCategory ===
                                                        child.value
                                                      }
                                                      disabled={isPending}
                                                      id={`filter-${section.id}-${optionIdx}-${childIdx}`}
                                                      name={`${section.id}[]`}
                                                      onChange={() =>
                                                        handleFilterChange(
                                                          section.id,
                                                          child.value,
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                  <label
                                                    className="text-gray-600 text-sm"
                                                    htmlFor={`filter-${section.id}-${optionIdx}-${childIdx}`}
                                                  >
                                                    {child.label}
                                                  </label>
                                                </div>
                                              ),
                                            )}
                                          </DisclosurePanel>
                                        </>
                                      )}
                                    </Disclosure>
                                  ) : (
                                    <div className="flex gap-3">
                                      <div className="flex h-5 shrink-0 items-center">
                                        <CheckboxInput
                                          checked={
                                            section.id === "categories"
                                              ? activeCategory === option.value
                                              : activeCollection ===
                                                option.value
                                          }
                                          disabled={isPending}
                                          id={`filter-${section.id}-${optionIdx}`}
                                          name={`${section.id}[]`}
                                          onChange={() =>
                                            handleFilterChange(
                                              section.id,
                                              option.value,
                                            )
                                          }
                                        />
                                      </div>
                                      <label
                                        className="text-gray-600 text-sm"
                                        htmlFor={`filter-${section.id}-${optionIdx}`}
                                      >
                                        {option.label}
                                      </label>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </DisclosurePanel>
                        </>
                      )}
                    </Disclosure>
                  ))}
                </form>
              </div>
            </div>
          </aside>

          <section
            aria-labelledby="product-heading"
            className="mt-6 flex-1 lg:mt-0"
          >
            <h2 className="sr-only" id="product-heading">
              Productos
            </h2>

            <div className="mb-8">
              <SearchSortBar
                initialQuery={searchQuery ?? ""}
                sortBy={sort}
                onOpenFilters={openMobileFilters}
              />
            </div>

            {children}
          </section>
        </div>
      </main>
    </div>
  );
};

export default StoreTemplate;
