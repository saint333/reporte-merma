import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

import { Shell } from "./components/layout/Shell";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const RegistrosPage = lazy(() => import("./pages/RegistrosPage"));
const NuevoRegistroPage = lazy(() => import("./pages/NuevoRegistroPage"));
const EditarRegistroPage = lazy(() => import("./pages/EditarRegistroPage"));
const HistorialProductoPage = lazy(() => import("./pages/HistorialProductoPage"));
const AnalisisPage = lazy(() => import("./pages/AnalisisPage"));
const CargasPage = lazy(() => import("./pages/CargasPage"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "registros", element: <RegistrosPage /> },
      { path: "registros/nuevo", element: <NuevoRegistroPage /> },
      { path: "registros/:id/editar", element: <EditarRegistroPage /> },
      { path: "productos/:codigo", element: <HistorialProductoPage /> },
      { path: "analisis", element: <AnalisisPage /> },
      { path: "cargas", element: <CargasPage /> },
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
