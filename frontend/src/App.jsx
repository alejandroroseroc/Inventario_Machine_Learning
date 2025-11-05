// src/App.jsx
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";

// Páginas
import LoginPage from "./features/auth/pages/login.jsx";
import RegisterPage from "./features/auth/pages/register.jsx";
import PanelPage from "./features/panel/pages/panel.jsx";
import ProductoDetailPage from "./features/productos/pages/ProductoDetailPage.jsx";
import ProductosPage from "./features/productos/pages/ProductosPage.jsx";

export default function App() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/login") || pathname.startsWith("/register");

  return (
    <>
      {/* La Navbar aparece en todo el sitio, excepto en login/register */}
      {!hideNav && <Navbar />}

      <Routes>
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
    </>
  );
}
