// src/features/auth/service.js
import { AuthRepository } from "./repository";
import { http } from "../../api/http.js";

export async function register({ email, password }) {
  return http.post("/auth/register", { body: { email, password } });
}

export async function login({ email, password }) {
  return http.post("/auth/login", { body: { email, password } });
}

function saveSession({ token, user }) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function readSession() {
  try {
    return {
      token: localStorage.getItem("token"),
      user: JSON.parse(localStorage.getItem("user") || "null"),
    };
  } catch { return { token:null, user:null }; }
}

export const AuthService = {
  async register({ email, password }) {
    return AuthRepository.registerUser({ email, password });
  },
  async login({ email, password }) {
    const session = await AuthRepository.loginUser({ email, password });
    saveSession(session);
    return session;
  },
  logout() { clearSession(); },
  session: readSession,
};
