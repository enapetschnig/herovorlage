export type MoneyLocale = "de-DE" | "de-AT";
export type Currency = "EUR" | "CHF";

const moneyFormatter = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: number,
  opts: { currency?: Currency; locale?: MoneyLocale; decimals?: number } = {},
): string {
  const { currency = "EUR", locale = "de-AT", decimals = 2 } = opts;
  const key = `${locale}:${currency}:${decimals}`;
  let fmt = moneyFormatter.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    moneyFormatter.set(key, fmt);
  }
  return fmt.format(value);
}

export function parseMoneyInput(input: string): number | null {
  if (!input) return null;
  // Accept "1.234,56", "1234,56", "1234.56"
  const normalized = input
    .trim()
    .replace(/\s/g, "")
    .replace(/€|EUR|CHF/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // remove thousand dots
    .replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Calculate line total from qty * unit_price * (1 - discount) — returns net. */
export function lineNet(qty: number, unitPrice: number, discountPct = 0): number {
  return round2(qty * unitPrice * (1 - discountPct / 100));
}

export function applyVat(net: number, vatPct: number): { net: number; vat: number; gross: number } {
  const vat = round2(net * (vatPct / 100));
  return { net: round2(net), vat, gross: round2(net + vat) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
