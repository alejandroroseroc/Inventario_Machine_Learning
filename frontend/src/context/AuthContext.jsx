import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(false);
  const [ready, setReady]   = useState(false);

  // Bootstrap: leer tokens al recargar
  useEffect(() => {
    const t = localStorage.getItem("access");
    setIsAuth(Boolean(t));
    setReady(true);
  }, []);

  function loginSuccess({ access, refresh }) {
    if (access)  localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
    setIsAuth(true);
  }

  async function login({ email, password }) {
    const data = await http.post("/auth/login", {
      auth: false,
      body: { email, password }
    });
    loginSuccess({ access: data?.access, refresh: data?.refresh });
    return data;
  }

  async function register({ email, password }) {
    const data = await http.post("/auth/register", {
      auth: false,
      body: { email, password }
    });
    // si tu backend ya devuelve tokens al registrar:
    if (data?.access) loginSuccess({ access: data.access, refresh: data.refresh });
    return data;
  }

  function logout() {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("token");
    } catch {}
    setIsAuth(false);
  }

  const value = useMemo(() => ({ isAuth, ready, login, register, loginSuccess, logout }), [isAuth, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
