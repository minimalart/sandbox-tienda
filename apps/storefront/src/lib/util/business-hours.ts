const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

const DAY_ORDER = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const DAY_ABBR: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

export interface TimeSlot {
  open: string;
  close: string;
}

export interface DaySchedule {
  slots: TimeSlot[];
  closed: boolean;
  is24Hours: boolean;
}

export type BusinessHours = Record<string, DaySchedule>;

export interface OpenState {
  isOpenNow: boolean;
  nextOpenInfo?: string;
}

function normalizeDayKey(day: string): string {
  return day
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function parseHHMMToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getNowInTimeZoneParts(tz: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = Number.parseInt(
    parts.find((p) => p.type === "hour")?.value || "0",
    10,
  );
  const minute = Number.parseInt(
    parts.find((p) => p.type === "minute")?.value || "0",
    10,
  );
  return {
    weekday: normalizeDayKey(weekday),
    currentMinutes: hour * 60 + minute,
    now,
  };
}

function findNextOpenSlot(
  schedule: BusinessHours,
  currentDay: string,
  currentMinutes: number,
): { day: string; time: string } | null {
  const currentIndex = DAY_ORDER.indexOf(
    currentDay as (typeof DAY_ORDER)[number],
  );
  if (currentIndex === -1) return null;

  for (let i = 0; i < 7; i++) {
    const dayIndex = (currentIndex + i) % 7;
    const dayKey = DAY_ORDER[dayIndex];
    const daySchedule = schedule[dayKey];

    if (
      !daySchedule ||
      daySchedule.closed ||
      !daySchedule.slots ||
      daySchedule.slots.length === 0
    ) {
      continue;
    }

    if (daySchedule.is24Hours) {
      return {
        day: i === 0 ? "hoy" : i === 1 ? "mañana" : dayKey,
        time: "00:00",
      };
    }

    for (const slot of daySchedule.slots) {
      const openMin = parseHHMMToMinutes(slot.open);
      if (i === 0 && openMin <= currentMinutes) continue;
      const dayLabel = i === 0 ? "hoy" : i === 1 ? "mañana" : dayKey;
      return { day: dayLabel, time: slot.open };
    }
  }

  return null;
}

export function computeOpenState(
  businessHours: unknown,
  timezone: string = DEFAULT_TIMEZONE,
): OpenState {
  if (!businessHours || typeof businessHours !== "object") {
    return { isOpenNow: false };
  }

  const schedule = businessHours as BusinessHours;
  const { weekday, currentMinutes } = getNowInTimeZoneParts(timezone);
  const todaySchedule = schedule[weekday];

  if (!todaySchedule) {
    return { isOpenNow: false };
  }

  if (todaySchedule.is24Hours) {
    return { isOpenNow: true, nextOpenInfo: "Abierto 24 hs" };
  }

  if (
    todaySchedule.closed ||
    !todaySchedule.slots ||
    todaySchedule.slots.length === 0
  ) {
    const nextOpen = findNextOpenSlot(schedule, weekday, currentMinutes);
    return {
      isOpenNow: false,
      nextOpenInfo: nextOpen
        ? `Abre ${nextOpen.day} a las ${nextOpen.time}`
        : undefined,
    };
  }

  for (const slot of todaySchedule.slots) {
    const openMin = parseHHMMToMinutes(slot.open);
    const closeMin = parseHHMMToMinutes(slot.close);

    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      return {
        isOpenNow: true,
        nextOpenInfo: `Cierra a las ${slot.close}`,
      };
    }
  }

  const nextOpen = findNextOpenSlot(schedule, weekday, currentMinutes);
  return {
    isOpenNow: false,
    nextOpenInfo: nextOpen
      ? `Abre ${nextOpen.day} a las ${nextOpen.time}`
      : undefined,
  };
}

export function computeBusinessHoursSummary(
  businessHours: unknown,
): string | undefined {
  if (!businessHours || typeof businessHours !== "object") return undefined;

  const schedule = businessHours as BusinessHours;

  type HourGroup = { days: string[]; label: string };
  const groups: HourGroup[] = [];

  for (const day of DAY_ORDER) {
    const ds = schedule[day];
    let label = "Cerrado";

    if (ds && !ds.closed) {
      if (ds.is24Hours) {
        label = "24 hs";
      } else if (ds.slots && ds.slots.length > 0) {
        label = ds.slots.map((s) => `${s.open} a ${s.close}`).join(", ");
      }
    }

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], label });
    }
  }

  const parts = groups
    .filter((g) => g.label !== "Cerrado")
    .map((g) => {
      const first = DAY_ABBR[g.days[0]] || g.days[0];
      const lastDay =
        DAY_ABBR[g.days[g.days.length - 1]] || g.days[g.days.length - 1];
      const range = g.days.length === 1 ? first : `${first} a ${lastDay}`;
      return `${range}: ${g.label} hs`;
    });

  return parts.length > 0 ? parts.join(" | ") : undefined;
}
