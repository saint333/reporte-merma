/** ExcelJS entrega las fechas como Date a medianoche UTC. */
export function fechaISO(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  return null;
}

/** Semana ISO 8601 (lunes = 1), equivalente a WEEKNUM(fecha; 21). */
export function semanaISO(fecha: string): number {
  const [anio = 0, mes = 0, dia = 0] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const inicioAnio = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - inicioAnio.getTime()) / 86_400_000 + 1) / 7);
}
