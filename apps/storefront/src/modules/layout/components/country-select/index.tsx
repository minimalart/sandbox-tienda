"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { updateRegion } from "@lib/data/cart";
import type { StateType } from "@lib/hooks/use-toggle-state";
import type { HttpTypes } from "@medusajs/types";
import { useParams, usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import ReactCountryFlag from "react-country-flag";

type CountryOption = {
  country: string | undefined;
  region: string;
  label: string | undefined;
};

type CountrySelectProps = {
  toggleState: StateType;
  regions: HttpTypes.StoreRegion[];
};

const CountrySelect = ({ toggleState, regions }: CountrySelectProps) => {
  const [current, setCurrent] = useState<
    | { country: string | undefined; region: string; label: string | undefined }
    | undefined
  >(undefined);

  const { countryCode } = useParams();
  const currentPath = usePathname();

  const { state, close } = toggleState;

  const options = useMemo(
    () =>
      regions
        ?.flatMap((r) =>
          r.countries?.map((c) => ({
            country: c.iso_2,
            region: r.id,
            label: c.display_name,
          }))
        )
        .sort((a, b) => (a?.label ?? "").localeCompare(b?.label ?? "")),
    [regions]
  );

  useEffect(() => {
    if (countryCode) {
      const option = options?.find((o) => o?.country === countryCode);
      setCurrent(option);
    }
  }, [options, countryCode]);

  const handleChange = (option: CountryOption) => {
    if (option.country) {
      updateRegion(option.country, currentPath);
    }
    close();
  };

  return (
    <div>
      <Listbox
        as="span"
        defaultValue={
          countryCode
            ? options?.find((o) => o?.country === countryCode)
            : undefined
        }
        onChange={handleChange}
      >
        <ListboxButton className="w-full py-1">
          <div className="txt-compact-small flex items-start gap-x-2 text-black">
            <span>Enviado a:</span>
            {current && (
              <span className="txt-compact-small flex items-center gap-x-2 text-black">
                {/* @ts-ignore */}
                <ReactCountryFlag
                  countryCode={current.country ?? ""}
                  style={{
                    width: "16px",
                    height: "16px",
                  }}
                  svg
                />
                {current.label}
              </span>
            )}
          </div>
        </ListboxButton>
        <div className="relative flex w-full min-w-[320px]">
          <Transition
            as={Fragment}
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            show={state}
          >
            <ListboxOptions
              className="-bottom-[calc(100%-36px)] no-scrollbar absolute xsmall:right-0 left-0 xsmall:left-auto z-[900] max-h-[442px] w-full overflow-y-scroll rounded-rounded bg-white text-black text-small-regular uppercase drop-shadow-md"
              static
            >
              {options?.map((o, index) => {
                return (
                  <ListboxOption
                    className="flex cursor-pointer items-center gap-x-2 px-3 py-2 hover:bg-gray-200"
                    key={index}
                    value={o}
                  >
                    {/* @ts-ignore */}
                    <ReactCountryFlag
                      countryCode={o?.country ?? ""}
                      style={{
                        width: "16px",
                        height: "16px",
                      }}
                      svg
                    />{" "}
                    {o?.label}
                  </ListboxOption>
                );
              })}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

export default CountrySelect;
