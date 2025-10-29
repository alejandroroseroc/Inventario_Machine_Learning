// src/features/auth/api.js
import { http } from "../../api/http";

export const AuthAPI = {
  // IMPORTANTE: http.post recibe { body: {...} }
  login:   ({ email, password }) => http.post("/auth/login",   { body: { email, password } }),
  register:({ email, password }) => http.post("/auth/register",{ body: { email, password } }),
  me:      () => http.get("/auth/me", { auth: true }),
};
