import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import useToggleState from "@lib/hooks/use-toggle-state";
import { Button } from "@medusajs/ui";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";

type AccountInfoProps = {
  label: string;
  currentInfo: string | React.ReactNode;
  isSuccess?: boolean;
  isError?: boolean;
  errorMessage?: string;
  clearState: () => void;
  children?: React.ReactNode;
  "data-testid"?: string;
  isLoading?: boolean;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
};

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  errorMessage = "Ocurrió un error, por favor intentá nuevamente",
  children,
  "data-testid": dataTestid,
  isLoading: isLoadingProp,
  onSubmit,
}: AccountInfoProps) => {
  const { state, close, toggle } = useToggleState();

  const { pending } = useFormStatus();
  const isLoading = isLoadingProp ?? pending;

  const handleToggle = () => {
    clearState();
    setTimeout(() => toggle(), 100);
  };

  useEffect(() => {
    if (isSuccess) {
      close();
    }
  }, [isSuccess, close]);

  return (
    <>
      <div
        className="border-gray-200 border-t py-6 text-sm/6 sm:flex"
        data-testid={dataTestid}
      >
        <dt className="font-medium text-gray-900 sm:w-64 sm:flex-none sm:pr-6">
          {label}
        </dt>
        <dd className="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
          <div className="text-gray-900">
            {typeof currentInfo === "string" ? (
              <span data-testid="current-info">{currentInfo}</span>
            ) : (
              currentInfo
            )}
          </div>
          <button
            className="font-semibold text-[--primary-color] hover:text-[--primary-color-dark]"
            data-testid="edit-button"
            onClick={handleToggle}
            type="button"
          >
            Editar
          </button>
        </dd>
      </div>

      <Dialog className="relative z-[10000]" onClose={close} open={state}>
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />

        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative transform overflow-hidden rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in w-full max-w-none sm:my-8 sm:w-full sm:max-w-lg sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <div>
                <div className="mt-3 sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="mb-4 text-center font-semibold text-base text-gray-900"
                  >
                    Editar {label}
                  </DialogTitle>

                  {isSuccess && (
                    <div
                      className="mb-4 rounded-md bg-green-50 p-3"
                      data-testid="success-message"
                    >
                      <p className="text-green-800 text-sm">
                        {label} actualizado correctamente
                      </p>
                    </div>
                  )}
                  {isError && (
                    <div
                      className="mb-4 rounded-md bg-red-50 p-3"
                      data-testid="error-message"
                    >
                      <p className="text-red-800 text-sm">{errorMessage}</p>
                    </div>
                  )}

                  <form noValidate onSubmit={onSubmit} className="space-y-4">
                    {children}
                    
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <Button
                        className="inline-flex w-full justify-center rounded-md border-0 bg-[--primary-color] px-3 py-2 font-semibold text-sm text-white shadow-none hover:bg-[--primary-color-dark] focus-visible:outline-2 focus-visible:outline-[--primary-color] focus-visible:outline-offset-2 sm:col-start-2"
                        data-testid="save-button"
                        isLoading={isLoading}
                        type="submit"
                      >
                        Guardar cambios
                      </Button>
                      <button
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-gray-100 px-3 py-2 font-semibold text-gray-900 text-sm shadow-xs hover:bg-gray-200 sm:col-start-1 sm:mt-0"
                        onClick={close}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default AccountInfo;
