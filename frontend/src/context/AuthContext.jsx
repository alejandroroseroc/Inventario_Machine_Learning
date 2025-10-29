import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthService } from "../features/auth/service";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return localStorage.getItem("access") || localStorage.getItem("token") || null;
  });
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  });

  // Mantengo sincronía si otro tab cierra sesión
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "access" || e.key === "token" || e.key === "user") {
        setToken(localStorage.getItem("access") || localStorage.getItem("token") || null);
        try { setUser(JSON.parse(localStorage.getItem("user") || "null")); }
        catch { setUser(null); }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function register({ email, password }) {
    return AuthService.register({ email, password });
  }

  async function login({ email, password }) {
    const s = await AuthService.login({ email, password });
    setToken(s.token || s.access || localStorage.getItem("access"));
    setUser(s.user || JSON.parse(localStorage.getItem("user") || "null"));
    return s;
  }

  function logout() {
    AuthService.logout();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    token, user, isAuth: !!token,
    register, login, logout
  }), [token, user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
