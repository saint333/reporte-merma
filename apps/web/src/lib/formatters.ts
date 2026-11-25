const MONEDA = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONEDA_COMPACTA = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const ENTERO = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "set",
  "oct",
  "nov",
  "dic",
];

function numero(valor: string | number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function money(valor: string | number): string {
  return MONEDA.format(numero(valor));
}

export function money4(valor: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(numero(valor));
}

export function compactMoney(valor: string | number): string {
  return MONEDA_COMPACTA.format(numero(valor)).replace(".0K", "K");
}

export function integer(valor: string | number): string {
  return ENTERO.format(numero(valor));
}

export function decimal(valor: string | number, digitos = 2): string {
  if (digitos === 2) return DECIMAL.format(numero(valor));

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  }).format(numero(valor));
}

export function percent(valor: number, digitos = 1): string {
  return `${(numero(valor) * 100).toFixed(digitos)}%`;
}

export function percentFromString(
  valor: string | number,
  digitos = 2,
): string {
  return percent(numero(valor), digitos);
}

export function monthLabel(mes: string): string {
  const [anio, numeroMes] = mes.split("-");
  const indice = Number(numeroMes) - 1;
  if (!anio || indice < 0 || indice > 11) return mes;
  return `${MESES[indice]}-${anio.slice(2)}`;
}

export function weekLabel(semana: number): string {
  return `S${semana}`;
}

export function dateLabel(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

export function dateTimeLabel(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(fecha);
}

export function dateShortLabel(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
  }).format(fecha);
}

export function plural(
  cantidad: number,
  singular: string,
  pluralForma: string,
): string {
  return `${integer(cantidad)} ${cantidad === 1 ? singular : pluralForma}`;
}
