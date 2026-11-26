export const CAMPANA_DESDE = "2026-01-01";

export function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());
}
