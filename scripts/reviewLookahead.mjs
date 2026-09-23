/**
 * Private review-window planner. One America/New_York day per window.
 * Append only. New imports sit behind the existing cohort.
 */

const NY = 'America/New_York';

export function nyDateKey(instant) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NY,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function planLookahead(input) {
  const existing = input.existingDays ?? [];
  const horizon = input.horizonDays ?? 28;
  const minEnable = input.minEnableDays ?? 14;
  const perDay = input.perDay ?? 10;
  const cohort = [...(input.cohort ?? [])];
  const plannedIds = new Set(existing.flatMap((day) => day.itemIds ?? []));
  const available = cohort.filter((item) => !plannedIds.has(item.id));
  const days = existing.map((day) => ({
    date: day.date,
    itemIds: [...(day.itemIds ?? [])],
  }));
  const used = new Set(days.map((day) => day.date));
  const start = input.startDate ?? nyDateKey(input.now ?? new Date());
  let cursor = nextDate(start);
  while (days.length < horizon && available.length > 0) {
    while (used.has(cursor)) cursor = nextDate(cursor);
    const take = available.splice(0, Math.min(perDay, available.length));
    days.push({ date: cursor, itemIds: take.map((item) => item.id) });
    used.add(cursor);
    cursor = nextDate(cursor);
  }
  return {
    days,
    enabled: days.length >= minEnable,
    horizon: days.length,
  };
}

function nextDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc.toISOString().slice(0, 10);
}
