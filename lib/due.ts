// Logique de « dû » des posts mensuels (specs/06). Fonctions pures,
// fuseau America/Toronto — tout instant retourné est un Date UTC exact.

const TZ = "America/Toronto";

export interface TorontoParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function torontoParts(date: Date): TorontoParts {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * Instant UTC correspondant à une heure murale de Toronto.
 * Approche itérative : on part de l'heure comme si elle était UTC puis on
 * corrige avec l'écart observé (gère EST/EDT sans dépendance).
 */
export function torontoInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  let ts = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i++) {
    const seen = torontoParts(new Date(ts));
    const diff =
      Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) -
      Date.UTC(year, month - 1, day, hour, minute);
    if (diff === 0) break;
    ts -= diff;
  }
  return new Date(ts);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Bornes UTC du mois courant de Toronto : [début du mois, début du suivant). */
export function torontoMonthRange(now: Date): { start: Date; end: Date } {
  const { year, month } = torontoParts(now);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: torontoInstant(year, month, 1),
    end: torontoInstant(nextYear, nextMonth, 1),
  };
}

export interface DueInput {
  postsPerMonth: number;
  publishedThisMonth: number;
  scheduledThisMonth: number;
}

/** restants = max(0, cadence − publiés − planifiés) (specs/06). */
export function remainingPosts(input: DueInput): number {
  return Math.max(
    0,
    input.postsPerMonth -
      input.publishedThisMonth -
      input.scheduledThisMonth,
  );
}

/** Passé le 20 du mois (Toronto) avec des posts restants → « en retard ». */
export function isLate(now: Date, remaining: number): boolean {
  return remaining > 0 && torontoParts(now).day > 20;
}

/** Jour de semaine du calendrier (0 = dimanche), indépendant du fuseau. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Suggère `count` dates de publication : réparties uniformément sur ce qui
 * reste du mois, jours de semaine, 10 h 00 heure de Toronto (specs/06).
 */
export function suggestPostDates(now: Date, count: number): Date[] {
  if (count <= 0) return [];

  const { year, month, day } = torontoParts(now);
  const lastDay = daysInMonth(year, month);
  // Marge de 2 jours pour laisser le temps de réviser.
  const windowStart = Math.min(day + 2, lastDay);
  const span = lastDay - windowStart;

  const days: number[] = [];
  for (let i = 0; i < count; i++) {
    let candidate = Math.round(windowStart + (span * (i + 1)) / (count + 1));

    // Week-end → lundi suivant (ou vendredi si on déborde du mois).
    const weekday = weekdayOf(year, month, candidate);
    if (weekday === 6) candidate += 2;
    else if (weekday === 0) candidate += 1;
    if (candidate > lastDay) {
      candidate = lastDay;
      const w = weekdayOf(year, month, candidate);
      if (w === 6) candidate -= 1;
      else if (w === 0) candidate -= 2;
    }

    // Jamais deux posts le même jour : pousser au jour ouvrable suivant.
    while (days.includes(candidate) && candidate < lastDay) {
      candidate += 1;
      const w = weekdayOf(year, month, candidate);
      if (w === 6) candidate += 2;
      else if (w === 0) candidate += 1;
    }
    if (candidate > lastDay || days.includes(candidate)) continue;

    days.push(candidate);
  }

  return days.map((d) => torontoInstant(year, month, d, 10, 0));
}
