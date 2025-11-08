import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";

import Register from "./features/auth/pages/register";
import Login from "./features/auth/pages/login";
import Panel from "./features/panel/pages/panel";
import ProductosPage from "./features/productos/pages/ProductosPage";
import ProductoDetailPage from "./features/productos/pages/ProductoDetailPage.jsx";
import RegistrarVentaPage from "./features/ventas/pages/RegistrarVentaPage.jsx";

import "./styles/panel.css";

export default function App() {
  return (
    <>
      <Navbar />
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

        {/* fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </>
  );
}
