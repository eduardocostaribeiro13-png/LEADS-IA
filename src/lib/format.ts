export const NOT_AVAILABLE = "Dado não disponível";

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return NOT_AVAILABLE;
  if (min == null) return formatBRL(max);
  if (max == null) return formatBRL(min);
  return `${formatBRL(min)} – ${formatBRL(max)}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export function orNotAvailable(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : NOT_AVAILABLE;
}
