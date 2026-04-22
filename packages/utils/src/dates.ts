import { format, formatDistance, formatRelative } from "date-fns";
import { de, deAT } from "date-fns/locale";

export type DateLocale = "de-DE" | "de-AT";

const localeMap = { "de-DE": de, "de-AT": deAT } as const;

export function formatDate(
  date: Date | string | number,
  pattern = "dd.MM.yyyy",
  locale: DateLocale = "de-AT",
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return format(d, pattern, { locale: localeMap[locale] });
}

export function formatDateTime(date: Date | string | number, locale: DateLocale = "de-AT"): string {
  return formatDate(date, "dd.MM.yyyy HH:mm", locale);
}

export function formatRelativeDate(date: Date | string | number, base: Date = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatRelative(d, base, { locale: deAT });
}

export function formatAgo(date: Date | string | number, base: Date = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatDistance(d, base, { addSuffix: true, locale: deAT });
}
