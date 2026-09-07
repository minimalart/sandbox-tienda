import type { BusinessHours, BusinessHoursEntry } from '@lib/data/store-locations';

const DAY_ORDER = [
	'lunes',
	'martes',
	'miercoles',
	'jueves',
	'viernes',
	'sabado',
	'domingo',
] as const;

const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = {
	lunes: 'Lun',
	martes: 'Mar',
	miercoles: 'Mié',
	jueves: 'Jue',
	viernes: 'Vie',
	sabado: 'Sáb',
	domingo: 'Dom',
};

const formatEntry = (entry: BusinessHoursEntry | undefined): string | null => {
	if (!entry || entry.closed) {
		return null;
	}
	if (entry.is24Hours) {
		return '24 hs';
	}
	const slots = (entry.slots ?? [])
		.filter((slot) => slot.open && slot.close)
		.map((slot) => `${slot.open}–${slot.close}`);
	return slots.length > 0 ? slots.join(' y ') : null;
};

const formatGroupLabel = (days: string[]): string => {
	if (days.length === 1) {
		return days[0];
	}
	if (days.length === 2) {
		return `${days[0]} y ${days[1]}`;
	}
	return `${days[0]} a ${days[days.length - 1]}`;
};

/**
 * Builds a readable summary of the business hours, grouping consecutive days
 * with the same schedule. E.g.: ["Lun a Vie 09:00–18:00", "Sáb 09:00–13:00"].
 * Closed days are omitted. Returns [] when there is nothing to show.
 */
export const summarizeBusinessHours = (hours: BusinessHours | null | undefined): string[] => {
	if (!hours) {
		return [];
	}

	const groups: { schedule: string; days: string[] }[] = [];

	for (const day of DAY_ORDER) {
		const schedule = formatEntry(hours[day]);
		if (!schedule) {
			// Closed day: break the current group so ranges stay consecutive.
			groups.push({ schedule: '', days: [] });
			continue;
		}
		const last = groups[groups.length - 1];
		if (last && last.schedule === schedule) {
			last.days.push(DAY_LABEL[day]);
		} else {
			groups.push({ schedule, days: [DAY_LABEL[day]] });
		}
	}

	return groups
		.filter((group) => group.schedule && group.days.length > 0)
		.map((group) => `${formatGroupLabel(group.days)} ${group.schedule}`);
};
