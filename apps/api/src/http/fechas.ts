const formatoLima = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function isoLima(fecha: Date = new Date()): string {
  const partes = Object.fromEntries(
    formatoLima.formatToParts(fecha).map((parte) => [parte.type, parte.value]),
  );

  return (
    `${partes.year ?? ""}-${partes.month ?? ""}-${partes.day ?? ""}` +
    `T${partes.hour ?? ""}:${partes.minute ?? ""}:${partes.second ?? ""}-05:00`
  );
}

export function hoyLima(): string {
  return isoLima(new Date()).slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
