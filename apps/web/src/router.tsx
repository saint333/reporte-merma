import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

import { Shell } from "./components/layout/Shell";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const RegistrosPage = lazy(() => import("./pages/RegistrosPage"));
const AnalisisPage = lazy(() => import("./pages/AnalisisPage"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "registros", element: <RegistrosPage /> },
      { path: "analisis", element: <AnalisisPage /> },
      {
        path: "*",
        element: (
          <div className="py-16 text-center">
            <p className="text-ink text-sm font-semibold">Pantalla no encontrada</p>
            <a
              href="/"
              className="text-cyan mt-2 inline-block text-xs underline underline-offset-4"
            >
              Volver al dashboard
            </a>
          </div>
        ),
      },
    ],
  },
]);
