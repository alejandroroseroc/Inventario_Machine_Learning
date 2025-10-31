import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuth, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  if (!isAuth) return null;

  const active = (p) => (pathname.startsWith(p) ? "nav__link nav__link--active" : "nav__link");

  function onLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <header className="nav">
      <div className="nav__brand">Droguería Niza I</div>
      <nav className="nav__menu">
        <Link className={active("/panel")} to="/panel">Panel</Link>
        <Link className={active("/productos")} to="/productos">Inventario</Link>
      </nav>
      <button className="nav__logout" onClick={onLogout}>Cerrar sesión</button>
    </header>
  );
}
