"use client";

import { Popover, PopoverPanel, Transition } from "@headlessui/react";
import { ArrowRightMini, XMark } from "@medusajs/icons";
import type { HttpTypes } from "@medusajs/types";
import { clx, useToggleState } from "@medusajs/ui";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { Menu } from "lucide-react";
import { Fragment } from "react";

const SideMenuItems = {
  Home: "/",
  Productos: "/store",
  Cuenta: "/account",
  Carrito: "/cart",
};

const SideMenu = ({ regions }: { regions: HttpTypes.StoreRegion[] | null }) => {
  const toggleState = useToggleState();

  return (
    <div className="h-full">
      <div className="flex h-full items-center">
        <Popover className="flex h-full">
          {({ open, close }) => (
            <>
              <Popover.Button
                className="relative flex h-full items-center transition-all duration-200 ease-out hover:text-ui-fg-base focus:outline-none"
                data-testid="nav-menu-button"
              >
                <Menu />
              </Popover.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
                show={open}
              >
                <PopoverPanel className="absolute inset-x-0 z-30 m-2 flex h-[calc(100vh-1rem)] w-full flex-col pr-4 text-sm text-ui-fg-on-color backdrop-blur-2xl sm:w-1/3 sm:min-w-min sm:pr-0 2xl:w-1/4">
                  <div
                    className="194, 250, 0.5)] flex h-full flex-col justify-between rounded-rounded bg-[rgba(9, p-6"
                    data-testid="nav-menu-popup"
                  >
                    <div className="flex justify-end" id="xmark">
                      <button data-testid="close-menu-button" onClick={close}>
                        <XMark className="text-black" />
                      </button>
                    </div>
                    <ul className="flex flex-col items-start justify-start gap-6">
                      {Object.entries(SideMenuItems).map(([name, href]) => (
                        <li key={name}>
                          <LocalizedClientLink
                            className="text-3xl text-black leading-10 hover:text-ui-fg-disabled"
                            data-testid={`${name.toLowerCase()}-link`}
                            href={href}
                            onClick={close}
                          >
                            {name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col gap-y-6">
                      <div
                        className="flex justify-between"
                        onMouseEnter={toggleState.open}
                        onMouseLeave={toggleState.close}
                      >
                        {/* {regions && (
                          <CountrySelect
                            toggleState={toggleState}
                            regions={regions}
                          />
                        )} */}

                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            toggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
};

export default SideMenu;
