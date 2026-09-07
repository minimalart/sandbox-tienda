/**
 * Local `isEmpty`: the storefront's `./isEmpty` helper stayed behind because
 * it's consumed by many other host files. We only need the string branch here,
 * so we inline a minimal version instead of pulling the whole utility into the
 * shared package.
 */
const isEmpty = (input: unknown): boolean =>
  input === null ||
  input === undefined ||
  (typeof input === "string" && input.trim().length === 0);

type ConvertToLocaleParams = {
  amount: number;
  currency_code: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
};

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
  locale = "es-AR",
}: ConvertToLocaleParams) => {
  // Manejar casos donde amount es undefined o null
  if (amount === undefined || amount === null) {
    return "0";
  }

  if (!currency_code || isEmpty(currency_code)) {
    return amount.toString();
  }

  // Format with Intl but remove currency symbol and decimals
  return new Intl.NumberFormat(locale, {
    style: "decimal",
    currency: currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(amount);
};
