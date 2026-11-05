import { daysBetween, todayIso } from "./text";

/**
 * Učenje ponavljanja: iz datuma kupnje procjenjuje koliko često se artikl kupuje
 * (medijan zadnjih razmaka), a ručno zadani razmak vrijedi dok nema dovoljno podataka.
 */
export function estimateInterval(history: string[], manualDays?: number | null): number | null {
  const dates = [...new Set(history)].sort();
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const g = daysBetween(dates[i - 1], dates[i]);
    if (g >= 1) gaps.push(g);
  }
  const recent = gaps.slice(-6);
  if (recent.length >= 2) {
    const s = [...recent].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }
  if (manualDays && manualDays > 0) return manualDays;
  if (recent.length === 1) return recent[0];
  return null;
}

export type DueState = { interval: number | null; daysSince: number | null; daysLeft: number | null; due: boolean; soon: boolean };

export function dueState(history: string[], manualDays?: number | null, today = todayIso()): DueState {
  const interval = estimateInterval(history, manualDays);
  const last = [...history].sort().at(-1) ?? null;
  if (!last || !interval) return { interval, daysSince: last ? daysBetween(last, today) : null, daysLeft: null, due: false, soon: false };
  const daysSince = daysBetween(last, today);
  const daysLeft = interval - daysSince;
  return { interval, daysSince, daysLeft, due: daysLeft <= 0, soon: daysLeft > 0 && daysLeft <= Math.max(1, Math.round(interval * 0.2)) };
}

export function intervalLabel(days: number | null): string {
  if (!days) return "još uči";
  if (days === 1) return "svaki dan";
  if (days === 7) return "svaki tjedan";
  if (days % 7 === 0 && days <= 56) return `svakih ${days / 7} tjedna`;
  if (days >= 28 && days <= 32) return "svaki mjesec";
  return `svakih ${days} dana`;
}
