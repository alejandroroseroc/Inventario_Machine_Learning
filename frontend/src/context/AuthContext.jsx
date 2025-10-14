import { createContext, useContext, useState } from "react";
const AuthCtx = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  const login = ({ access, user }) => {
    localStorage.setItem("token", access);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(access); setUser(user);
  };
  const logout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("user");
    setToken(null); setUser(null);
  };

  return <AuthCtx.Provider value={{ token, user, login, logout }}>
    {children}
  </AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
