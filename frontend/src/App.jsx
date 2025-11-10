import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";

import Login from "./features/auth/pages/login";
import Register from "./features/auth/pages/register";
import Panel from "./features/panel/pages/panel";
import ProductoDetailPage from "./features/productos/pages/ProductoDetailPage.jsx";
import ProductosPage from "./features/productos/pages/ProductosPage";
import RegistrarVentaPage from "./features/ventas/pages/RegistrarVentaPage.jsx";

import ErrorBoundary from "./components/ErrorBoundary";

const AlertsPage = lazy(() => import("./features/alerts/AlertsPage.jsx"));

import "./styles/panel.css";

export default function App() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
        <Routes>
          {/* públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* privadas */}
          <Route path="/" element={<PrivateRoute><Panel /></PrivateRoute>} />
          <Route path="/panel" element={<PrivateRoute><Panel /></PrivateRoute>} />
          <Route path="/productos" element={<PrivateRoute><ProductosPage /></PrivateRoute>} />
          <Route path="/productos/:id" element={<PrivateRoute><ProductoDetailPage /></PrivateRoute>} />
          <Route path="/ventas" element={<PrivateRoute><RegistrarVentaPage /></PrivateRoute>} />

          {/* 🔧 Ruta de alertas: usa tu AlertsPage.jsx */}
          <Route
            path="/alertas/sugerencias"
            element={
              <PrivateRoute>
                <ErrorBoundary>
                  <AlertsPage />
                </ErrorBoundary>
              </PrivateRoute>
            }
          />

          {/* fallback */}
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    </>
  );
}
