import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ShieldCheck, TriangleAlert } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { AlertsService } from "../api/alerts.service";
import { listLotesPorVencer } from "../features/lotes/repository";

import "./Navbar.css";

function daysLabel(days) {
  if (days == null) return "Sin fecha";
  if (days < 0) return "Caducado";
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence en 1 dia";
  return `Vence en ${days} dias`;
}

export default function Navbar() {
  const { isAuth, isAdmin, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiringItems, setExpiringItems] = useState([]);
  const [criticalItems, setCriticalItems] = useState([]);

  useEffect(() => {
    if (!isAuth || isAdmin) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAuth, isAdmin]);

  useEffect(() => {
    if (!isAuth || isAdmin) return;

    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      try {
        const [lotesRaw, alerts] = await Promise.all([
          listLotesPorVencer({ dias: 60, estado: "activa" }),
          AlertsService.list({ estado: "activa", page_size: 100 }),
        ]);

        if (cancelled) return;

        const lotes = Array.isArray(lotesRaw)
          ? lotesRaw
          : (Array.isArray(lotesRaw?.results) ? lotesRaw.results : []);

        const expiring = lotes
          .slice()
          .sort((a, b) => Number(a.days_left ?? 9999) - Number(b.days_left ?? 9999))
          .map((item) => ({
            id: `cad-${item.lote_id || item.id}`,
            tipo: "caducidad",
            titulo: item.producto_nombre || "Producto",
            detalle: item.numero_lote ? `Lote ${item.numero_lote}` : "Lote sin codigo",
            estado: daysLabel(item.days_left),
            prioridad: (item.days_left ?? 999) <= 30 ? "alta" : "media",
          }));

        const critical = (alerts || [])
          .filter((a) => a.tipo === "stock" && a.severidad !== "sugerencia")
          .map((item) => ({
            id: `stk-${item.id}`,
            tipo: "stock",
            titulo: item.productoNombre || "Producto",
            detalle: item.mensaje,
            estado: "Stock critico",
            prioridad: item.severidad === "critico" ? "alta" : "media",
          }));

        setExpiringItems(expiring);
        setCriticalItems(critical);
      } catch {
        if (!cancelled) {
          setExpiringItems([]);
          setCriticalItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [isAuth, isAdmin, pathname]);

  const allNotifications = useMemo(() => {
    return [...expiringItems, ...criticalItems]
      .sort((a, b) => {
        const pa = a.prioridad === "alta" ? 0 : 1;
        const pb = b.prioridad === "alta" ? 0 : 1;
        return pa - pb;
      })
      .slice(0, 6);
  }, [criticalItems, expiringItems]);

  const totalCount = expiringItems.length + criticalItems.length;
  const hasCritical = criticalItems.length > 0;

  // Ocultar navbar en rutas de auth o si no hay sesión
  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (!isAuth || isAuthPage) return null;

  const active = (p) => (pathname.startsWith(p) ? "nav__link nav__link--active" : "nav__link");
  const onLogout = () => {
    try {
      logout();
    } finally {
      nav("/login", { replace: true });
    }
  };

  return (
    <header className="nav">
      <div className="nav__inner">
        <div className="nav__brand">Drogueria Niza I</div>

        <nav className="nav__menu">
          {!isAdmin && (
            <>
              <Link className={active("/panel")} to="/panel">Panel</Link>
              <Link className={active("/productos")} to="/productos">Inventario</Link>
              <Link className={active("/ventas")} to="/ventas">Ventas</Link>
              <Link className={active("/alertas")} to="/alertas/sugerencias">Alertas</Link>
            </>
          )}
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

        <div className="nav__actions">
          {!isAdmin && (
            <div className="nav__notif" ref={panelRef}>
              <button
                type="button"
                className={`nav__notifBtn ${hasCritical ? "nav__notifBtn--critical" : ""}`}
                aria-label={totalCount > 0 ? `${totalCount} notificaciones` : "Sin notificaciones"}
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
              >
                <Bell size={20} strokeWidth={2.2} />
                {totalCount > 0 && <span className="nav__notifBadge">{totalCount}</span>}
              </button>

              {open && (
                <div className="nav__notifPanel" role="dialog" aria-label="Notificaciones">
                  <div className="nav__notifHead">
                    <strong>Notificaciones</strong>
                    <Link
                      to="/alertas/sugerencias"
                      className="nav__notifLink"
                      onClick={() => setOpen(false)}
                    >
                      Ver panel
                    </Link>
                  </div>

                  <div className="nav__notifBody">
                    {loading ? (
                      <div className="nav__notifEmpty">Cargando...</div>
                    ) : allNotifications.length === 0 ? (
                      <div className="nav__notifEmpty">Sin notificaciones</div>
                    ) : (
                      allNotifications.map((item) => (
                        <Link
                          key={item.id}
                          to="/alertas/sugerencias"
                          className="nav__notifItem"
                          onClick={() => setOpen(false)}
                        >
                          <span className={`nav__notifDot nav__notifDot--${item.prioridad}`}>
                            <TriangleAlert size={14} strokeWidth={2.2} />
                          </span>
                          <span className="nav__notifText">
                            <span className="nav__notifTitle">{item.titulo}</span>
                            <span className="nav__notifDetail">{item.detalle}</span>
                            <span className="nav__notifMeta">{item.estado}</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button className="nav__logout" onClick={onLogout}>cerrar sesion</button>
        </div>
      </div>
    </header>
  );
}
