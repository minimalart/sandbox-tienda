const TIME_ZONE = "America/Argentina/Buenos_Aires";

export const formatDateAR = (
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string | null => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("es-AR", {
    timeZone: TIME_ZONE,
    ...options,
  });
};

export const formatDateTimeAR = (
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string | null => {
  if (!date) return null;
  return new Date(date).toLocaleString("es-AR", {
    timeZone: TIME_ZONE,
    ...options,
  });
};
