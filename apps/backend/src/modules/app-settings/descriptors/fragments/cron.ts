/** Numeric five-field cron in UTC. Mirrored in the host descriptor for validation. */
export function parseCron(expression: string): Set<number>[] {
  const fields = expression.trim().split(/\s+/);
  const bounds: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  if (fields.length !== 5) throw new Error('Expected five cron fields');
  return fields.map((field, index) => {
    const [min, max] = bounds[index]!;
    const values = new Set<number>();
    for (const part of field.split(',')) {
      if (!/^(?:\*|\d+(?:-\d+)?)(?:\/\d+)?$/.test(part)) throw new Error('Invalid cron field');
      const [range = '', stride] = part.split('/');
      const step = stride === undefined ? 1 : Number(stride);
      const [start, end] =
        range === '*'
          ? [min, max]
          : range.includes('-')
            ? (range.split('-').map(Number) as [number, number])
            : [Number(range), stride ? max : Number(range)];
      if (step < 1 || step > max - min + 1 || start < min || end > max || start > end)
        throw new Error('Cron value out of range');
      for (let value = start; value <= end; value += step)
        values.add(index === 4 && value === 7 ? 0 : value);
    }
    return values;
  });
}

export function cronMatches(expression: string, now: Date): boolean {
  const [minute, hour, day, month, weekday] = parseCron(expression) as [
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
  ];
  const fields = expression.trim().split(/\s+/);
  const dom = day.has(now.getUTCDate());
  const dow = weekday.has(now.getUTCDay());
  const dayMatches =
    fields[2]!.startsWith('*') || fields[4]!.startsWith('*') ? dom && dow : dom || dow;
  return (
    minute.has(now.getUTCMinutes()) &&
    hour.has(now.getUTCHours()) &&
    month.has(now.getUTCMonth() + 1) &&
    dayMatches
  );
}
