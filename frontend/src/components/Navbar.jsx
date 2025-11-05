import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css"; // <-- estilos locales de la barra

export default function Navbar() {
  const { isAuth, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  // Si no hay sesión, no muestres la barra
  if (!isAuth) return null;

  // Marca activo por prefijo de ruta
  const active = (p) =>
    pathname.startsWith(p) ? "nav__link nav__link--active" : "nav__link";

  function onLogout() {
    try { logout(); } finally { nav("/login", { replace: true }); }
  }

  return (
    <header className="nav">
      <div className="nav__inner">
        <div className="nav__brand">Droguería Niza I</div>

        <nav className="nav__menu">
          <Link className={active("/panel")} to="/panel">Panel</Link>
          <Link className={active("/productos")} to="/productos">Inventario</Link>
        </nav>

        <div className="nav__spacer" />

        <button className="nav__logout" onClick={onLogout}>
          cerrar sesión
        </button>
      </div>
    </header>
  );
}
