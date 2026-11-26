import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrimeReact, { addLocale, locale } from "primereact/api";
import { RouterProvider } from "react-router-dom";

import "primereact/resources/themes/lara-dark-teal/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./styles.css";

import { habilitarRippleRaton } from "./lib/ripple";
import { router } from "./router";

PrimeReact.ripple = true;
habilitarRippleRaton();

addLocale("es", {
  firstDayOfWeek: 1,
  dayNames: [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ],
  dayNamesShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  dayNamesMin: ["D", "L", "M", "X", "J", "V", "S"],
  monthNames: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  monthNamesShort: [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ],
  today: "Hoy",
  clear: "Limpiar",
  weekHeader: "Sem",
  dateFormat: "dd/mm/yy",
  emptyMessage: "Sin resultados",
  emptyFilterMessage: "Sin coincidencias",
  aria: {
    trueLabel: "Verdadero",
    falseLabel: "Falso",
    nullLabel: "No seleccionado",
    pageLabel: "Página {page}",
    firstPageLabel: "Primera página",
    lastPageLabel: "Última página",
    nextPageLabel: "Página siguiente",
    previousPageLabel: "Página anterior",
    selectLabel: "Seleccionar",
    unselectLabel: "Deseleccionar",
    expandLabel: "Expandir",
    collapseLabel: "Contraer",
  },
});

locale("es");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const raiz = document.getElementById("root");

if (!raiz) {
  throw new Error("No se encontró el elemento #root");
}

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
