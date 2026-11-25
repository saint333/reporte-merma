type Columna = {
  clave: string;
  etiqueta: string;
  formato?: (valor: unknown) => string;
};

export function ChartTable({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
}) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <thead>
        <tr>
          {columnas.map((columna) => (
            <th key={columna.clave} scope="col">
              {columna.etiqueta}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, indice) => (
          <tr key={indice}>
            {columnas.map((columna) => {
              const valor = fila[columna.clave];
              return (
                <td key={columna.clave}>
                  {columna.formato
                    ? columna.formato(valor)
                    : valor === null || valor === undefined
                      ? ""
                      : String(valor)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
