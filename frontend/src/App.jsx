// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute.jsx";

// Páginas existentes en tu ZIP
import PanelPage from "./features/panel/pages/panel.jsx";
import ProductosPage from "./features/productos/pages/ProductosPage.jsx";
import LoginPage from "./features/auth/pages/login.jsx";
import RegisterPage from "./features/auth/pages/register.jsx";

// NUEVA página de detalle (puede ser el stub por ahora)
import ProductoDetailPage from "./features/productos/pages/ProductoDetailPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* Redirige / a /panel si ya hay sesión */}
      <Route path="/" element={<Navigate to="/panel" replace />} />

      {/* Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protegidas */}
      <Route
        path="/panel"
        element={
          <PrivateRoute>
            <PanelPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/productos"
        element={
          <PrivateRoute>
            <ProductosPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/productos/:id"
        element={
          <PrivateRoute>
            <ProductoDetailPage />
          </PrivateRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
    </Routes>
  );
}
