import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listLotesPorVencer } from "../features/lotes/repository";
import "./Navbar.css";

export default function Navbar() {
  const { isAuth, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    if (!isAuth) return;
    listLotesPorVencer({ dias: 60 })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHasAlerts(true);
        }
      })
      .catch(() => { });
  }, [isAuth]);

  if (!isAuth) return null;

  const active = (p) => (pathname.startsWith(p) ? "nav__link nav__link--active" : "nav__link");
  const onLogout = () => {
    try { logout(); }
    finally { nav("/login", { replace: true }); }
  };

  return (
    <header className="nav">
      <div className="nav__inner">
        <div className="nav__brand">Droguería Niza I</div>

        <nav className="nav__menu">
          <Link className={active("/panel")} to="/panel">Panel</Link>
          <Link className={active("/productos")} to="/productos">Inventario</Link>
          <Link className={active("/ventas")} to="/ventas">Ventas</Link>
          {/* Enlace a la vista de alertas/sugerencias con efecto glow si hay alertas */}
          <Link
            className={`${active("/alertas")} ${hasAlerts ? "nav__link--glow" : ""}`}
            to="/alertas/sugerencias"
          >
            Alertas
          </Link>
        </nav>

        <div className="nav__spacer" />
        <button className="nav__logout" onClick={onLogout}>cerrar sesión</button>
      </div>
    </header>
  );
}
