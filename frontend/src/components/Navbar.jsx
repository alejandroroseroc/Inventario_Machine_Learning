import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listLotesPorVencer } from "../features/lotes/repository";
import { ShieldCheck } from "lucide-react";
import "./Navbar.css";

export default function Navbar() {
  const { isAuth, isAdmin, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    if (!isAuth) return;
    listLotesPorVencer({ dias: 60 })
      .then((data) => {
        const items = Array.isArray(data) ? data : (data?.results || []);
        if (items.length > 0) {
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
          {!isAdmin && (
            <>
              <Link className={active("/panel")} to="/panel">Panel</Link>
              <Link className={active("/productos")} to="/productos">Inventario</Link>
              <Link className={active("/ventas")} to="/ventas">Ventas</Link>
              <Link
                className={`${active("/alertas")} ${hasAlerts ? "nav__link--glow" : ""}`}
                to="/alertas/sugerencias"
              >
                Alertas
              </Link>
            </>
          )}
          {/* Solo visible para administradores */}
          {isAdmin && (
            <Link
              className={active("/admin")}
              to="/admin"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <ShieldCheck size={18} strokeWidth={2.5} />
              Admin
            </Link>
          )}
        </nav>

        <div className="nav__spacer" />
        <button className="nav__logout" onClick={onLogout}>cerrar sesión</button>
      </div>
    </header>
  );
}
