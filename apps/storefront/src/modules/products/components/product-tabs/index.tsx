"use client";

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import {
  ChevronDownIcon,
  TruckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { HttpTypes } from "@medusajs/types";
import type React from "react";

type ProductTabsProps = {
  product: HttpTypes.StoreProduct;
};

const ProductTabs = ({ product }: ProductTabsProps) => {
  const details: { name: string; icon: React.ElementType; items: string[] }[] =
    [
      {
        name: "Envío",
        icon: TruckIcon,
        items: [
          "Envío gratis en pedidos mayores a $300",
          "Envío gratis en pedidos mayores a $300",
          "Envío gratis en pedidos mayores a $300",
          "Envío gratis en pedidos mayores a $300",
        ],
      },
      {
        name: "Devoluciones",
        icon: ArrowPathIcon,
        items: [
          "Solicitudes de devolución fáciles",
          "Etiqueta de envío prepagada incluida",
          "Tarifa de reposición del 10% para devoluciones",
          "Ventana de devolución de 60 días",
        ],
      },
    ];

  return (
    <div className="flex flex-col gap-3">
      {details.map((detail) => (
        <Disclosure
          as="div"
          key={detail.name}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <h3>
            <DisclosureButton className="group flex w-full items-center justify-between px-4 py-3.5 text-left">
              <span className="flex items-center gap-2.5 font-medium text-gray-800 text-sm">
                <detail.icon
                  className="h-5 w-5 text-gray-600"
                  aria-hidden="true"
                />
                {detail.name}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-open:rotate-180"
              />
            </DisclosureButton>
          </h3>
          <DisclosurePanel className="border-gray-100 border-t px-4 pb-4 pt-3 bg-grey-5">
            <ul
              className="list-disc space-y-1 pl-5 text-gray-600 text-sm/6 marker:text-gray-800"
              role="list"
            >
              {detail.items.map((item, idx) => (
                <li
                  className={`pl-1 ${
                    detail.name === "Envío"
                      ? "marker:text-[--primary-color]"
                      : ""
                  }`}
                  key={idx}
                >
                  {item}
                </li>
              ))}
            </ul>
          </DisclosurePanel>
        </Disclosure>
      ))}
    </div>
  );
};

export default ProductTabs;
