// src/features/auth/service.js
import { AuthRepository } from "./repository";

function saveSession({ token, refresh, user }) {
  localStorage.setItem("access", token);
  if (refresh) localStorage.setItem("refresh", refresh);
  // compat si otras partes leían "token"
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user || null));
}

function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function readSession() {
  try {
    return {
      token: localStorage.getItem("access") || localStorage.getItem("token") || null,
      refresh: localStorage.getItem("refresh") || null,
      user: JSON.parse(localStorage.getItem("user") || "null"),
    };
  } catch {
    return { token: null, refresh: null, user: null };
  }
}

export async function register({ email, password }) {
  return AuthRepository.registerUser({ email, password });
}

export async function login({ email, password }) {
  const session = await AuthRepository.loginUser({ email, password });
  saveSession(session);
  return session;
}

export const AuthService = {
  register,
  login,
  logout: clearSession,
  session: readSession,
};
