import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady]   = useState(false);

  // Bootstrap: leer tokens al recargar
  useEffect(() => {
    const t = localStorage.getItem("access");
    const adminFlag = localStorage.getItem("is_admin") === "true";
    setIsAuth(Boolean(t));
    setIsAdmin(adminFlag);
    setReady(true);
  }, []);

  function loginSuccess({ access, refresh, is_admin }) {
    if (access)  localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
    localStorage.setItem("is_admin", is_admin ? "true" : "false");
    setIsAuth(true);
    setIsAdmin(Boolean(is_admin));
  }

  async function login({ email, password }) {
    const data = await http.post("/auth/login", {
      auth: false,
      body: { email, password }
    });
    loginSuccess({
      access: data?.access,
      refresh: data?.refresh,
      is_admin: data?.user?.is_admin,
    });
    return data;
  }

  async function register({ email, password }) {
    const data = await http.post("/auth/register", {
      auth: false,
      body: { email, password }
    });
    // si tu backend ya devuelve tokens al registrar:
    if (data?.access) loginSuccess({ access: data.access, refresh: data.refresh, is_admin: false });
    return data;
  }

  function logout() {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("token");
      localStorage.removeItem("is_admin");
    } catch {}
    setIsAuth(false);
    setIsAdmin(false);
  }

  const value = useMemo(
    () => ({ isAuth, isAdmin, ready, login, register, loginSuccess, logout }),
    [isAuth, isAdmin, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
