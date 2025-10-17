// src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import { AuthService } from "../features/auth/service";

const AuthCtx = createContext();

export function AuthProvider({ children }) {
  const initial = AuthService.session();
  const [token, setToken] = useState(initial.token);
  const [user,  setUser]  = useState(initial.user);

  async function login({ email, password }) {
    const s = await AuthService.login({ email, password });
    setToken(s.token); setUser(s.user);
  }
  function logout() { AuthService.logout(); setToken(null); setUser(null); }

  return (
    <AuthCtx.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => useContext(AuthCtx);
